const ChatRoom = ({ messages = [], currentUser, isTV = false, onDeleteMessage }) => {
    const scrollRef = React.useRef(null);
    const [selectedMsgId, setSelectedMsgId] = React.useState(null);
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

    const toggleSelection = (e, msgId) => {
        if (e.target.closest('button') || e.target.closest('.h-1\\.5')) return;
        setSelectedMsgId(prev => prev === msgId ? null : msgId);
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
                    const isSelected = selectedMsgId === msgId;

                    return (
                        <div 
                            key={msgId}
                            onClick={(e) => toggleSelection(e, msgId)}
                            onKeyDown={(e) => handleKeyDown(e, msgId)}
                            className={`msg-item tv-focusable cursor-pointer p-3 max-w-[85%] md:max-w-[70%] rounded-xl relative outline-none transition-all ${isOwn ? 'ml-auto bg-indigo-600 text-white rounded-br-none' : 'mr-auto bg-white text-gray-800 rounded-bl-none shadow-sm'} ${isSelected ? 'ring-4 ring-indigo-400 scale-[1.02] z-10' : ''}`}
                            tabIndex={isTV ? 0 : -1}
                        >
                            {isSelected && (
                                <div className="absolute -top-12 right-0 flex gap-2 bg-gray-800 p-1.5 rounded-xl z-20 shadow-xl border border-gray-700 animate-in fade-in zoom-in duration-200">
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); handleDelete(msgId, false); }} 
                                        className="text-white hover:text-gray-300 flex items-center justify-center p-2 rounded-lg hover:bg-gray-700 tv-focusable outline-none" 
                                        title="Apagar para mim"
                                    >
                                        <div className="icon-trash text-xl"></div>
                                    </button>
                                    {isOwn && (
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); handleDelete(msgId, true); }} 
                                            className="text-red-500 hover:text-red-400 flex items-center justify-center p-2 rounded-lg hover:bg-gray-700 tv-focusable outline-none" 
                                            title="Apagar para todos"
                                        >
                                            <div className="icon-trash text-xl"></div>
                                        </button>
                                    )}
                                </div>
                            )}
                            {msg.type === 'audio' ? (
                                window.CustomAudioPlayer ? <window.CustomAudioPlayer src={msg.fileData || msg.url} isOwn={isOwn} /> : <div className="text-sm">Áudio</div>
                            ) : msg.type === 'image' ? (
                                <img src={msg.fileData || msg.url} className="max-w-full rounded-lg max-h-64 object-contain" />
                            ) : msg.type === 'video' ? (
                                <video src={msg.fileData || msg.url} controls className="max-w-full rounded-lg max-h-64" />
                            ) : (
                                <div className="text-[15px] leading-relaxed break-words">{msg.text || msg.content}</div>
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