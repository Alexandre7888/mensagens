const ChatInput = ({ onSendMessage, onSendAudio, isTV = false }) => {
    const [message, setMessage] = React.useState('');

    React.useEffect(() => {
        const draft = localStorage.getItem("pending_draft_msg");
        if (draft) {
            setMessage(draft);
            localStorage.removeItem("pending_draft_msg");
        }
    }, []);
    const [isRecording, setIsRecording] = React.useState(false);
    const [recordingTime, setRecordingTime] = React.useState(0);
    const [showMobileRecordPanel, setShowMobileRecordPanel] = React.useState(false);
    const [isRecordingPaused, setIsRecordingPaused] = React.useState(false);
    const [showSendConfirmTV, setShowSendConfirmTV] = React.useState(false);
    const [dragOffset, setDragOffset] = React.useState({ x: 0, y: 0 });
    const [isCanceling, setIsCanceling] = React.useState(false);
    
    const mediaRecorderRef = React.useRef(null);
    const audioChunksRef = React.useRef([]);
    const timerRef = React.useRef(null);
    const touchStartRef = React.useRef({ x: 0, y: 0 });
    const isCancelledRef = React.useRef(false);

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorderRef.current = new MediaRecorder(stream);
            audioChunksRef.current = [];
            isCancelledRef.current = false;

            mediaRecorderRef.current.ondataavailable = (e) => {
                if (e.data.size > 0) audioChunksRef.current.push(e.data);
            };

            mediaRecorderRef.current.onstop = () => {
                if (!isCancelledRef.current && audioChunksRef.current.length > 0) {
                    const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                    if (onSendAudio) onSendAudio(audioBlob);
                }
                stream.getTracks().forEach(track => track.stop());
                audioChunksRef.current = [];
            };

            mediaRecorderRef.current.start();
            setIsRecording(true);
            setRecordingTime(0);
            setIsRecordingPaused(false);
            setIsCanceling(false);
            
            timerRef.current = setInterval(() => {
                setRecordingTime(prev => prev + 1);
            }, 1000);
        } catch (err) {
            console.error('Error accessing microphone', err);
        }
    };

    const stopRecording = (cancel = false) => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            isCancelledRef.current = cancel;
            mediaRecorderRef.current.stop();
        }
        clearInterval(timerRef.current);
        setIsRecording(false);
        setShowMobileRecordPanel(false);
        setDragOffset({ x: 0, y: 0 });
        setIsCanceling(false);
    };

    const pauseRecording = () => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
            mediaRecorderRef.current.pause();
            setIsRecordingPaused(true);
            clearInterval(timerRef.current);
        }
    };

    const resumeRecording = () => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'paused') {
            mediaRecorderRef.current.resume();
            setIsRecordingPaused(false);
            timerRef.current = setInterval(() => {
                setRecordingTime(prev => prev + 1);
            }, 1000);
        }
    };

    // TV hold-to-record logic
    const handleTVKeyDown = (e) => {
        if (!isTV) return;
        if (e.key === 'Enter' || e.key === 'Ok') {
            if (!isRecording) startRecording();
        }
    };

    const handleTVKeyUp = (e) => {
        if (!isTV) return;
        if (e.key === 'Enter' || e.key === 'Ok') {
            if (isRecording) stopRecording(false);
        }
    };

    // Mobile touch logic
    const handleTouchStart = (e) => {
        if (isTV) return;
        const touch = e.touches ? e.touches[0] : e;
        touchStartRef.current = { x: touch.clientX, y: touch.clientY };
        startRecording();
    };

    const handleTouchMove = (e) => {
        if (isTV || !isRecording || showMobileRecordPanel) return;
        const touch = e.touches ? e.touches[0] : e;
        const currentX = touch.clientX;
        const currentY = touch.clientY;
        const diffX = currentX - touchStartRef.current.x;
        const diffY = currentY - touchStartRef.current.y;

        setDragOffset({ x: diffX, y: diffY });

        // Swipe up to show panel
        if (diffY < -60) {
            setShowMobileRecordPanel(true);
            setDragOffset({ x: 0, y: 0 });
        }
        // Swipe right to cancel
        else if (diffX > 60) {
            setIsCanceling(true);
            stopRecording(true);
        }
    };

    const handleTouchEnd = () => {
        if (isTV || showMobileRecordPanel || isCanceling) return;
        if (isRecording) {
            stopRecording(false);
        }
    };

    const handleSendText = () => {
        if (message.trim()) {
            if (isTV) {
                setShowSendConfirmTV(true);
            } else {
                onSendMessage(message);
                setMessage('');
            }
        }
    };

    const formatTime = (seconds) => {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m}:${s < 10 ? '0' : ''}${s}`;
    };

    return (
        <div className="bg-white border-t p-3 pb-4 relative shadow-[0_-4px_10px_rgba(0,0,0,0.02)] z-30">
            {showSendConfirmTV && isTV && (
                <div className="absolute bottom-full left-0 w-full p-6 bg-gray-900 text-white flex justify-center items-center gap-6 z-50 shadow-2xl rounded-t-2xl">
                    <p className="text-xl font-bold">Enviar mensagem?</p>
                    <button 
                        className="tv-focusable bg-indigo-600 px-6 py-3 rounded-xl font-bold hover:bg-indigo-700"
                        onClick={() => { onSendMessage(message); setMessage(''); setShowSendConfirmTV(false); }}
                        autoFocus
                    >
                        Enviar
                    </button>
                    <button 
                        className="tv-focusable bg-gray-700 px-6 py-3 rounded-xl font-bold hover:bg-gray-600"
                        onClick={() => setShowSendConfirmTV(false)}
                    >
                        Cancelar
                    </button>
                </div>
            )}

            {showMobileRecordPanel && !isTV ? (
                <div className="absolute bottom-0 left-0 w-full h-full bg-white flex items-center justify-between px-4 z-20 animate-in slide-in-from-bottom-2 shadow-[0_-5px_15px_rgba(0,0,0,0.05)]">
                    <div className="flex items-center gap-3">
                        <div className={`w-3 h-3 rounded-full ${isRecordingPaused ? 'bg-orange-500' : 'bg-red-500 animate-pulse'}`}></div>
                        <span className="font-mono font-bold text-lg w-16">{formatTime(recordingTime)}</span>
                    </div>
                    <div className="flex items-center gap-6">
                        <button onClick={() => stopRecording(true)} className="text-red-500 flex flex-col items-center hover:bg-red-50 p-2 rounded-xl transition-colors">
                            <div className="icon-trash text-2xl"></div>
                            <span className="text-xs font-bold mt-1">Apagar</span>
                        </button>
                        {isRecordingPaused ? (
                            <button onClick={resumeRecording} className="text-indigo-600 flex flex-col items-center hover:bg-indigo-50 p-2 rounded-xl transition-colors">
                                <div className="icon-play text-3xl"></div>
                                <span className="text-xs font-bold mt-1">Continuar</span>
                            </button>
                        ) : (
                            <button onClick={pauseRecording} className="text-orange-500 flex flex-col items-center hover:bg-orange-50 p-2 rounded-xl transition-colors">
                                <div className="icon-pause text-3xl"></div>
                                <span className="text-xs font-bold mt-1">Pausar</span>
                            </button>
                        )}
                        <button onClick={() => stopRecording(false)} className="text-white flex flex-col items-center bg-indigo-600 hover:bg-indigo-700 shadow-md p-3 rounded-full h-14 w-14 justify-center transition-colors">
                            <div className="icon-send text-xl ml-1"></div>
                        </button>
                    </div>
                </div>
            ) : null}

            <div className={`flex items-end gap-2 ${showMobileRecordPanel ? 'invisible' : ''}`}>
                <div className="flex-1 bg-gray-100 rounded-2xl flex items-end">
                    <textarea 
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        placeholder="Mensagem..."
                        className="w-full bg-transparent border-none focus:ring-0 resize-none p-3 max-h-32 text-[15px] outline-none tv-focusable"
                        rows="1"
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleSendText();
                            }
                        }}
                    />
                </div>
                
                {message.trim() ? (
                    <button 
                        onClick={handleSendText}
                        className="bg-indigo-600 text-white w-12 h-12 rounded-full flex items-center justify-center hover:bg-indigo-700 transition-colors flex-shrink-0 tv-focusable outline-none shadow-md"
                    >
                        <div className="icon-send text-xl ml-1"></div>
                    </button>
                ) : (
                    <div className="relative">
                        {isRecording && !isTV && (
                            <div className="absolute right-16 top-1/2 -translate-y-1/2 whitespace-nowrap flex items-center gap-6 animate-in fade-in pointer-events-none">
                                <div className="text-gray-500 text-sm flex items-center gap-2 animate-pulse bg-white/90 px-3 py-1 rounded-full shadow-sm">
                                    <div className="icon-arrow-right"></div>
                                    <span className="font-medium">Arraste para cancelar</span>
                                </div>
                                <div className="text-gray-500 flex flex-col items-center text-xs animate-bounce bg-white/90 px-2 py-1 rounded-lg shadow-sm">
                                    <div className="icon-arrow-up"></div>
                                    <span className="font-bold">Painel</span>
                                </div>
                            </div>
                        )}
                        <button 
                            id="btn-record-audio"
                            onKeyDown={handleTVKeyDown}
                            onKeyUp={handleTVKeyUp}
                            onTouchStart={handleTouchStart}
                            onTouchMove={handleTouchMove}
                            onTouchEnd={handleTouchEnd}
                            onMouseDown={(e) => !isTV && handleTouchStart(e)}
                            onMouseMove={(e) => !isTV && handleTouchMove(e)}
                            onMouseUp={(e) => !isTV && handleTouchEnd(e)}
                            onMouseLeave={(e) => !isTV && isRecording && handleTouchEnd(e)}
                            className={`w-12 h-12 rounded-full flex items-center justify-center transition-all flex-shrink-0 tv-focusable outline-none ${isRecording ? 'bg-red-500 text-white scale-[1.3] shadow-lg z-10' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
                            style={{ 
                                transform: dragOffset.x || dragOffset.y ? `translate(${dragOffset.x}px, ${dragOffset.y}px) scale(1.3)` : '',
                                touchAction: 'none'
                            }}
                        >
                            <div className="icon-mic text-xl"></div>
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};
window.ChatInput = ChatInput;