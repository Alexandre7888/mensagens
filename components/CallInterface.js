function CallInterface({ user, callId }) {
    const [callState, setCallState] = React.useState('connecting'); // connecting, waiting, active, ended
    const [localStream, setLocalStream] = React.useState(null);
    const [remoteStream, setRemoteStream] = React.useState(null);
    const [isVideo, setIsVideo] = React.useState(true);
    const [isMuted, setIsMuted] = React.useState(false);
    const [isVideoEnabled, setIsVideoEnabled] = React.useState(true);
    const [peer, setPeer] = React.useState(null);
    const [callData, setCallData] = React.useState(null);
    
    // User info
    const [remoteUser, setRemoteUser] = React.useState(null);
    const [isLocalSpeaking, setIsLocalSpeaking] = React.useState(false);
    const [isRemoteSpeaking, setIsRemoteSpeaking] = React.useState(false);

    const localVideoRef = React.useRef(null);
    const remoteVideoRef = React.useRef(null);
    const currentCallRef = React.useRef(null);
    const audioContexts = React.useRef([]);
    const db = window.firebaseDB;

    const analyzeAudio = (stream, callback) => {
        try {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const analyser = audioContext.createAnalyser();
            const microphone = audioContext.createMediaStreamSource(stream);
            microphone.connect(analyser);
            analyser.fftSize = 256;
            const bufferLength = analyser.frequencyBinCount;
            const dataArray = new Uint8Array(bufferLength);

            const checkVolume = () => {
                if (audioContext.state === 'closed') return;
                analyser.getByteFrequencyData(dataArray);
                let sum = 0;
                for (let i = 0; i < bufferLength; i++) {
                    sum += dataArray[i];
                }
                const average = sum / bufferLength;
                callback(average > 10);
                requestAnimationFrame(checkVolume);
            };
            checkVolume();
            audioContexts.current.push(audioContext);
        } catch (e) {
            console.error("Audio API not supported", e);
        }
    };

    React.useEffect(() => {
        if (!db) return;

        const callRef = db.ref(`calls/${callId}`);
        let isCaller = false;
        let cData = null;

        callRef.on('value', async (snap) => {
            const data = snap.val();
            if (!data) {
                setCallState('ended');
                return;
            }
            cData = data;
            setCallData(data);
            setIsVideo(data.isVideo);
            setIsVideoEnabled(data.isVideo);
            
            // Get remote user info
            const remoteId = data.callerId === user.id ? data.receiverId : data.callerId;
            if (!remoteUser) {
                const info = await api.getFirebaseUser(remoteId);
                setRemoteUser(info);
            }
            
            if (data.status === 'ended') {
                endLocalCall();
                setCallState('ended');
            }
        });

        // Initialize Peer JS
        const newPeer = new Peer(user.id + '_' + Math.random().toString(36).substr(2, 9), {
            debug: 2
        });
        setPeer(newPeer);

        newPeer.on('open', (id) => {
            callRef.once('value', (snap) => {
                const data = snap.val();
                if (data) {
                    isCaller = data.callerId === user.id;
                    const updates = {};
                    if (isCaller) updates.callerPeerId = id;
                    else updates.receiverPeerId = id;
                    
                    if (!isCaller && data.status === 'initiated') {
                        updates.status = 'active'; // Receiver answered
                    }
                    callRef.update(updates);
                    
                    startMedia(data.isVideo, id, data, isCaller, newPeer, callRef);
                }
            });
        });

        newPeer.on('call', (call) => {
            // Incoming direct P2P call from peer
            navigator.mediaDevices.getUserMedia({ video: cData?.isVideo || true, audio: true }).then(stream => {
                setLocalStream(stream);
                analyzeAudio(stream, setIsLocalSpeaking);

                call.answer(stream);
                currentCallRef.current = call;
                call.on('stream', (rStream) => {
                    setRemoteStream(rStream);
                    analyzeAudio(rStream, setIsRemoteSpeaking);
                    setCallState('active');
                });
                call.on('close', () => handleEndCall());
            });
        });

        return () => {
            callRef.off();
            endLocalCall();
            if (newPeer) newPeer.destroy();
        };
    }, []);

    const startMedia = (video, peerId, data, isCaller, currentPeer, callRef) => {
        navigator.mediaDevices.getUserMedia({ video, audio: true }).then(stream => {
            setLocalStream(stream);
            analyzeAudio(stream, setIsLocalSpeaking);

            if (isCaller) {
                // We are caller, wait for receiverPeerId to appear in Firebase
                setCallState('waiting');
                callRef.on('value', (snap) => {
                    const latestData = snap.val();
                    if (latestData && latestData.receiverPeerId && !currentCallRef.current && latestData.status !== 'ended') {
                        makeCall(currentPeer, latestData.receiverPeerId, stream, video);
                    }
                });
            } else {
                // We are receiver, answered the call, waiting for caller to call us via PeerJS
                setCallState('connecting');
            }
        }).catch(err => {
            console.error("Media error", err);
            setCallState('ended');
            alert("Erro ao acessar câmera/microfone.");
        });
    };

    const makeCall = (currentPeer, remotePeerId, stream, video) => {
        if (!currentPeer) return;
        const call = currentPeer.call(remotePeerId, stream, { metadata: { isVideo: video } });
        currentCallRef.current = call;
        
        call.on('stream', (rStream) => {
            setRemoteStream(rStream);
            analyzeAudio(rStream, setIsRemoteSpeaking);
            setCallState('active');
        });
        
        call.on('close', () => {
            handleEndCall();
        });
    };

    React.useEffect(() => {
        if (localVideoRef.current && localStream) localVideoRef.current.srcObject = localStream;
        if (remoteVideoRef.current && remoteStream) remoteVideoRef.current.srcObject = remoteStream;
    }, [localStream, remoteStream]);

    const endLocalCall = () => {
        if (currentCallRef.current) currentCallRef.current.close();
        if (localStream) localStream.getTracks().forEach(track => track.stop());
        if (remoteStream) remoteStream.getTracks().forEach(track => track.stop());
        audioContexts.current.forEach(ctx => ctx.close());
        setLocalStream(null);
        setRemoteStream(null);
    };

    const handleEndCall = () => {
        db.ref(`calls/${callId}`).update({ status: 'ended' });
        endLocalCall();
        setCallState('ended');
    };

    const toggleMute = () => {
        if (localStream) {
            const audioTracks = localStream.getAudioTracks();
            if (audioTracks.length > 0) {
                audioTracks[0].enabled = !audioTracks[0].enabled;
                setIsMuted(!audioTracks[0].enabled);
            }
        }
    };

    const toggleVideo = () => {
        if (localStream) {
            const videoTracks = localStream.getVideoTracks();
            if (videoTracks.length > 0) {
                videoTracks[0].enabled = !videoTracks[0].enabled;
                setIsVideoEnabled(videoTracks[0].enabled);
            }
        }
    };

    if (callState === 'ended') {
        return (
            <div className="h-screen flex flex-col items-center justify-center bg-gray-900" data-name="call-ended">
                <div className="w-20 h-20 bg-gray-800 rounded-full flex items-center justify-center mb-4">
                    <div className="icon-phone-off text-3xl text-red-500"></div>
                </div>
                <h1 className="text-2xl font-bold mb-6 text-white">Chamada Encerrada</h1>
                <button onClick={() => window.close()} className="px-6 py-3 bg-indigo-600 rounded-lg font-medium text-white hover:bg-indigo-700">Fechar Janela</button>
            </div>
        );
    }

    return (
        <div className="h-screen bg-gray-900 flex flex-col relative text-white" data-name="call-active" data-file="components/CallInterface.js">
            
            {/* Header info */}
            <div className="absolute top-6 left-0 right-0 flex justify-center z-20 pointer-events-none">
                <div className="bg-black bg-opacity-40 backdrop-blur-md px-6 py-2 rounded-full flex items-center gap-3">
                    <div className="icon-lock text-sm text-green-400"></div>
                    <span className="text-sm font-medium">Chamada {isVideo ? 'de Vídeo' : 'de Voz'} Criptografada</span>
                </div>
            </div>

            <div className="flex-1 relative flex items-center justify-center overflow-hidden">
                
                {/* Connecting / Waiting State */}
                {(callState === 'connecting' || callState === 'waiting') && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center z-10 bg-gray-900">
                        {remoteUser?.profilePicture ? (
                            <img src={remoteUser.profilePicture} alt="Avatar" className="w-32 h-32 rounded-full mb-6 object-cover border-4 border-indigo-500 shadow-xl animate-pulse" />
                        ) : (
                            <div className="w-32 h-32 bg-indigo-600 rounded-full flex items-center justify-center mb-6 shadow-xl animate-pulse">
                                <div className="icon-user text-5xl"></div>
                            </div>
                        )}
                        <h2 className="text-2xl font-bold mb-2">{remoteUser?.name || 'Aguardando...'}</h2>
                        <p className="text-gray-400 font-medium">
                            {callState === 'waiting' ? 'Chamando...' : 'Conectando...'}
                        </p>
                    </div>
                )}
                
                {/* Avatars fallback for voice or when video disabled */}
                {callState === 'active' && (!isVideo || (!isVideoEnabled && !remoteStream?.getVideoTracks()[0]?.enabled)) && (
                    <div className="absolute inset-0 flex items-center justify-center gap-16 z-0 bg-gray-900">
                        {/* Local User */}
                        <div className="flex flex-col items-center">
                            <div className={`w-32 h-32 rounded-full flex items-center justify-center mb-4 transition-all duration-200 border-4 ${isLocalSpeaking ? 'border-green-500 scale-105 shadow-[0_0_20px_rgba(34,197,94,0.5)]' : 'border-gray-700'}`}>
                                {user?.profilePicture ? (
                                    <img src={user.profilePicture} alt="Você" className="w-full h-full rounded-full object-cover" />
                                ) : (
                                    <div className="icon-user text-5xl text-gray-400"></div>
                                )}
                            </div>
                            <span className="font-medium text-gray-300">Você</span>
                        </div>
                        
                        {/* Remote User */}
                        <div className="flex flex-col items-center">
                            <div className={`w-32 h-32 rounded-full flex items-center justify-center mb-4 transition-all duration-200 border-4 ${isRemoteSpeaking ? 'border-green-500 scale-105 shadow-[0_0_20px_rgba(34,197,94,0.5)]' : 'border-gray-700'}`}>
                                {remoteUser?.profilePicture ? (
                                    <img src={remoteUser.profilePicture} alt="Remoto" className="w-full h-full rounded-full object-cover" />
                                ) : (
                                    <div className="icon-user text-5xl text-gray-400"></div>
                                )}
                            </div>
                            <span className="font-medium text-gray-300">{remoteUser?.name || 'Remoto'}</span>
                        </div>
                    </div>
                )}

                {/* Video Elements */}
                <video 
                    ref={remoteVideoRef} 
                    autoPlay 
                    playsInline 
                    className={`w-full h-full object-cover ${(callState !== 'active' || !isVideo) ? 'hidden' : 'block'}`} 
                />
                
                <div className={`absolute bottom-28 right-6 w-32 h-48 bg-gray-800 object-cover rounded-xl shadow-2xl border-2 transition-all duration-200 ${isLocalSpeaking ? 'border-green-500' : 'border-gray-600'} ${(localStream && isVideo) ? 'block' : 'hidden'}`}>
                    <video ref={localVideoRef} autoPlay playsInline muted className="w-full h-full object-cover rounded-lg" />
                    {!isVideoEnabled && (
                        <div className="absolute inset-0 flex items-center justify-center bg-gray-900 rounded-lg">
                            <div className="icon-video-off text-3xl text-gray-500"></div>
                        </div>
                    )}
                </div>

                {/* Hidden Audio element for voice calls to ensure sound plays if video tag is hidden */}
                {!isVideo && <audio ref={remoteVideoRef} autoPlay />}
            </div>

            {/* Controls */}
            <div className="h-24 bg-gray-900 bg-opacity-90 backdrop-blur-md flex items-center justify-center gap-6 absolute bottom-0 w-full z-20">
                <button onClick={toggleMute} className={`w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-transform hover:scale-110 ${isMuted ? 'bg-white text-gray-900' : 'bg-gray-700 text-white'}`}>
                    <div className={`icon-${isMuted ? 'mic-off' : 'mic'} text-xl`}></div>
                </button>
                
                <button onClick={handleEndCall} className="w-16 h-16 bg-red-500 rounded-full flex items-center justify-center hover:bg-red-600 shadow-lg transition-transform hover:scale-110">
                    <div className="icon-phone-off text-2xl text-white"></div>
                </button>

                {isVideo && (
                    <button onClick={toggleVideo} className={`w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-transform hover:scale-110 ${!isVideoEnabled ? 'bg-white text-gray-900' : 'bg-gray-700 text-white'}`}>
                        <div className={`icon-${!isVideoEnabled ? 'video-off' : 'video'} text-xl`}></div>
                    </button>
                )}
            </div>
        </div>
    );
}
window.CallInterface = CallInterface;