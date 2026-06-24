function BotInvite({ user, token }) {
    const db = window.firebaseDB;
    const [botData, setBotData] = React.useState(null);
    const [botId, setBotId] = React.useState(null);
    const [userGroups, setUserGroups] = React.useState([]);
    const [userCommunities, setUserCommunities] = React.useState([]);
    const [targetType, setTargetType] = React.useState('group'); // 'group' or 'community'
    const [selectedTarget, setSelectedTarget] = React.useState('');
    const [selectedRole, setSelectedRole] = React.useState('admin'); // 'membro' or 'admin'
    const [loading, setLoading] = React.useState(true);
    const [authorizing, setAuthorizing] = React.useState(false);
    const [error, setError] = React.useState(null);
    const [success, setSuccess] = React.useState(false);

    React.useEffect(() => {
        if (!db) return;
        const fetchDetails = async () => {
            try {
                // Obter info do bot pelo token
                const botSnap = await db.ref('users').orderByChild('inviteToken').equalTo(token).once('value');
                const val = botSnap.val();
                
                if (!val) {
                    setError("Convite inválido ou expirado.");
                    setLoading(false);
                    return;
                }
                
                const bId = Object.keys(val)[0];
                const bData = val[bId];

                if (!bData || !bData.isBot) {
                    setError("Bot não encontrado ou inválido.");
                    setLoading(false);
                    return;
                }
                
                setBotId(bId);
                setBotData(bData);

                // Obter grupos do usuário diretamente do nó principal
                const groupsSnap = await db.ref('groups').once('value');
                const groupsData = groupsSnap.val();
                if (groupsData) {
                    const ownedGroups = Object.keys(groupsData).filter(gid => {
                        const gData = groupsData[gid];
                        const isMemberAdmin = gData?.members && (gData.members[user.id] === 'admin' || gData.members[user.id] === 'owner' || gData.members[user.id]?.role === 'admin' || gData.members[user.id]?.role === 'owner');
                        return gData && (gData.createdBy === user.id || gData.ownerId === user.id || gData.admin === user.id || isMemberAdmin);
                    }).map(gid => ({ id: gid, name: groupsData[gid].name || groupsData[gid].groupName || 'Grupo' }));
                    setUserGroups(ownedGroups);
                }

                // Obter comunidades do usuário
                const commSnap = await db.ref('communities').once('value');
                const commData = commSnap.val();
                if (commData) {
                    const ownedComms = Object.keys(commData).filter(cid => {
                        const cData = commData[cid];
                        const role = cData?.members?.[user.id]?.role;
                        return cData && (cData.owner === user.id || role === 'owner' || role === 'admin');
                    }).map(cid => ({ id: cid, name: commData[cid].name || 'Comunidade' }));
                    setUserCommunities(ownedComms);
                }

                setLoading(false);
            } catch (err) {
                console.error(err);
                setError("Erro ao carregar dados do bot.");
                setLoading(false);
            }
        };
        fetchDetails();
    }, [db, token, user.id]);

    const handleAuthorize = async () => {
        if (!selectedTarget) return;
        setAuthorizing(true);
        try {
            if (targetType === 'group') {
                const groupMemberSnap = await db.ref(`groups/${selectedTarget}/members/${botId}`).once('value');
                if (groupMemberSnap.exists()) {
                    alert("O bot já faz parte deste grupo.");
                    setAuthorizing(false);
                    return;
                }

                await db.ref(`groups/${selectedTarget}/members/${botId}`).set({ role: selectedRole, joinedAt: Date.now() });
                
                // If admin, update cargos
                if (selectedRole === 'admin') {
                    const cargosSnap = await db.ref(`groups/${selectedTarget}/cargos/admins`).once('value');
                    const admins = cargosSnap.val() || [];
                    if (!admins.includes(botId)) {
                        await db.ref(`groups/${selectedTarget}/cargos/admins`).set([...admins, botId]);
                    }
                }
                
                const groupInfo = userGroups.find(g => g.id === selectedTarget);
                await db.ref(`users/${botId}/chats/${selectedTarget}`).set({
                    name: groupInfo.name,
                    type: 'group',
                    timestamp: Date.now()
                });

                await db.ref(`groups/${selectedTarget}/auditLog`).push({
                    timestamp: Date.now(),
                    user: user.name,
                    action: `Autorizou o bot @${botData.username} a entrar no grupo como ${selectedRole}.`
                });

                await db.ref(`chats/${selectedTarget}/messages`).push({
                    senderId: 'system',
                    text: `O bot @${botData.username} foi adicionado ao grupo como ${selectedRole}.`,
                    timestamp: Date.now(),
                    type: 'system'
                });

            } else if (targetType === 'community') {
                const commMemberSnap = await db.ref(`communities/${selectedTarget}/members/${botId}`).once('value');
                if (commMemberSnap.exists()) {
                    alert("O bot já faz parte desta comunidade.");
                    setAuthorizing(false);
                    return;
                }

                await db.ref(`communities/${selectedTarget}/members/${botId}`).set({ role: selectedRole, joinedAt: Date.now() });
                
                const commInfo = userCommunities.find(c => c.id === selectedTarget);
                await db.ref(`users/${botId}/communities/${selectedTarget}`).set({
                    name: commInfo.name,
                    role: selectedRole,
                    joinedAt: Date.now()
                });

                if (selectedRole === 'admin') {
                    const commAdminsSnap = await db.ref(`communities/${selectedTarget}/cargos/admins`).once('value');
                    const commAdmins = commAdminsSnap.val() || [];
                    if (!commAdmins.includes(botId)) {
                        await db.ref(`communities/${selectedTarget}/cargos/admins`).set([...commAdmins, botId]);
                    }
                }

                // Add to all groups in the community
                const commGroupsSnap = await db.ref(`communities/${selectedTarget}/groups`).once('value');
                const commGroups = commGroupsSnap.val();
                if (commGroups) {
                    for (const gId of Object.keys(commGroups)) {
                        await db.ref(`groups/${gId}/members/${botId}`).set({ role: selectedRole, joinedAt: Date.now() });
                        
                        if (selectedRole === 'admin') {
                            const groupAdminsSnap = await db.ref(`groups/${gId}/cargos/admins`).once('value');
                            const groupAdmins = groupAdminsSnap.val() || [];
                            if (!groupAdmins.includes(botId)) {
                                await db.ref(`groups/${gId}/cargos/admins`).set([...groupAdmins, botId]);
                            }
                        }

                        const groupSnap = await db.ref(`groups/${gId}`).once('value');
                        const gData = groupSnap.val();
                        
                        await db.ref(`users/${botId}/chats/${gId}`).set({
                            name: gData?.name || 'Grupo da Comunidade',
                            type: 'group',
                            communityId: selectedTarget,
                            timestamp: Date.now()
                        });

                        await db.ref(`chats/${gId}/messages`).push({
                            senderId: 'system',
                            text: `O bot @${botData.username} foi adicionado pela comunidade como ${selectedRole}.`,
                            timestamp: Date.now(),
                            type: 'system'
                        });
                    }
                }
            }

            setSuccess(true);
        } catch (err) {
            console.error(err);
            alert("Erro ao adicionar bot. Verifique suas permissões.");
        } finally {
            setAuthorizing(false);
        }
    };

    if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="icon-loader text-4xl animate-spin text-indigo-600"></div></div>;

    if (error) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-gray-50 text-center">
                <div className="icon-triangle-alert text-6xl text-red-500 mb-4"></div>
                <h1 className="text-2xl font-bold text-gray-800 mb-2">Erro</h1>
                <p className="text-gray-600 mb-6">{error}</p>
                <button onClick={() => window.location.href = 'index.html'} className="px-6 py-2 bg-indigo-600 text-white rounded-xl font-bold">Voltar ao Início</button>
            </div>
        );
    }

    if (success) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-gray-50 text-center">
                <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6 text-green-600 text-4xl">
                    <div className="icon-check"></div>
                </div>
                <h1 className="text-2xl font-bold text-gray-800 mb-2">Autorizado com Sucesso!</h1>
                <p className="text-gray-600 mb-6">O bot <b>@{botData.username}</b> foi adicionado ao grupo selecionado.</p>
                <button onClick={() => window.location.href = 'index.html'} className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700">Ir para os Meus Chats</button>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-gray-50">
            <div className="bg-white max-w-md w-full rounded-2xl shadow-xl border border-gray-100 p-6 animate-fade-in-up">
                <div className="text-center mb-6">
                    {botData.profilePicture ? (
                        <img src={botData.profilePicture} alt="Avatar" className="w-24 h-24 rounded-2xl object-cover border border-indigo-100 shadow-md mx-auto mb-4" />
                    ) : (
                        <div className="w-24 h-24 bg-indigo-100 text-indigo-600 rounded-2xl flex items-center justify-center text-4xl shadow-md mx-auto mb-4">
                            <div className="icon-bot"></div>
                        </div>
                    )}
                    <h2 className="text-2xl font-bold text-gray-800">{botData.name}</h2>
                    <p className="text-indigo-600 font-bold">@{botData.username}</p>
                </div>

                <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 mb-6 text-sm text-gray-600">
                    <p className="mb-2">O aplicativo <b>{botData.name}</b> está solicitando acesso ao seu grupo. Ele poderá ler mensagens, enviar mensagens e realizar ações automatizadas.</p>
                    {botData.description && (
                        <div className="mt-2 p-3 bg-white rounded-lg border border-gray-200">
                            <b>Sobre o bot:</b><br/>
                            <p className="mt-1 line-clamp-3 italic text-gray-500">{botData.description}</p>
                        </div>
                    )}
                </div>

                <div className="mb-4">
                    <label className="block text-sm font-bold text-gray-700 mb-2">Adicionar em:</label>
                    <div className="flex gap-2">
                        <button onClick={() => { setTargetType('group'); setSelectedTarget(''); }} className={`flex-1 py-2 rounded-xl font-bold transition-colors ${targetType === 'group' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                            Grupo
                        </button>
                        <button onClick={() => { setTargetType('community'); setSelectedTarget(''); }} className={`flex-1 py-2 rounded-xl font-bold transition-colors ${targetType === 'community' ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                            Comunidade
                        </button>
                    </div>
                </div>

                <div className="mb-4">
                    <label className="block text-sm font-bold text-gray-700 mb-2">Selecione o {targetType === 'group' ? 'grupo' : 'comunidade'}:</label>
                    {targetType === 'group' && userGroups.length === 0 && (
                        <div className="p-3 bg-red-50 text-red-600 rounded-xl text-sm border border-red-200">Você não tem grupos que possa administrar.</div>
                    )}
                    {targetType === 'community' && userCommunities.length === 0 && (
                        <div className="p-3 bg-red-50 text-red-600 rounded-xl text-sm border border-red-200">Você não tem comunidades que possa administrar.</div>
                    )}
                    
                    {((targetType === 'group' && userGroups.length > 0) || (targetType === 'community' && userCommunities.length > 0)) && (
                        <select 
                            value={selectedTarget} 
                            onChange={e => setSelectedTarget(e.target.value)} 
                            className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-medium text-gray-800"
                        >
                            <option value="">-- Escolha --</option>
                            {(targetType === 'group' ? userGroups : userCommunities).map(item => (
                                <option key={item.id} value={item.id}>{item.name}</option>
                            ))}
                        </select>
                    )}
                </div>

                <div className="mb-6">
                    <label className="block text-sm font-bold text-gray-700 mb-2">Cargo do Bot:</label>
                    <select 
                        value={selectedRole} 
                        onChange={e => setSelectedRole(e.target.value)} 
                        className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-medium text-gray-800"
                    >
                        <option value="membro">Membro (Padrão)</option>
                        <option value="admin">Administrador (Acesso Total)</option>
                    </select>
                    {selectedRole === 'admin' && (
                        <p className="text-xs text-red-500 mt-1 font-medium">Atenção: O bot terá permissão para gerenciar cargos e membros.</p>
                    )}
                </div>

                <div className="flex gap-3">
                    <button onClick={() => window.location.href='index.html'} className="flex-1 py-3 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition-colors">
                        Cancelar
                    </button>
                    <button 
                        onClick={handleAuthorize} 
                        disabled={authorizing || !selectedTarget} 
                        className="flex-1 py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-colors flex justify-center items-center gap-2"
                    >
                        {authorizing ? <div className="icon-loader animate-spin"></div> : 'Autorizar'}
                    </button>
                </div>
                
                <p className="text-[10px] text-center text-gray-400 mt-4">
                    Você deve ter permissões de administrador no grupo ou comunidade para adicionar novos membros.
                </p>
            </div>
        </div>
    );
}

window.BotInvite = BotInvite;