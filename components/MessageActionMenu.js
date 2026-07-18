const MessageActionMenu = ({ position, msg, onClose, onSelect, onReply, onCopy, onForward }) => {
    React.useEffect(() => {
        const handleClickOutside = () => onClose();
        document.addEventListener('click', handleClickOutside);
        return () => document.removeEventListener('click', handleClickOutside);
    }, [onClose]);

    return (
        <div 
            className="fixed bg-white rounded-xl shadow-2xl border border-gray-200 z-50 overflow-hidden animate-in fade-in zoom-in duration-150"
            style={{ top: position.y, left: position.x }}
            onClick={(e) => e.stopPropagation()}
        >
            <div className="p-3 bg-gray-50 border-b border-gray-100 flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold">
                    {(msg.senderName || 'U').charAt(0).toUpperCase()}
                </div>
                <span className="font-bold text-gray-800 text-sm">{msg.senderName}</span>
            </div>
            <div className="flex flex-col py-1 min-w-[160px]">
                <button 
                    className="flex items-center gap-3 px-4 py-2 hover:bg-gray-100 text-left text-sm font-medium text-gray-700"
                    onClick={() => { onSelect(msg.key || msg.id); onClose(); }}
                >
                    <div className="icon-check-square text-indigo-500"></div> Selecionar
                </button>
                <button 
                    className="flex items-center gap-3 px-4 py-2 hover:bg-gray-100 text-left text-sm font-medium text-gray-700"
                    onClick={() => { onReply(msg); onClose(); }}
                >
                    <div className="icon-reply text-indigo-500"></div> Responder
                </button>
                <button 
                    className="flex items-center gap-3 px-4 py-2 hover:bg-gray-100 text-left text-sm font-medium text-gray-700"
                    onClick={() => { onCopy(msg); onClose(); }}
                >
                    <div className="icon-copy text-indigo-500"></div> Copiar
                </button>
                <button 
                    className="flex items-center gap-3 px-4 py-2 hover:bg-gray-100 text-left text-sm font-medium text-gray-700"
                    onClick={() => { onForward(msg); onClose(); }}
                >
                    <div className="icon-forward text-indigo-500"></div> Encaminhar
                </button>
            </div>
        </div>
    );
};
window.MessageActionMenu = MessageActionMenu;