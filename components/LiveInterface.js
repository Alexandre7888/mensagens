function LiveInterface({ user, onClose, initialLiveId }) {
    const [lives, setLives] = React.useState([]);
    const [showCreateModal, setShowCreateModal] = React.useState(false);
    const [liveData, setLiveData] = React.useState({ title: '', desc: '', type: 'direct', category: 'Geral', visibility: 'public' });
    const [activeLive, setActiveLive] = React.useState(null);
    const [stream, setStream] = React.useState(null);
    const [viewersCount, setViewersCount] = React.useState(0);
    const [isMuted, setIsMuted] = React.useState(false);
    const [isVideoOff, setIsVideoOff] = React.useState(false);
    const [zoomLevel, setZoomLevel] = React.useState(1);
    const [showLeaveModal, setShowLeaveModal] = React.useState(false);
    const [overlays, setOverlays] = React.useState([]);
    const [selectedOverlayId, setSelectedOverlayId] = React.useState(null);
    const [chatMessages, setChatMessages] = React.useState([]);
    const [chatInput, setChatInput] = React.useState('');
    const [reactions, setReactions] = React.useState([]);
    const [videoFilter, setVideoFilter] = React.useState('none');
    
    // Nova lógica de abas na barra lateral
    const [sidebarTab, setSidebarTab] = React.useState('chat'); // 'chat' ou 'studio'
    const [studioTab, setStudioTab] = React.useState('geral'); // geral, video, audio, efeitos, interacao, stats
    
    const [isRecording, setIsRecording] = React.useState(false);
    const [recordedChunks, setRecordedChunks] = React.useState([]);
    const mediaRecorderRef = React.useRef(null);
    const [liveTime, setLiveTime] = React.useState(0);
    const [liveStats, setLiveStats] = React.useState({ maxViewers: 0, likes: 0, donations: 0 });

    const videoRef = React.useRef(null);
    const chatContainerRef = React.useRef(null);
    const peerRef = React.useRef(null);
    const callsRef = React.useRef({});
    const streamRef = React.useRef(null);
    const lastDonationTimeRef = React.useRef(0);

    // Salva a referência da stream atual para limpar no unmount
    React.useEffect(() => {
        streamRef.current = stream;
    }, [stream]);

    // Limpeza rigorosa no unmount (corrige o bug da câmera travada)
    React.useEffect(() => {
        return () => {
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(t => {
                    t.stop();
                    t.enabled = false;
                });
            }
            if (peerRef.current) {
                peerRef.current.destroy();
            }
        };
    }, []);

    // Timer da live
    React.useEffect(() => {
        let interval;
        if (activeLive && activeLive.hostId === user.id) {
            interval = setInterval(() => setLiveTime(prev => prev + 1), 1000);
        }
        return () => clearInterval(interval);
    }, [activeLive]);

    React.useEffect(() => {
        const db = window.firebaseDB;
        if (!db) return;
        const ref = db.ref('lives');
        const listener = ref.on('value', snap => {
            const data = snap.val();
            if (data) {
                const list = Object.keys(data).map(k => ({id: k, ...data[k]})).sort((a,b) => b.timestamp - a.timestamp);
                setLives(list);
                
                if (activeLive) {
                    const currentActive = list.find(l => l.id === activeLive.id);
                    if (currentActive) {
                        setActiveLive(currentActive);
                        const currentViewers = currentActive.viewers ? Object.keys(currentActive.viewers).length : 0;
                        setViewersCount(currentViewers);
                        if (currentViewers > liveStats.maxViewers) {
                            setLiveStats(prev => ({...prev, maxViewers: currentViewers}));
                        }
                        if (currentActive.hostId !== user.id) {
                            setOverlays(currentActive.overlays || []);
                            setVideoFilter(currentActive.videoFilter || 'none');
                        }
                        if (currentActive.chat) {
                            setChatMessages(Object.values(currentActive.chat));
                        }
                        // Animação global de doação (diamante)
                        if (currentActive.lastDonation && currentActive.lastDonation.time > lastDonationTimeRef.current) {
                            lastDonationTimeRef.current = currentActive.lastDonation.time;
                            // Dispara vários diamantes para ficar mais legal
                            for(let i=0; i<5; i++) {
                                setTimeout(() => triggerReaction('💎'), i * 200);
                            }
                        }
                    } else if (activeLive.hostId !== user.id) {
                        alert('A transmissão foi encerrada pelo anfitrião.');
                        leaveLiveLocal();
                    }
                } else if (initialLiveId && !activeLive) {
                    const targetLive = list.find(l => l.id === initialLiveId);
                    if (targetLive && targetLive.status === 'active') {
                        joinLive(targetLive, false);
                    }
                }
            } else {
                setLives([]);
                if (activeLive && activeLive.hostId !== user.id) {
                    alert('A transmissão foi encerrada.');
                    leaveLiveLocal();
                }
            }
        });
        return () => ref.off('value', listener);
    }, [activeLive, initialLiveId]);

    React.useEffect(() => {
        if (videoRef.current && stream) {
            if (videoRef.current.srcObject !== stream) {
                videoRef.current.srcObject = stream;
            }
            if (activeLive && activeLive.hostId === user.id) {
                videoRef.current.muted = true;
            }
        }
    }, [activeLive?.hostId, stream, user.id]);

    React.useEffect(() => {
        if (activeLive && activeLive.hostId === user.id) {
            window.firebaseDB.ref(`lives/${activeLive.id}`).update({ overlays, videoFilter });
        }
    }, [overlays, videoFilter]);

    const handleCreateLive = async () => {
        if(!liveData.title) return alert('Insira um título');
        const db = window.firebaseDB;
        
        try {
            let mediaStream = null;
            if (liveData.type === 'direct') {
                mediaStream = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: true });
            }

            const newLive = {
                hostId: user.id,
                hostName: user.name,
                title: liveData.title,
                desc: liveData.desc,
                category: liveData.category,
                visibility: liveData.visibility,
                type: liveData.type,
                scheduleDate: liveData.date || null,
                status: liveData.type === 'direct' ? 'active' : 'scheduled',
                timestamp: Date.now(),
                overlays: [],
                videoFilter: 'none',
                peerId: '',
                chat: {}
            };
            const ref = await db.ref('lives').push(newLive);
            setShowCreateModal(false);
            
            if (liveData.type === 'direct') {
                initPeerHost(ref.key, newLive, mediaStream);
            } else {
                alert('Live agendada com sucesso!');
            }
        } catch (e) {
            alert('Erro ao acessar câmera/microfone: Certifique-se de dar as permissões necessárias.');
        }
    };

    const initPeerHost = (liveId, liveInfo, mediaStream) => {
        setStream(mediaStream);
        setActiveLive({ id: liveId, ...liveInfo });
        setLiveTime(0);
        
        const peer = new window.Peer(undefined, { debug: 1 });
        peerRef.current = peer;
        
        peer.on('open', async (id) => {
            await window.firebaseDB.ref(`lives/${liveId}`).update({ peerId: id });
        });
        
        peer.on('call', (call) => {
            call.answer(mediaStream);
            callsRef.current[call.peer] = call;
        });
    };

    const joinLive = async (live, isHost) => {
        if (isHost) return;
        
        setActiveLive(live);
        setSidebarTab('chat');
        const db = window.firebaseDB;
        await db.ref(`lives/${live.id}/viewers/${user.id}`).set(true);
        
        const peer = new window.Peer(undefined, { debug: 1 });
        peerRef.current = peer;
        
        peer.on('open', (id) => {
            if (live.peerId) {
                const call = peer.call(live.peerId, null);
                call.on('stream', (remoteStream) => {
                    setStream(remoteStream);
                });
            }
        });
    };

    const leaveLiveLocal = async () => {
        if (activeLive && activeLive.hostId !== user.id) {
            await window.firebaseDB.ref(`lives/${activeLive.id}/viewers/${user.id}`).remove();
        }
        
        if (stream) {
            stream.getTracks().forEach(t => {
                t.stop();
                t.enabled = false;
            });
        }
        
        if (peerRef.current) {
            peerRef.current.destroy();
            peerRef.current = null;
        }
        
        if (isRecording) stopRecording();
        
        setActiveLive(null);
        setStream(null);
        setShowLeaveModal(false);
        setZoomLevel(1);
        setIsMuted(false);
        setIsVideoOff(false);
        setOverlays([]);
        window.history.replaceState({}, document.title, window.location.pathname);
    };

    const handleBackClick = () => {
        if (activeLive) {
            if (activeLive.hostId === user.id) {
                setShowLeaveModal(true);
            } else {
                leaveLiveLocal();
                onClose();
            }
        } else {
            onClose();
        }
    };

    const handleHostLeave = async (action) => {
        if (action === 'end') {
            try {
                const db = window.firebaseDB;
                const pendingRef = db.ref(`lives/${activeLive.id}/pendingDonations`);
                const pendingSnap = await pendingRef.once('value');
                let pending = pendingSnap.val() || 0;
                
                if (pending > 0) {
                    const userEarnedRef = db.ref(`users/${user.id}/earnedCredits`);
                    const userEarnedSnap = await userEarnedRef.once('value');
                    const currentEarned = parseInt(userEarnedSnap.val()) || 0;
                    
                    await userEarnedRef.set(currentEarned + pending);
                    alert(`🎉 Transmissão encerrada!\n\n💎 Arrecadado: ${pending} créditos\n💸 Os créditos foram para sua carteira de arrecadações e podem ser resgatados na página de Créditos!`);
                } else {
                    alert('A transmissão foi encerrada.');
                }

                await window.firebaseDB.ref(`lives/${activeLive.id}`).remove();
                leaveLiveLocal();
                onClose();
            } catch (err) {
                console.error("Erro ao finalizar live:", err);
                alert('Erro ao processar os créditos da live. Encerrando forçadamente.');
                await window.firebaseDB.ref(`lives/${activeLive.id}`).remove();
                leaveLiveLocal();
                onClose();
            }
        } else if (action === 'afk') {
            await window.firebaseDB.ref(`lives/${activeLive.id}`).update({ 
                overlays: [...overlays, { id: 'afk-text', type: 'text', content: 'Anfitrião está AFK (Ausente)', x: 50, y: 50, scale: 1.5, rotation: 0 }] 
            });
            setIsVideoOff(true);
            setIsMuted(true);
            if (stream) {
                stream.getVideoTracks().forEach(t => t.enabled = false);
                stream.getAudioTracks().forEach(t => t.enabled = false);
            }
            setShowLeaveModal(false);
        }
    };

    const toggleMute = () => {
        if (stream) {
            stream.getAudioTracks().forEach(t => t.enabled = !t.enabled);
            setIsMuted(!stream.getAudioTracks()[0].enabled);
        }
    };

    const toggleVideo = () => {
        if (stream) {
            stream.getVideoTracks().forEach(t => t.enabled = !t.enabled);
            setIsVideoOff(!stream.getVideoTracks()[0].enabled);
        }
    };

    const toggleScreenShare = async () => {
        try {
            const displayStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
            const videoTrack = displayStream.getVideoTracks()[0];
            
            const sender = stream.getVideoTracks()[0];
            if(sender) stream.removeTrack(sender);
            stream.addTrack(videoTrack);
            
            Object.values(callsRef.current).forEach(call => {
                const s = call.peerConnection.getSenders().find(s => s.track && s.track.kind === 'video');
                if(s) s.replaceTrack(videoTrack);
            });

            videoTrack.onended = async () => {
                const camStream = await navigator.mediaDevices.getUserMedia({ video: true });
                const camTrack = camStream.getVideoTracks()[0];
                stream.removeTrack(videoTrack);
                stream.addTrack(camTrack);
                Object.values(callsRef.current).forEach(call => {
                    const s = call.peerConnection.getSenders().find(s => s.track && s.track.kind === 'video');
                    if(s) s.replaceTrack(camTrack);
                });
            };
        } catch (err) {
            console.error("Screen share error", err);
        }
    };

    const toggleRecording = () => {
        if (isRecording) stopRecording();
        else startRecording();
    };

    const startRecording = () => {
        if (!stream) return;
        const options = { mimeType: 'video/webm; codecs=vp9' };
        try {
            const mediaRecorder = new MediaRecorder(stream, options);
            mediaRecorderRef.current = mediaRecorder;
            mediaRecorder.ondataavailable = (e) => {
                if (e.data && e.data.size > 0) {
                    setRecordedChunks(prev => [...prev, e.data]);
                }
            };
            mediaRecorder.start(1000);
            setIsRecording(true);
        } catch (e) {
            console.error(e);
            alert("Erro ao iniciar gravação");
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
            setTimeout(() => {
                const blob = new Blob(recordedChunks, { type: 'video/webm' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `Live_Phantora_${Date.now()}.webm`;
                a.click();
                setRecordedChunks([]);
            }, 1000);
        }
    };

    const sendChatMessage = async (e) => {
        e.preventDefault();
        if (!chatInput.trim() || !activeLive) return;
        const msg = {
            id: Date.now(),
            userId: user.id,
            userName: user.name,
            text: chatInput,
            time: Date.now(),
            isDonation: false
        };
        await window.firebaseDB.ref(`lives/${activeLive.id}/chat`).push(msg);
        setChatInput('');
        setTimeout(() => chatContainerRef.current?.scrollTo({ top: chatContainerRef.current.scrollHeight, behavior: 'smooth' }), 100);
    };

    const sendDonation = async (amount) => {
        if (!activeLive) return;
        const db = window.firebaseDB;
        
        // Verifica se o usuário tem créditos suficientes
        const userRef = db.ref(`users/${user.id}/credits`);
        const snapshot = await userRef.once('value');
        let currentCredits = snapshot.val() || 0;
        
        if (currentCredits < amount) {
            alert('Você não tem créditos suficientes para essa doação.');
            return;
        }
        
        // Desconta os créditos do doador
        await userRef.set(currentCredits - amount);
        
        // Adiciona aos créditos pendentes da live
        const pendingRef = db.ref(`lives/${activeLive.id}/pendingDonations`);
        const pendingSnap = await pendingRef.once('value');
        let currentPending = pendingSnap.val() || 0;
        await pendingRef.set(currentPending + amount);

        const msg = {
            id: Date.now(),
            userId: user.id,
            userName: user.name,
            text: `Enviou ${amount} Créditos! 💎`,
            time: Date.now(),
            isDonation: true,
            amount
        };
        await db.ref(`lives/${activeLive.id}/chat`).push(msg);
        await db.ref(`lives/${activeLive.id}/lastDonation`).set({ time: Date.now(), amount });
        setLiveStats(prev => ({...prev, donations: prev.donations + amount}));
    };

    const triggerReaction = (emoji) => {
        const id = Date.now() + Math.random();
        setReactions(prev => [...prev, { id, emoji, x: Math.random() * 80 + 10 }]);
        setTimeout(() => setReactions(prev => prev.filter(r => r.id !== id)), 2000);
    };

    const addOverlay = (type, content) => {
        setOverlays([...overlays, {
            id: Date.now().toString(),
            type,
            content,
            x: 50,
            y: 50,
            scale: 1,
            rotation: 0
        }]);
        setSelectedOverlayId(Date.now().toString());
    };

    const formatTime = (seconds) => {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
        return `${h > 0 ? h+':' : ''}${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    const getFilterStyle = (filterName) => {
        switch(filterName) {
            case 'vintage': return 'sepia(0.6) contrast(1.2) brightness(0.9)';
            case 'bw': return 'grayscale(1)';
            case 'neon': return 'contrast(1.5) saturate(2) hue-rotate(90deg)';
            case 'cyberpunk': return 'contrast(1.2) saturate(1.8) hue-rotate(180deg)';
            case 'blur': return 'blur(5px)';
            default: return 'none';
        }
    };

    if (activeLive) {
        const isHost = String(activeLive.hostId) === String(user.id);
        
        return (
            <div className="fixed inset-0 bg-black flex flex-col md:flex-row z-[100] font-sans overflow-hidden">
                
                {/* Área de Vídeo (Esquerda) */}
                <div className="flex-1 relative flex flex-col bg-black min-h-0">
                    
                    {/* Header Overlay do Vídeo */}
                    <div className="absolute top-0 left-0 right-0 p-4 bg-gradient-to-b from-black/80 to-transparent z-40 flex items-center justify-between pointer-events-none">
                        <div className="flex items-center gap-3 pointer-events-auto">
                            <button onClick={handleBackClick} className="p-2 bg-black/40 hover:bg-black/80 text-white rounded-full backdrop-blur border border-white/10 transition">
                                <div className="icon-arrow-left"></div>
                            </button>
                            <button 
                                onClick={() => {
                                    const url = `${window.location.origin}${window.location.pathname}?liveid=${activeLive.id}`;
                                    navigator.clipboard.writeText(url);
                                    alert("Link copiado com sucesso!");
                                }} 
                                className="p-2 bg-black/40 hover:bg-black/80 text-white rounded-full backdrop-blur border border-white/10 transition"
                                title="Copiar Link"
                            >
                                <div className="icon-link"></div>
                            </button>
                            <div className="flex flex-col">
                                <h2 className="font-bold text-white text-base md:text-lg leading-tight drop-shadow-md">{activeLive.title}</h2>
                                <div className="flex items-center gap-2 mt-1">
                                    <span className="bg-red-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded shadow-lg uppercase flex items-center gap-1">
                                        <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse"></div> AO VIVO
                                    </span>
                                    <span className="bg-black/50 text-white text-xs px-2 py-0.5 rounded backdrop-blur flex items-center gap-1 font-medium">
                                        <div className="icon-eye"></div> {viewersCount}
                                    </span>
                                    {isRecording && <span className="text-red-400 animate-pulse flex items-center gap-1 text-xs font-bold"><div className="icon-disc"></div> REC</span>}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Vídeo e Overlays */}
                    <div className="flex-1 relative flex items-center justify-center overflow-hidden h-full w-full">
                        {isVideoOff && isHost && (
                            <div className="absolute inset-0 flex items-center justify-center z-10 bg-black/95">
                                <div className="text-center text-gray-500">
                                    <div className="icon-video-off text-6xl mb-4 mx-auto"></div>
                                    <p>Câmera Desligada</p>
                                </div>
                            </div>
                        )}
                        
                        <video 
                            ref={videoRef} 
                            autoPlay 
                            playsInline 
                            className="w-full h-full object-contain transition-transform duration-300"
                            style={{ transform: `scale(${zoomLevel})`, filter: getFilterStyle(videoFilter) }}
                        />
                        
                        {overlays.map(overlay => (
                            <div key={overlay.id} className="absolute transform -translate-x-1/2 -translate-y-1/2 pointer-events-none" style={{ left: `${overlay.x}%`, top: `${overlay.y}%`, transform: `translate(-50%, -50%) rotate(${overlay.rotation}deg) scale(${overlay.scale})`, zIndex: 20 }}>
                                {overlay.type === 'text' && <div className="text-white text-2xl md:text-4xl font-bold whitespace-nowrap drop-shadow-[0_4px_4px_rgba(0,0,0,0.8)]">{overlay.content}</div>}
                            </div>
                        ))}

                        {reactions.map(r => (
                            <div key={r.id} className="absolute bottom-20 text-4xl animate-bounce pointer-events-none" style={{ left: `${r.x}%`, animationDuration: '2s' }}>{r.emoji}</div>
                        ))}

                        {/* Controles da Câmera do Host (Embutido no vídeo) */}
                        {isHost && (
                            <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 flex items-center gap-2 bg-black/60 p-1.5 rounded-full backdrop-blur-md border border-white/10 z-40 shadow-2xl">
                                <button onClick={toggleMute} className={`p-3 rounded-full transition ${isMuted ? 'bg-red-500 text-white' : 'hover:bg-white/20 text-white'}`}>
                                    <div className={isMuted ? 'icon-mic-off' : 'icon-mic'}></div>
                                </button>
                                <button onClick={toggleVideo} className={`p-3 rounded-full transition ${isVideoOff ? 'bg-red-500 text-white' : 'hover:bg-white/20 text-white'}`}>
                                    <div className={isVideoOff ? 'icon-video-off' : 'icon-video'}></div>
                                </button>
                                <div className="w-px h-6 bg-white/20 mx-1"></div>
                                <button onClick={() => setZoomLevel(Math.max(1, zoomLevel - 0.2))} className="p-3 rounded-full hover:bg-white/20 text-white transition" disabled={zoomLevel <= 1}>
                                    <div className="icon-zoom-out"></div>
                                </button>
                                <button onClick={() => setZoomLevel(Math.min(3, zoomLevel + 0.2))} className="p-3 rounded-full hover:bg-white/20 text-white transition" disabled={zoomLevel >= 3}>
                                    <div className="icon-zoom-in"></div>
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* Barra Lateral Direita (Chat / Estúdio) */}
                <div className="w-full md:w-80 lg:w-[360px] h-[40vh] md:h-full bg-gray-950 flex flex-col border-t md:border-t-0 md:border-l border-gray-800 z-30 shrink-0">
                    
                    {/* Header da Barra Lateral */}
                    <div className="flex bg-gray-900 border-b border-gray-800 p-3 shrink-0 justify-center">
                        <span className="text-sm font-bold text-gray-300 flex items-center gap-2">
                            <div className="icon-message-circle"></div> Chat ao Vivo
                        </span>
                    </div>

                    {/* Conteúdo: CHAT */}
                    {(true) && (
                        <div className="flex-1 flex flex-col min-h-0 relative">
                            <div ref={chatContainerRef} className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar relative z-10">
                                {chatMessages.length === 0 && (
                                    <p className="text-center text-gray-600 text-sm mt-4 italic">Seja o primeiro a enviar uma mensagem!</p>
                                )}
                                {chatMessages.map(msg => (
                                    <div key={msg.id} className={`text-sm break-words ${msg.isDonation ? 'bg-indigo-600/90 text-white p-2.5 rounded-lg border border-indigo-400 shadow-lg' : 'text-gray-200'}`}>
                                        <span className="font-bold text-gray-400 mr-2">{msg.userName}:</span>
                                        <span>{msg.text}</span>
                                    </div>
                                ))}
                            </div>
                            
                            <div className="p-3 bg-gray-900 border-t border-gray-800 shrink-0 z-20">
                                {!isHost && (
                                    <div className="flex gap-2 mb-3">
                                        <button onClick={() => triggerReaction('❤️')} className="p-2 bg-gray-800 rounded-lg hover:bg-gray-700 transition">❤️</button>
                                        <button onClick={() => triggerReaction('🔥')} className="p-2 bg-gray-800 rounded-lg hover:bg-gray-700 transition">🔥</button>
                                        <button onClick={() => triggerReaction('🎉')} className="p-2 bg-gray-800 rounded-lg hover:bg-gray-700 transition">🎉</button>
                                        <button onClick={() => sendDonation(50)} className="ml-auto px-4 bg-gradient-to-r from-yellow-500 to-yellow-600 text-black font-bold rounded-lg text-xs flex items-center gap-1 shadow-lg hover:brightness-110 transition">
                                            💎 Doar
                                        </button>
                                    </div>
                                )}
                                <form onSubmit={sendChatMessage} className="flex gap-2">
                                    <input 
                                        type="text" 
                                        value={chatInput} 
                                        onChange={e => setChatInput(e.target.value)} 
                                        placeholder="Diga algo..." 
                                        className="flex-1 bg-gray-950 text-white px-4 py-2.5 rounded-xl outline-none border border-gray-800 focus:border-indigo-500 text-sm transition" 
                                    />
                                    <button type="submit" className="px-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl transition shadow-lg shadow-indigo-500/20">
                                        <div className="icon-send"></div>
                                    </button>
                                </form>
                            </div>
                        </div>
                    )}

                </div>

                {/* Modal de Saída do Host */}
                {isHost && showLeaveModal && (
                    <div className="fixed inset-0 bg-black/90 z-[200] flex items-center justify-center p-4 backdrop-blur-sm">
                        <div className="bg-gray-900 rounded-3xl p-8 w-full max-w-sm text-center shadow-2xl border border-gray-800">
                            <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
                                <div className="icon-power text-4xl text-red-500"></div>
                            </div>
                            <h3 className="text-xl font-bold text-white mb-2">Encerrar Transmissão?</h3>
                            <p className="text-gray-400 text-sm mb-6">Escolha o que deseja fazer com a live.</p>
                            
                            <div className="flex flex-col gap-3">
                                <button onClick={() => handleHostLeave('afk')} className="w-full py-3.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-white rounded-xl font-bold transition flex items-center justify-center gap-2">
                                    <div className="icon-pause-circle"></div> Pausar (Modo AFK)
                                </button>
                                <button onClick={() => handleHostLeave('end')} className="w-full py-3.5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold transition shadow-lg shadow-red-600/20 flex items-center justify-center gap-2">
                                    <div className="icon-x-circle"></div> Encerrar Definitivamente
                                </button>
                                <button onClick={() => setShowLeaveModal(false)} className="w-full py-3 mt-2 text-gray-500 hover:text-white font-bold transition">
                                    Cancelar e Voltar
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    // Tela Inicial (Lobby)
    return (
        <div className="min-h-screen bg-gray-950 text-white flex flex-col font-sans">
            <header className="p-4 md:px-8 bg-gray-900 flex items-center justify-between border-b border-gray-800 sticky top-0 z-10 shadow-md">
                <div className="flex items-center gap-4">
                    <button onClick={onClose} className="p-2 bg-gray-800 hover:bg-gray-700 rounded-full transition"><div className="icon-arrow-left"></div></button>
                    <h1 className="text-xl font-bold flex items-center gap-2"><div className="icon-radio text-red-500"></div> Phantora Live</h1>
                </div>
                <button onClick={() => setShowCreateModal(true)} className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-indigo-600/20 transition">
                    <div className="icon-video"></div> Transmitir
                </button>
            </header>

            <main className="flex-1 p-4 md:p-8 overflow-y-auto w-full custom-scrollbar">
                {lives.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center py-20 text-gray-500">
                        <div className="icon-radio text-8xl mb-6 opacity-20"></div>
                        <h2 className="text-xl md:text-2xl font-bold mb-3 text-gray-400">Nenhuma transmissão online agora</h2>
                        <p className="text-sm md:text-base max-w-md">Seja o primeiro a iniciar uma transmissão ao vivo para a comunidade!</p>
                        <button onClick={() => setShowCreateModal(true)} className="mt-8 px-8 py-3 bg-gray-800 text-white rounded-xl font-bold hover:bg-gray-700 transition border border-gray-700 shadow-sm">Iniciar Live</button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-7xl mx-auto">
                        {lives.map(l => (
                            <div key={l.id} className="bg-gray-900 rounded-2xl overflow-hidden border border-gray-800 cursor-pointer hover:border-indigo-500 hover:shadow-xl hover:shadow-indigo-500/10 hover:-translate-y-1 transition-all group" onClick={() => joinLive(l, false)}>
                                <div className="h-48 bg-gray-950 relative flex items-center justify-center overflow-hidden">
                                    <div className="icon-play text-5xl text-gray-800 group-hover:scale-110 transition-transform duration-500 group-hover:text-indigo-500/40"></div>
                                    {l.status === 'active' && <div className="absolute top-3 left-3 bg-red-600 text-white text-[10px] px-2 py-1 rounded font-bold uppercase flex items-center gap-1.5 shadow-md"><div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse"></div> AO VIVO</div>}
                                    <div className="absolute bottom-3 left-3 bg-black/60 text-white text-[10px] px-2 py-1 rounded backdrop-blur font-bold uppercase">
                                        {l.category || 'Geral'}
                                    </div>
                                    <div className="absolute bottom-3 right-3 bg-black/60 text-white text-xs px-2 py-1 rounded flex items-center gap-1.5 backdrop-blur font-medium">
                                        <div className="icon-eye"></div> {l.viewers ? Object.keys(l.viewers).length : 0}
                                    </div>
                                </div>
                                <div className="p-5">
                                    <h3 className="font-bold text-lg mb-1.5 truncate group-hover:text-indigo-400 transition">{l.title}</h3>
                                    <p className="text-sm text-gray-500 flex items-center gap-2">
                                        <div className="icon-user text-gray-600"></div> {l.hostName}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </main>

            {showCreateModal && (
                <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-md">
                    <div className="bg-gray-900 rounded-3xl p-6 md:p-8 w-full max-w-lg shadow-2xl border border-gray-800 flex flex-col max-h-[90vh]">
                        <div className="flex items-center justify-between mb-6 shrink-0">
                            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                                <div className="icon-settings text-indigo-500"></div> Estúdio PRO
                            </h2>
                            <button onClick={() => setShowCreateModal(false)} className="text-gray-500 hover:text-white bg-gray-800 hover:bg-gray-700 p-2 rounded-full transition"><div className="icon-x"></div></button>
                        </div>
                        
                        <div className="space-y-5 overflow-y-auto custom-scrollbar pr-2 flex-1">
                            <div>
                                <label className="block text-xs font-bold text-gray-400 mb-1.5 uppercase tracking-wider">Título da Live</label>
                                <input type="text" placeholder="Ex: Jogando com inscritos!" className="w-full p-3.5 bg-gray-950 border border-gray-800 rounded-xl outline-none focus:border-indigo-500 transition text-white" value={liveData.title} onChange={e => setLiveData({...liveData, title: e.target.value})} />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-400 mb-1.5 uppercase tracking-wider">Categoria</label>
                                    <select className="w-full p-3.5 bg-gray-950 border border-gray-800 rounded-xl outline-none text-white appearance-none" value={liveData.category} onChange={e => setLiveData({...liveData, category: e.target.value})}>
                                        <option>Geral</option>
                                        <option>Games</option>
                                        <option>Bate-Papo</option>
                                        <option>Música</option>
                                        <option>Educação</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-400 mb-1.5 uppercase tracking-wider">Visibilidade</label>
                                    <select className="w-full p-3.5 bg-gray-950 border border-gray-800 rounded-xl outline-none text-white appearance-none" value={liveData.visibility} onChange={e => setLiveData({...liveData, visibility: e.target.value})}>
                                        <option value="public">Público</option>
                                        <option value="private">Privado (Link)</option>
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-400 mb-1.5 uppercase tracking-wider">Descrição / Regras</label>
                                <textarea placeholder="O que vai acontecer..." className="w-full p-3.5 bg-gray-950 border border-gray-800 rounded-xl outline-none focus:border-indigo-500 transition text-white resize-none h-24" value={liveData.desc} onChange={e => setLiveData({...liveData, desc: e.target.value})}></textarea>
                            </div>
                        </div>

                        <div className="pt-6 shrink-0 border-t border-gray-800 mt-4">
                            <button onClick={handleCreateLive} className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl transition shadow-lg shadow-indigo-600/20 flex justify-center items-center gap-2 text-lg">
                                <div className="icon-radio"></div> Iniciar Transmissão
                            </button>
                        </div>
                    </div>
                </div>
            )}
            
            {/* Scrollbar Customizada */}
            <style dangerouslySetInnerHTML={{__html: `
                .custom-scrollbar::-webkit-scrollbar { width: 6px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #1f2937; border-radius: 10px; }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #374151; }
                .no-scrollbar::-webkit-scrollbar { display: none; }
                .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
            `}} />
        </div>
    );
}
window.LiveInterface = LiveInterface;