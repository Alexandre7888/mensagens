function GlobalCallListener({ user }) {
    const [incomingCall, setIncomingCall] = React.useState(null);
    const db = window.firebaseDB;
    const [callerInfo, setCallerInfo] = React.useState(null);

    React.useEffect(() => {
        if (!db || !user) return;

        const callsRef = db.ref('calls');
        
        let validReceiverIds = [user.id];
        
        // Listen for user's chats/groups to know which group calls to alert for
        const chatsRef = db.ref(`users/${user.id}/chats`);
        chatsRef.on('value', snap => {
            const chats = snap.val() || {};
            validReceiverIds = [user.id, ...Object.keys(chats)];
        });

        const handleNewCall = (snapshot) => {
            const calls = snapshot.val();
            if (!calls) return;

            // Find the first initiated call directed to the user or their groups
            const activeCallId = Object.keys(calls).find(key => {
                const c = calls[key];
                return validReceiverIds.includes(c.receiverId) && c.callerId !== user.id && c.status === 'initiated' && (Date.now() - c.timestamp < 60000);
            });

            if (activeCallId) {
                const callData = calls[activeCallId];
                setIncomingCall({ id: activeCallId, ...callData });
                
                // Fetch caller info
                api.getFirebaseUser(callData.callerId).then(info => {
                    setCallerInfo(info);
                });
            } else {
                setIncomingCall(null);
                setCallerInfo(null);
            }
        };

        callsRef.on('value', handleNewCall);

        return () => callsRef.off('value', handleNewCall);
    }, [db, user]);

    const handleAccept = () => {
        if (!incomingCall) return;
        window.open(`call.html?callId=${incomingCall.id}`, '_blank');
        setIncomingCall(null);
    };

    const handleDecline = () => {
        if (!incomingCall) return;
        db.ref(`calls/${incomingCall.id}`).update({ status: 'ended' });
        setIncomingCall(null);
    };

    if (!incomingCall) return null;

    return (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-95 z-[9999] flex flex-col items-center justify-center text-white backdrop-blur-md animate-fade-in" data-name="incoming-call">
            <div className="text-center animate-pulse-slow">
                {callerInfo?.profilePicture ? (
                    <img src={callerInfo.profilePicture} alt="Avatar" className="w-32 h-32 rounded-full mx-auto mb-6 object-cover border-4 border-indigo-500 shadow-[0_0_30px_rgba(99,102,241,0.6)]" />
                ) : (
                    <div className="w-32 h-32 bg-indigo-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-[0_0_30px_rgba(99,102,241,0.6)]">
                        <div className="icon-user text-5xl"></div>
                    </div>
                )}
                <h2 className="text-3xl font-bold mb-2">{callerInfo?.name || 'Usuário'}</h2>
                <p className="text-xl text-gray-300 mb-12">Chamada {incomingCall.isVideo ? 'de Vídeo' : 'de Voz'}...</p>
                
                <div className="flex gap-8 justify-center">
                    <button onClick={handleDecline} className="flex flex-col items-center gap-2 group">
                        <div className="w-16 h-16 bg-red-500 rounded-full flex items-center justify-center group-hover:bg-red-600 shadow-lg transition-transform group-hover:scale-110">
                            <div className="icon-phone-off text-2xl"></div>
                        </div>
                        <span className="font-medium text-red-400">Recusar</span>
                    </button>
                    <button onClick={handleAccept} className="flex flex-col items-center gap-2 group">
                        <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center group-hover:bg-green-600 shadow-lg transition-transform group-hover:scale-110 animate-bounce">
                            <div className="icon-phone text-2xl"></div>
                        </div>
                        <span className="font-medium text-green-400">Atender</span>
                    </button>
                </div>
            </div>
            {/* Audio element for ringtone could go here */}
        </div>
    );
}
window.GlobalCallListener = GlobalCallListener;