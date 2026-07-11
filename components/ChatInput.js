function ChatInput({ 
    chat, user, db, refPath, ephemeralMode, encryptionKey, 
    replyingTo, setReplyingTo, showEmojiPicker, setShowEmojiPicker, 
    showGifPicker, setShowGifPicker, showAttachMenu, setShowAttachMenu,
    setShowCamera, fileInputRef, sendMediaFile, sendMessage, 
    messageInput, setMessageInput, startRecording, stopRecording, recording
}) {
    const [localMessageInput, setLocalMessageInput] = React.useState(messageInput || "");
    const typingTimer = React.useRef(null);

    React.useEffect(() => {
        setMessageInput(localMessageInput);
    }, [localMessageInput, setMessageInput]);

    React.useEffect(() => {
        setLocalMessageInput(messageInput);
    }, [messageInput]);

    const handleSendMessage = () => {
        if (localMessageInput.trim().length === 0) return;
        sendMessage(localMessageInput);
        setLocalMessageInput("");
    };

    return (
        <div className="flex gap-1.5 sm:gap-2 items-end w-full max-w-full relative" data-name="chat-input" data-file="components/ChatInput.js">
            {showAttachMenu && (
                <div className={`absolute bottom-16 left-2 right-2 sm:left-4 sm:right-auto rounded-2xl shadow-xl border p-4 flex gap-4 justify-around sm:justify-start animate-fade-in-up z-50 ${ephemeralMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-100'}`}>
                    <button onClick={() => { fileInputRef.current?.click(); setShowAttachMenu(false); }} className="flex flex-col items-center gap-2 group">
                        <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                            <div className="icon-image text-2xl"></div>
                        </div>
                        <span className={`text-xs font-medium ${ephemeralMode ? 'text-gray-300' : 'text-gray-600'}`}>Mídia</span>
                    </button>
                    <button onClick={() => { setShowCamera(true); setShowAttachMenu(false); }} className="flex flex-col items-center gap-2 group">
                        <div className="w-12 h-12 rounded-full bg-pink-100 text-pink-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                            <div className="icon-camera text-2xl"></div>
                        </div>
                        <span className={`text-xs font-medium ${ephemeralMode ? 'text-gray-300' : 'text-gray-600'}`}>Câmera</span>
                    </button>
                    <button onClick={() => { fileInputRef.current?.click(); setShowAttachMenu(false); }} className="flex flex-col items-center gap-2 group">
                        <div className="w-12 h-12 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                            <div className="icon-file-text text-2xl"></div>
                        </div>
                        <span className={`text-xs font-medium ${ephemeralMode ? 'text-gray-300' : 'text-gray-600'}`}>Documento</span>
                    </button>
                </div>
            )}
            
            <input type="file" ref={fileInputRef} className="hidden" accept="image/*, audio/*, video/*, application/pdf" onChange={(e) => {
                if (e.target.files[0]) sendMediaFile(e.target.files[0], e.target.files[0].type.startsWith('image/') ? 'image' : 'file');
            }} />
            
            <div className={`flex-1 min-w-0 rounded-3xl flex items-center px-1 sm:px-2 min-h-[50px] ${ephemeralMode ? 'bg-gray-700' : 'bg-gray-100'}`}>
                <button onClick={() => { setShowEmojiPicker(!showEmojiPicker); setShowGifPicker(false); setShowAttachMenu(false); }} className={`p-1.5 sm:p-2.5 rounded-full flex-shrink-0 transition-colors ${ephemeralMode ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-indigo-600'}`}>
                    <div className="icon-smile text-xl"></div>
                </button>

                <button onClick={() => { setShowGifPicker(!showGifPicker); setShowEmojiPicker(false); setShowAttachMenu(false); }} className={`p-1.5 sm:p-2.5 rounded-full flex-shrink-0 transition-colors ${ephemeralMode ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-indigo-600'}`}>
                    <div className="icon-sticker text-xl"></div>
                </button>
                
                <button onClick={() => { setShowAttachMenu(!showAttachMenu); setShowEmojiPicker(false); setShowGifPicker(false); }} className={`p-1.5 sm:p-2.5 rounded-full flex-shrink-0 transition-colors ${ephemeralMode ? 'text-gray-400 hover:text-white hover:bg-gray-600' : 'text-gray-500 hover:text-indigo-600 hover:bg-gray-200'}`}>
                    <div className="icon-paperclip text-xl"></div>
                </button>
                
                <input 
                    type="text" 
                    value={localMessageInput}
                    onChange={(e) => {
                        setLocalMessageInput(e.target.value);
                        
                        let targetId = chat.targetId || (chat.id.replace(user.id, '').replace('_', ''));
                        if (window.ChatP2P && chat.type !== 'group' && targetId) {
                            window.ChatP2P.sendTyping(user.id, targetId, true);
                        }

                        if (db) {
                            const basePath = refPath.split('/messages')[0];
                            db.ref(`${basePath}/typing/${user.id}`).set(true);
                            if (typingTimer.current) clearTimeout(typingTimer.current);
                            typingTimer.current = setTimeout(() => {
                                db.ref(`${basePath}/typing/${user.id}`).remove();
                                if (window.ChatP2P && chat.type !== 'group' && targetId) {
                                    window.ChatP2P.sendTyping(user.id, targetId, false);
                                }
                            }, 2000);
                        }
                    }}
                    onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                    placeholder={ephemeralMode ? "Secreta..." : "Mensagem"} 
                    className={`flex-1 min-w-0 w-full bg-transparent border-none px-1 sm:px-2 py-3 outline-none text-sm sm:text-base ${ephemeralMode ? 'text-white placeholder-gray-400' : 'text-gray-800 placeholder-gray-500'}`}
                />
            </div>
            
            {localMessageInput.trim().length > 0 ? (
                <button onClick={handleSendMessage} className={`w-12 h-12 shrink-0 text-white rounded-full flex items-center justify-center transition-transform hover:scale-105 shadow-md ${ephemeralMode ? 'bg-purple-600 hover:bg-purple-700' : 'bg-indigo-600 hover:bg-indigo-700'}`}>
                    <div className="icon-send text-xl ml-1"></div>
                </button>
            ) : (
                <button 
                    onMouseDown={startRecording} onMouseUp={stopRecording} onMouseLeave={stopRecording} onTouchStart={startRecording} onTouchEnd={stopRecording}
                    className={`w-12 h-12 shrink-0 rounded-full flex items-center justify-center transition-transform hover:scale-105 shadow-md ${recording ? 'bg-red-500 text-white animate-pulse' : (ephemeralMode ? 'bg-purple-600 text-white hover:bg-purple-700' : 'bg-indigo-600 text-white hover:bg-indigo-700')}`}
                >
                    <div className="icon-mic text-xl"></div>
                </button>
            )}
        </div>
    );
}
window.ChatInput = ChatInput;