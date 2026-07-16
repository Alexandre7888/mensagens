const ChatRoom = ({ messages = [], currentUser, isTV = false, onDeleteMessage }) => {
    const scrollRef = React.useRef(null);
    const [selectedMsgId, setSelectedMsgId] = React.useState(null);
    const [selectedMessages, setSelectedMessages] = React.useState([]);
    const [contextMenu, setContextMenu] = React.useState(null);
    const longPressTimer = React.useRef(null);
    const [showScrollBottom, setShowScrollBottom] = React.useState(false);
    const [showScrollTop, setShowScrollTop] = React.useState(false);
    const prevScrollTop = React.useRef(0);

    const handleScroll = (e) => {
        const { scrollTop, scrollHeight, clientHeight } = e.target;
        
        // Prevent bouncy/forced scroll resets
        if (Math.abs(scrollTop - prevScrollTop.current) > 500) {
            // Very fast scroll, just accept it
        }
        prevScrollTop.current = scrollTop;

        setShowScrollTop(scrollTop > 500);
        setShowScrollBottom(scrollHeight - scrollTop - clientHeight > 300);
    };

    const scrollToBottom = () => {
        if (scrollRef.current) {
            scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
        }
    };

    const scrollToTop = () => {
        if (scrollRef.current) {
            scrollRef.current.scrollTo({ top: 0, behavior: 'smooth' });
        }
    };

    React.useEffect(() => {
        if (scrollRef.current && !showScrollBottom) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages.length]);

    React.useEffect(() => {
        if (isTV) {
            const handleKeyDown = (e) => {
                if (e.key === 'ArrowDown') {
                    const focusable = document.activeElement;
                    if (focusable && focusable.classList.contains('msg-item')) {
                        const allMsgs = Array.from(document.querySelectorAll('.msg-item'));
                        const index = allMsgs.indexOf(focusable);
                        if (index >= allMsgs.length - 2) {
                            const micBtn = document.getElementById('btn-record-audio');
                            if (micBtn) {
                                e.preventDefault();
                                focusable.classList.remove('tv-focused');
                                micBtn.classList.add('tv-focused');
                                micBtn.focus();
                            }
                        }
                    }
                }
            };
            window.addEventListener('keydown', handleKeyDown);
            return () => window.removeEventListener('keydown', handleKeyDown);
        }
    }, [isTV]);

    const handleDelete = (msgId, forEveryone) => {
        if (window.confirm(forEveryone ? "Apagar para todos?" : "Apagar para mim?")) {
            if (onDeleteMessage) {
                onDeleteMessage(msgId, forEveryone);
            } else if (window.deleteMessage) {
                window.deleteMessage(msgId, forEveryone);
            }
            setSelectedMsgId(null);
        }
    };

    const handleTouchStart = (e, msgId) => {
        longPressTimer.current = setTimeout(() => {
            if (window.onMessageSelect) window.onMessageSelect(msgId);
        }, 600); // 600ms long press
    };

    const handleTouchEnd = () => {
        if (longPressTimer.current) clearTimeout(longPressTimer.current);
    };

    const handleContextMenu = (e, msg) => {
        e.preventDefault();
        setContextMenu({
            x: e.clientX,
            y: e.clientY,
            msg: msg
        });
    };

    React.useEffect(() => {
        if (window.selectedMessagesCallback) {
            window.selectedMessagesCallback(selectedMessages);
        }
    }, [selectedMessages]);

    const toggleSelection = (e, msgId) => {
        if (e.target.closest('button') || e.target.closest('.h-1\\.5')) return;
        setSelectedMessages(prev => {
            if (prev.includes(msgId)) return prev.filter(id => id !== msgId);
            return [...prev, msgId];
        });
        if (window.onMessageSelect) window.onMessageSelect(msgId);
    };

    const handleKeyDown = (e, msgId) => {
        if (isTV && (e.key === 'Enter' || e.key === 'Ok')) {
            toggleSelection(e, msgId);
        }
    };

    return (
        <div className="flex flex-col h-full bg-gray-100 relative">
            <div 
                ref={scrollRef}
                onScroll={handleScroll}
                className="flex-1 overflow-y-auto p-4 space-y-4"
                style={{ overscrollBehavior: 'none', WebkitOverflowScrolling: 'touch' }}
            >
                {messages.map((msg, index) => {
                    const isOwn = msg.senderId === currentUser?.id || msg.senderId === currentUser?.uid;
                    const msgId = msg.id || msg.key || index;
                    const isSelected = selectedMessages.includes(msgId) || selectedMsgId === msgId;

                    return (
                        <div 
                            key={msgId}
                            onClick={(e) => {
                                if (selectedMessages.length > 0 || isTV) {
                                    toggleSelection(e, msgId);
                                }
                            }}
                            onContextMenu={(e) => handleContextMenu(e, msg)}
                            onTouchStart={(e) => handleTouchStart(e, msgId)}
                            onTouchEnd={handleTouchEnd}
                            onTouchMove={handleTouchEnd}
                            onMouseDown={(e) => handleTouchStart(e, msgId)}
                            onMouseUp={handleTouchEnd}
                            onMouseLeave={handleTouchEnd}
                            onKeyDown={(e) => handleKeyDown(e, msgId)}
                            className={`msg-item tv-focusable cursor-pointer p-3 max-w-[85%] md:max-w-[70%] rounded-xl relative outline-none transition-all ${isOwn ? 'ml-auto bg-indigo-600 text-white rounded-br-none' : 'mr-auto bg-white text-gray-900 rounded-bl-none shadow-md border border-gray-200'} ${isSelected ? 'ring-4 ring-indigo-400 scale-[1.02] z-10 bg-indigo-100 text-gray-900' : ''}`}
                            tabIndex={isTV ? 0 : -1}
                        >
                            {isTV && isSelected && (
                                <div className="absolute -top-16 right-0 flex gap-2 bg-gray-800 p-2 rounded-xl z-20 shadow-xl border border-gray-700 animate-in fade-in zoom-in duration-200">
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); handleDelete(msgId, false); }} 
                                        className="text-white hover:text-gray-300 flex items-center justify-center p-3 rounded-lg hover:bg-gray-700 tv-focusable outline-none" 
                                        title="Apagar para mim"
                                    >
                                        <div className="icon-trash text-xl"></div>
                                    </button>
                                    {isOwn && (
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); handleDelete(msgId, true); }} 
                                            className="text-red-500 hover:text-red-400 flex items-center justify-center p-3 rounded-lg hover:bg-gray-700 tv-focusable outline-none" 
                                            title="Apagar para todos"
                                        >
                                            <div className="icon-trash text-xl"></div>
                                        </button>
                                    )}
                                </div>
                            )}
                            {msg.isDeleted ? (
                                <div className="text-[15px] italic text-gray-500 flex items-center gap-2">
                                    <div className="icon-circle-slash"></div> Mensagem apagada
                                </div>
                            ) : msg.type === 'audio' ? (
                                window.CustomAudioPlayer ? <window.CustomAudioPlayer src={msg.fileData || msg.url} isOwn={isOwn} /> : <div className="text-sm">Áudio</div>
                            ) : msg.type === 'image' ? (
                                <img src={msg.fileData || msg.url} className="max-w-full rounded-lg max-h-64 object-contain" />
                            ) : msg.type === 'video' ? (
                                <video src={msg.fileData || msg.url} controls className="max-w-full rounded-lg max-h-64" />
                            ) : (
                                <div className="text-[15px] leading-relaxed break-words">
                                    {window.CryptoUtils ? window.CryptoUtils.decrypt(msg.text || msg.content, 'phantora-secret-key-123') : (msg.text || msg.content)}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {!isTV && showScrollTop && (
                <button 
                    onClick={scrollToTop} 
                    className="absolute right-4 top-20 bg-white shadow-lg p-3 rounded-full text-gray-600 hover:text-indigo-600 transition-all z-10 hover:scale-110 active:scale-95" 
                >
                    <div className="icon-arrow-up text-xl"></div>
                </button>
            )}

            {contextMenu && (
                <div 
                    className="fixed bg-white rounded-xl shadow-2xl border border-gray-200 z-50 overflow-hidden animate-in fade-in zoom-in duration-150"
                    style={{ top: contextMenu.y, left: contextMenu.x }}
                >
                    <div className="p-3 bg-gray-50 border-b border-gray-100 flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold">
                            {(contextMenu.msg.senderName || 'U').charAt(0).toUpperCase()}
                        </div>
                        <span className="font-bold text-gray-800 text-sm">{contextMenu.msg.senderName}</span>
                    </div>
                    <div className="flex flex-col py-1 min-w-[160px]">
                        <button 
                            className="flex items-center gap-3 px-4 py-2 hover:bg-gray-100 text-left text-sm font-medium text-gray-700"
                            onClick={(e) => {
                                toggleSelection(e, contextMenu.msg.key || contextMenu.msg.id);
                                setContextMenu(null);
                            }}
                        >
                            <div className="icon-check-square text-indigo-500"></div> Selecionar
                        </button>
                        <button 
                            className="flex items-center gap-3 px-4 py-2 hover:bg-gray-100 text-left text-sm font-medium text-gray-700"
                            onClick={() => setContextMenu(null)}
                        >
                            <div className="icon-reply text-indigo-500"></div> Responder
                        </button>
                        <button 
                            className="flex items-center gap-3 px-4 py-2 hover:bg-gray-100 text-left text-sm font-medium text-gray-700"
                            onClick={() => {
                                navigator.clipboard.writeText(contextMenu.msg.text || '');
                                setContextMenu(null);
                            }}
                        >
                            <div className="icon-copy text-indigo-500"></div> Copiar
                        </button>
                        <button 
                            className="flex items-center gap-3 px-4 py-2 hover:bg-gray-100 text-left text-sm font-medium text-gray-700"
                            onClick={() => {
                                window.location.href = `index.html?msg=${encodeURIComponent(contextMenu.msg.text || '')}`;
                                setContextMenu(null);
                            }}
                        >
                            <div className="icon-forward text-indigo-500"></div> Encaminhar
                        </button>
                    </div>
                </div>
            )}
            
            {contextMenu && (
                <div className="fixed inset-0 z-40" onClick={() => setContextMenu(null)} onContextMenu={(e) => { e.preventDefault(); setContextMenu(null); }}></div>
            )}

            {!isTV && showScrollBottom && (
                <button 
                    onClick={scrollToBottom} 
                    className="absolute right-4 bottom-24 bg-white shadow-lg p-3 rounded-full text-gray-600 hover:text-indigo-600 transition-all z-10 hover:scale-110 active:scale-95" 
                >
                    <div className="icon-arrow-down text-xl"></div>
                </button>
            )}
        </div>
    );
};
window.ChatRoom = ChatRoom;