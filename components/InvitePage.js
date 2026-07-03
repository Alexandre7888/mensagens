function InvitePage() {
    const db = window.firebaseDB;
    const [loading, setLoading] = React.useState(true);
    const [inviteData, setInviteData] = React.useState(null);
    const [targetData, setTargetData] = React.useState(null);
    const [error, setError] = React.useState(null);
    const [user, setUser] = React.useState(null);
    const [joining, setJoining] = React.useState(false);

    React.useEffect(() => {
        const init = async () => {
            const urlParams = new URLSearchParams(window.location.search);
            const inviteId = urlParams.get('id');

            if (!inviteId) {
                setError("Link de convite inválido ou ausente.");
                setLoading(false);
                return;
            }

            const userKey = localStorage.getItem("userkey");
            if (!userKey) {
                // Save redirect and go to login
                localStorage.setItem('redirect_after_login', window.location.href);
                window.location.href = 'index.html';
                return;
            }

            try {
                let uid = userKey;
                let userObj = { uid: userKey };
                if (typeof window.api !== 'undefined') {
                    const codeHubData = await window.api.getCodeHubUser(userKey);
                    if (codeHubData && !codeHubData.erro) {
                        uid = codeHubData.uid || userKey;
                        userObj = { ...codeHubData, id: uid };
                    }
                }
                setUser(userObj);

                if (db) {
                    const inviteSnap = await db.ref(`invites/${inviteId}`).once('value');
                    const invData = inviteSnap.val();

                    if (!invData) {
                        setError("Este convite não existe ou já foi apagado.");
                        setLoading(false);
                        return;
                    }

                    if (invData.expiresAt && Date.now() > invData.expiresAt) {
                        setError("Este convite expirou.");
                        setLoading(false);
                        return;
                    }

                    setInviteData(invData);

                    const targetRef = invData.type === 'group' ? `groups/${invData.targetId}` : `users/${invData.targetId}`;
                    const targetSnap = await db.ref(targetRef).once('value');
                    const tData = targetSnap.val();

                    if (!tData) {
                        setError("O alvo deste convite não foi encontrado.");
                    } else {
                        setTargetData({ ...tData, id: invData.targetId });
                    }
                }
            } catch (err) {
                setError("Erro ao carregar os dados do convite.");
                console.error(err);
            }
            setLoading(false);
        };
        init();
    }, [db]);

    const handleJoin = async () => {
        if (!user || !inviteData || !targetData || joining) return;
        setJoining(true);

        try {
            if (inviteData.type === 'group') {
                // Check if already in group
                const membership = await db.ref(`groups/${targetData.id}/members/${user.id}`).once('value');
                if (!membership.exists()) {
                    await db.ref(`groups/${targetData.id}/members/${user.id}`).set({ role: 'membro', joinedAt: Date.now() });
                    const updateData = { name: targetData.name, type: 'group', timestamp: Date.now() };
                    
                    if (targetData.communityId) {
                        updateData.communityId = targetData.communityId;
                        await db.ref(`communities/${targetData.communityId}/members/${user.id}`).set({ role: 'membro', joinedAt: Date.now() });
                        const commSnap = await db.ref(`communities/${targetData.communityId}`).once('value');
                        await db.ref(`users/${user.id}/communities/${targetData.communityId}`).set({ name: commSnap.val().name, role: 'membro', joinedAt: Date.now() });
                    }
                    await db.ref(`users/${user.id}/chats/${targetData.id}`).set(updateData);
                }
                window.location.href = `chat.html?chatId=${targetData.id}`;
            } else {
                // Private Chat
                const chatId = user.id < targetData.id ? `${user.id}_${targetData.id}` : `${targetData.id}_${user.id}`;
                
                await db.ref(`users/${user.id}/chats/${chatId}`).set({
                    name: targetData.name || targetData.username || 'Usuário',
                    type: 'private',
                    targetId: targetData.id,
                    timestamp: Date.now()
                });

                await db.ref(`users/${targetData.id}/chats/${chatId}`).set({
                    name: user.name || user.username || 'Usuário',
                    type: 'private',
                    targetId: user.id,
                    timestamp: Date.now()
                });

                window.location.href = `chat.html?chatId=${chatId}`;
            }
        } catch (err) {
            console.error(err);
            alert("Erro ao processar convite.");
            setJoining(false);
        }
    };

    if (loading) {
        return (
            <div className="flex h-screen items-center justify-center bg-gray-50">
                <div className="icon-loader text-4xl text-indigo-600 animate-spin"></div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex h-screen items-center justify-center bg-gray-50 p-4">
                <div className="bg-white rounded-3xl p-8 max-w-md w-full text-center shadow-xl">
                    <div className="w-20 h-20 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-6">
                        <div className="icon-circle-x text-4xl"></div>
                    </div>
                    <h2 className="text-2xl font-bold text-gray-800 mb-2">Ops!</h2>
                    <p className="text-gray-600 mb-8">{error}</p>
                    <button onClick={() => window.location.href = 'index.html'} className="w-full py-4 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-colors">
                        Voltar para o Início
                    </button>
                </div>
            </div>
        );
    }

    const isGroup = inviteData.type === 'group';

    return (
        <div className="flex h-screen items-center justify-center bg-gray-50 p-4">
            <div className="bg-white rounded-3xl overflow-hidden max-w-md w-full shadow-2xl animate-fade-in-up border border-gray-100 relative">
                
                {inviteData.isCustom && (
                    <div className="absolute top-4 right-4 bg-yellow-400 text-yellow-900 px-3 py-1 rounded-full text-xs font-bold shadow-sm flex items-center gap-1">
                        <div className="icon-star"></div> PREMIUM
                    </div>
                )}

                <div className={`h-32 ${isGroup ? 'bg-gradient-to-r from-indigo-600 to-purple-600' : 'bg-gradient-to-r from-emerald-500 to-teal-600'} relative`}>
                    <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 w-20 h-20 bg-white rounded-full p-1 shadow-md">
                        <div className={`w-full h-full rounded-full flex items-center justify-center text-3xl text-white font-bold ${isGroup ? 'bg-indigo-500' : 'bg-emerald-500'}`}>
                            {targetData.name ? targetData.name.charAt(0).toUpperCase() : (isGroup ? 'G' : 'U')}
                        </div>
                    </div>
                </div>
                
                <div className="pt-14 pb-8 px-6 text-center">
                    <h2 className="text-2xl font-bold text-gray-800 mb-1">{targetData.name || targetData.username || 'Desconhecido'}</h2>
                    <p className="text-gray-500 text-sm font-medium mb-8">
                        {isGroup ? 'Você foi convidado para participar deste grupo.' : 'Você foi convidado para uma conversa privada.'}
                    </p>

                    <button 
                        onClick={handleJoin}
                        disabled={joining}
                        className={`w-full py-4 rounded-xl font-bold text-lg text-white shadow-lg transition-transform hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-2 ${isGroup ? 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-600/30' : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/30'}`}
                    >
                        {joining ? (
                            <div className="icon-loader animate-spin"></div>
                        ) : (
                            <>
                                <div className={`icon-${isGroup ? 'users' : 'message-circle'}`}></div>
                                {isGroup ? 'Entrar no Grupo' : 'Iniciar Conversa'}
                            </>
                        )}
                    </button>
                    
                    <button onClick={() => window.location.href = 'index.html'} className="w-full mt-4 py-3 text-gray-500 font-bold hover:bg-gray-50 rounded-xl transition-colors">
                        Cancelar
                    </button>
                </div>
            </div>
        </div>
    );
}
window.InvitePage = InvitePage;