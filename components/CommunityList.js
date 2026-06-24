function CommunityList({ user, initialCommId }) {
    const db = window.firebaseDB;
    const [communities, setCommunities] = React.useState([]);
    const [showCreate, setShowCreate] = React.useState(false);
    const [name, setName] = React.useState('');
    const [desc, setDesc] = React.useState('');
    const [activeCommunity, setActiveCommunity] = React.useState(null);
    const [communityDetails, setCommunityDetails] = React.useState(null);
    const [inviteLink, setInviteLink] = React.useState('');
    const [allUsersInfo, setAllUsersInfo] = React.useState({});
    const [toastMessage, setToastMessage] = React.useState(null);
    
    // Group Management States
    const [showAddGroupModal, setShowAddGroupModal] = React.useState(false);
    const [userGroups, setUserGroups] = React.useState([]);
    const [selectedGroupToAdd, setSelectedGroupToAdd] = React.useState('');

    // Roles System States
    const [showRolesModal, setShowRolesModal] = React.useState(false);
    const [showRoleModal, setShowRoleModal] = React.useState(false);
    const [cargosData, setCargosData] = React.useState(null);
    const [editingRole, setEditingRole] = React.useState({ id: '', cor: '#FF0066', permissoes: [] });
    const [showAddMemberModal, setShowAddMemberModal] = React.useState(false);
    const [addMemberTargetRole, setAddMemberTargetRole] = React.useState('');
    const [isAdmin, setIsAdmin] = React.useState(false);

    // New states for the requested features
    const [commGroupsData, setCommGroupsData] = React.useState({});
    const [activeCommTab, setActiveCommTab] = React.useState('meus_grupos');
    const [pendingRequests, setPendingRequests] = React.useState({});
    
    // Add member by username
    const [showAddByUsernameModal, setShowAddByUsernameModal] = React.useState(false);
    const [addUsername, setAddUsername] = React.useState("");

    const AVAILABLE_PERMISSIONS = window.AVAILABLE_PERMISSIONS;

    React.useEffect(() => {
        if(!db) return;
        const ref = db.ref(`users/${user.id}/communities`);
        ref.on('value', snap => {
            const data = snap.val();
            if(data) {
                const list = Object.keys(data).map(k => ({id: k, ...data[k]}));
                setCommunities(list);
                
                if (initialCommId && !activeCommunity) {
                    const found = list.find(c => c.id === initialCommId);
                    if (found) setActiveCommunity(found);
                }
            } else {
                setCommunities([]);
            }
        });
        return () => ref.off();
    }, [user, db, initialCommId]);

    React.useEffect(() => {
        if (!activeCommunity || !db) return;

        db.ref('users').once('value').then(snap => {
            setAllUsersInfo(snap.val() || {});
        });

        const ref = db.ref(`communities/${activeCommunity.id}`);
        ref.on('value', snap => {
            const data = snap.val();
            if (data) {
                setCommunityDetails(data);
                if (data.groups) {
                    Object.keys(data.groups).forEach(groupId => {
                        db.ref(`groups/${groupId}`).once('value', gSnap => {
                            if(gSnap.val()) {
                                setCommGroupsData(prev => ({...prev, [groupId]: gSnap.val()}));
                            }
                        });
                    });
                }
            }
        });

        // Listen for requests to my groups
        db.ref('solicitacoes_grupo').on('value', snap => {
            const allReqs = snap.val() || {};
            setPendingRequests(allReqs);
        });

        db.ref(`communities/${activeCommunity.id}`).on('value', mainSnap => {
            const commData = mainSnap.val();
            if (!commData) return;
            const realOwner = commData.owner;
            
            db.ref(`communities/${activeCommunity.id}/cargos`).on('value', snap => {
                let data = snap.val();
                if (!data) {
                    data = { dono: realOwner || user.id, admins: [], moderadores: [], mutados: [], cargos_personalizados: {} };
                    db.ref(`communities/${activeCommunity.id}/cargos`).set(data);
                } else if (realOwner && data.dono !== realOwner) {
                    data.dono = realOwner;
                    db.ref(`communities/${activeCommunity.id}/cargos/dono`).set(realOwner);
                }
                setCargosData(data);
                setIsAdmin(data.dono === user.id || (data.admins && data.admins.includes(user.id)) || activeCommunity.role === 'owner');
            });
        });

        return () => {
            ref.off();
            db.ref(`communities/${activeCommunity.id}/cargos`).off();
        };
    }, [activeCommunity, db, user.id]);

    const showToast = (message, type = "success") => {
        setToastMessage({ message, type });
        setTimeout(() => setToastMessage(null), 3000);
    };

    const getUserName = (uid) => {
        if (uid === user.id) return 'Você';
        return allUsersInfo[uid]?.name || allUsersInfo[uid]?.username || 'Usuário';
    };

    const removerDoCargoAtual = async (uid) => {
        if (!cargosData) return;
        const updates = {};
        if (cargosData.admins && cargosData.admins.includes(uid)) updates['admins'] = cargosData.admins.filter(id => id !== uid);
        if (cargosData.moderadores && cargosData.moderadores.includes(uid)) updates['moderadores'] = cargosData.moderadores.filter(id => id !== uid);
        if (cargosData.mutados && cargosData.mutados.includes(uid)) updates['mutados'] = cargosData.mutados.filter(id => id !== uid);
        if (cargosData.cargos_personalizados) {
            for (const [cName, cData] of Object.entries(cargosData.cargos_personalizados)) {
                if (cData.membros && cData.membros.includes(uid)) updates[`cargos_personalizados/${cName}/membros`] = cData.membros.filter(id => id !== uid);
            }
        }
        if (Object.keys(updates).length > 0) await db.ref(`communities/${activeCommunity.id}/cargos`).update(updates);
    };

    const adicionarAoCargo = async (uid, novoCargo) => {
        if (!isAdmin && cargosData?.dono !== user.id) return showToast("Sem permissão", "error");
        await removerDoCargoAtual(uid);
        if (novoCargo === 'membro') return showToast("Membro atualizado!");
        
        const refPath = `communities/${activeCommunity.id}/cargos`;
        if (['admins', 'moderadores', 'mutados'].includes(novoCargo)) {
            const currentList = cargosData[novoCargo] || [];
            if (!currentList.includes(uid)) await db.ref(`${refPath}/${novoCargo}`).set([...currentList, uid]);
        } else {
            const roleData = cargosData.cargos_personalizados?.[novoCargo];
            if (roleData) {
                const currentMembros = roleData.membros || [];
                if (!currentMembros.includes(uid)) await db.ref(`${refPath}/cargos_personalizados/${novoCargo}/membros`).set([...currentMembros, uid]);
            }
        }
        showToast("Cargo atribuído!");
        setShowAddMemberModal(false);
    };

    const handleSaveCustomRole = async () => {
        if (!editingRole.id.trim()) return;
        const roleId = editingRole.id.trim();
        await db.ref(`communities/${activeCommunity.id}/cargos/cargos_personalizados/${roleId}`).update({ cor: editingRole.cor, permissoes: editingRole.permissoes });
        setShowRoleModal(false);
        showToast("Cargo salvo com sucesso!");
    };

    const handleAddByUsername = async () => {
        const sUser = addUsername.trim().toLowerCase().replace('@', '');
        if (!sUser) return;
        try {
            const usersRef = await db.ref('users').orderByChild('username').equalTo(sUser).once('value');
            const data = usersRef.val();
            if (data) {
                const targetId = Object.keys(data)[0];
                if (communityDetails.members && communityDetails.members[targetId]) {
                    showToast("Usuário já está na comunidade!", "error");
                    return;
                }
                await db.ref(`communities/${activeCommunity.id}/members/${targetId}`).set({ role: 'membro', joinedAt: Date.now() });
                await db.ref(`users/${targetId}/communities/${activeCommunity.id}`).set({
                    name: activeCommunity.name,
                    role: 'membro',
                    joinedAt: Date.now()
                });
                showToast("Usuário adicionado com sucesso!", "success");
                setShowAddByUsernameModal(false);
                setAddUsername("");
            } else {
                showToast("Usuário não encontrado.", "error");
            }
        } catch(e) {
            showToast("Erro ao buscar.", "error");
        }
    };

    const handleCreate = async () => {
        if(!name.trim()) return;
        const commId = `comm_${Date.now()}`;
        
        const defaultRoles = {
            admin: {
                name: 'Administrador',
                color: '#ef4444',
                canAddGroup: true,
                canSendMessages: true,
                slowModeSeconds: 0,
                canMakeCalls: true,
                canManageMembers: true
            },
            membro: {
                name: 'Membro Padrão',
                color: '#6b7280',
                canAddGroup: false,
                canSendMessages: true,
                slowModeSeconds: 5,
                canMakeCalls: false,
                canManageMembers: false
            }
        };

        await db.ref(`communities/${commId}`).set({
            name,
            description: desc,
            owner: user.id,
            createdAt: Date.now(),
            members: { [user.id]: { role: 'owner', joinedAt: Date.now() } },
            roles: defaultRoles
        });

        await db.ref(`users/${user.id}/communities/${commId}`).set({
            name,
            role: 'owner',
            joinedAt: Date.now()
        });

        setShowCreate(false);
        setName('');
        setDesc('');
    };

    return (
        <div className="flex h-[100dvh] w-full bg-gray-50 flex-col overflow-hidden">
            {!activeCommunity && (
                <header className="px-4 py-3 bg-white shadow-sm flex items-center gap-4 z-10 sticky top-0">
                    <button onClick={() => window.location.href='index.html'} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                        <div className="icon-arrow-left text-xl text-gray-600"></div>
                    </button>
                    <h1 className="text-xl font-bold text-gray-800">Comunidades</h1>
                </header>
            )}
            
            <main className={`flex-1 overflow-y-auto ${activeCommunity ? 'bg-gray-50' : 'p-4 sm:p-6'}`}>
                <div className={`${activeCommunity ? 'w-full' : 'max-w-3xl mx-auto h-full'}`}>
                    {!activeCommunity ? (
                        <>
                            <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-2xl p-6 mb-8 text-white shadow-lg relative overflow-hidden">
                                <div className="relative z-10">
                                    <h2 className="text-2xl font-bold mb-2">Reúna seus Grupos</h2>
                                    <p className="text-indigo-100 max-w-sm mb-6">As comunidades ajudam a organizar vários grupos sob um único guarda-chuva para administrá-los com facilidade.</p>
                                    <button onClick={() => setShowCreate(true)} className="px-6 py-3 bg-white text-indigo-700 rounded-xl font-bold hover:bg-gray-50 shadow-md transition-colors flex items-center gap-2">
                                        <div className="icon-plus-circle text-xl"></div> Criar Comunidade
                                    </button>
                                </div>
                                <div className="absolute right-0 top-0 opacity-10 transform translate-x-1/4 -translate-y-1/4">
                                    <div className="icon-network text-[200px]"></div>
                                </div>
                            </div>
                            
                            <h3 className="text-lg font-bold text-gray-800 mb-4 px-2">Suas Comunidades</h3>
                            
                            {communities.length === 0 ? (
                                <div className="text-center py-12 px-4 bg-white rounded-2xl border border-gray-200 border-dashed">
                                    <div className="icon-folder-open text-5xl text-gray-300 mb-4 mx-auto"></div>
                                    <p className="text-gray-500 font-medium">Você ainda não faz parte de nenhuma comunidade.</p>
                                </div>
                            ) : (
                                <div className="grid gap-3">
                                    {communities.map(c => (
                                        <div key={c.id} onClick={() => setActiveCommunity(c)} className="p-4 bg-white rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between hover:shadow-md hover:border-indigo-100 transition-all cursor-pointer group">
                                            <div className="flex items-center gap-4">
                                                <div className="w-14 h-14 bg-gradient-to-br from-blue-50 to-indigo-50 border border-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center font-bold text-2xl group-hover:scale-105 transition-transform shadow-sm">
                                                    {c.name.charAt(0).toUpperCase()}
                                                </div>
                                                <div>
                                                    <h3 className="font-bold text-gray-800 text-lg group-hover:text-indigo-700 transition-colors">{c.name}</h3>
                                                    <p className="text-sm font-medium text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded inline-block mt-1">Cargo: {c.role}</p>
                                                </div>
                                            </div>
                                            <div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center group-hover:bg-indigo-50 transition-colors">
                                                <div className="icon-chevron-right text-gray-400 group-hover:text-indigo-600"></div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </>
                    ) : (
                        <div className="flex flex-col min-h-full pb-20">
                            {/* Community Header Parallax/Cover */}
                            <div className="relative h-64 bg-gradient-to-br from-indigo-800 via-blue-700 to-indigo-900 flex flex-col justify-end p-6 text-white overflow-hidden shadow-lg">
                                <div className="absolute inset-0 opacity-20 bg-[url('https://images.unsplash.com/photo-1557683316-973673baf926?q=80&w=1000')] bg-cover bg-center"></div>
                                <div className="absolute top-4 left-4 z-20">
                                    <button onClick={() => {setActiveCommunity(null); setCommunityDetails(null); setInviteLink('');}} className="w-10 h-10 bg-black/30 hover:bg-black/50 backdrop-blur-md rounded-full flex items-center justify-center transition-colors">
                                        <div className="icon-arrow-left text-xl"></div>
                                    </button>
                                </div>
                                <div className="relative z-10 flex items-end gap-5">
                                    <div className="w-20 h-20 bg-white text-indigo-700 rounded-2xl flex items-center justify-center font-bold text-4xl shadow-xl border-4 border-white/20 backdrop-blur-sm">
                                        {activeCommunity.name.charAt(0).toUpperCase()}
                                    </div>
                                    <div className="pb-1">
                                        <h2 className="text-3xl font-extrabold shadow-black/50 drop-shadow-md">{activeCommunity.name}</h2>
                                        <div className="text-indigo-100 font-medium mt-1 flex items-center gap-2">
                                            <div className="icon-users text-sm"></div>
                                            {communityDetails ? Object.keys(communityDetails.members || {}).length : 1} membros
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="max-w-4xl mx-auto w-full px-4 sm:px-6 -mt-6 relative z-20">
                                
                                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
                                    <h4 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-2">Descrição</h4>
                                    <p className="text-gray-700">{communityDetails?.description || 'Nenhuma descrição fornecida.'}</p>
                                    
                                    <div className="mt-6 pt-6 border-t border-gray-100">
                                        <h4 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4">Ações Administrativas</h4>
                                        <div className="flex flex-col sm:flex-row gap-3">
                                            {activeCommunity.role === 'owner' || activeCommunity.role === 'admin' || isAdmin ? (
                                                <>
                                                    <button onClick={() => setShowRolesModal(true)} className="flex-1 py-3 px-4 bg-purple-50 text-purple-700 rounded-xl font-bold hover:bg-purple-100 transition-colors flex items-center justify-center gap-2">
                                                        <div className="icon-shield text-lg"></div> Cargos e Permissões
                                                    </button>
                                                    <button onClick={() => {
                                                        const link = `${window.location.origin}${window.location.pathname.replace('community.html','')}` + `index.html?joinComm=${activeCommunity.id}`;
                                                        setInviteLink(link);
                                                    }} className="flex-1 py-3 px-4 bg-indigo-50 text-indigo-700 rounded-xl font-bold hover:bg-indigo-100 transition-colors flex items-center justify-center gap-2">
                                                        <div className="icon-link text-lg"></div> Gerar Link
                                                    </button>
                                                    <button onClick={() => setShowAddByUsernameModal(true)} className="flex-1 py-3 px-4 bg-green-50 text-green-700 rounded-xl font-bold hover:bg-green-100 transition-colors flex items-center justify-center gap-2">
                                                        <div className="icon-user-plus text-lg"></div> Adicionar por @
                                                    </button>
                                                </>
                                            ) : (
                                                <div className="flex-1 py-3 px-4 bg-gray-50 text-gray-400 rounded-xl font-medium flex items-center justify-center gap-2 border border-gray-100">
                                                    <div className="icon-lock text-lg"></div> Apenas admins criam links ou gerenciam cargos
                                                </div>
                                            )}
                                        </div>

                                        {inviteLink && (
                                            <div className="mt-4 bg-green-50 border border-green-200 rounded-xl p-4 animate-fade-in-up">
                                                <p className="text-xs text-green-800 font-bold mb-2">Link da Comunidade Gerado!</p>
                                                <div className="flex gap-2">
                                                    <input type="text" readOnly value={inviteLink} className="flex-1 bg-white border border-green-200 rounded-lg px-3 py-2 text-sm outline-none text-gray-600" />
                                                    <button onClick={() => navigator.clipboard.writeText(inviteLink)} className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-bold transition-colors">
                                                        Copiar
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="flex items-center justify-between mb-4 mt-8 px-2">
                                    <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                                        📌 GRUPOS DA COMUNIDADE
                                    </h3>
                                    {(activeCommunity.role === 'owner' || activeCommunity.role === 'admin' || isAdmin) && (
                                        <button onClick={() => {
                                            db.ref(`users/${user.id}/chats`).once('value', snap => {
                                                const data = snap.val();
                                                if (data) {
                                                    const groups = Object.keys(data).map(k => ({id: k, ...data[k]})).filter(c => c.type === 'group');
                                                    setUserGroups(groups);
                                                    setShowAddGroupModal(true);
                                                } else {
                                                    setUserGroups([]);
                                                    setShowAddGroupModal(true);
                                                }
                                            });
                                        }} className="text-sm font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 bg-indigo-50 px-3 py-1.5 rounded-lg">
                                            <div className="icon-plus text-lg"></div> Adicionar Grupo
                                        </button>
                                    )}
                                </div>

                                {/* Requests Notifications (For Group Owners) */}
                                {Object.keys(pendingRequests).map(gId => {
                                    const reqs = pendingRequests[gId];
                                    const gData = commGroupsData[gId];
                                    // Check if I am the owner or admin of this group
                                    if (gData && gData.members && gData.members[user.id] && (gData.members[user.id].role === 'admin' || gData.members[user.id].role === 'owner')) {
                                        return Object.keys(reqs).map(reqUid => {
                                            if (reqs[reqUid].status === 'pendente') {
                                                return (
                                                    <div key={`${gId}_${reqUid}`} className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 mb-4 flex items-center justify-between">
                                                        <div>
                                                            <p className="text-sm text-yellow-800"><b>{reqs[reqUid].nomeUsuario}</b> pediu para entrar no grupo <b>"{gData.name}"</b></p>
                                                        </div>
                                                        <div className="flex gap-2">
                                                            <button onClick={async () => {
                                                                // Accept
                                                                await db.ref(`groups/${gId}/members/${reqUid}`).set({ role: 'member', joinedAt: Date.now() });
                                                                await db.ref(`users/${reqUid}/chats/${gId}`).set({ name: gData.name, type: 'group', timestamp: Date.now(), communityId: activeCommunity.id });
                                                                
                                                                // Make sure they are in community
                                                                await db.ref(`communities/${activeCommunity.id}/members/${reqUid}`).set({ role: 'membro', joinedAt: Date.now() });
                                                                await db.ref(`users/${reqUid}/communities/${activeCommunity.id}`).set({ name: activeCommunity.name, role: 'membro', joinedAt: Date.now() });
                                                                
                                                                await db.ref(`solicitacoes_grupo/${gId}/${reqUid}`).remove();
                                                                showToast("Usuário aceito!");
                                                            }} className="px-3 py-1 bg-green-500 text-white font-bold rounded hover:bg-green-600">✅ ACEITAR</button>
                                                            <button onClick={async () => {
                                                                await db.ref(`solicitacoes_grupo/${gId}/${reqUid}`).remove();
                                                                showToast("Recusado.");
                                                            }} className="px-3 py-1 bg-red-500 text-white font-bold rounded hover:bg-red-600">❌ RECUSAR</button>
                                                        </div>
                                                    </div>
                                                )
                                            }
                                            return null;
                                        });
                                    }
                                    return null;
                                })}

                                {communityDetails?.groups && Object.keys(communityDetails.groups).length > 0 ? (
                                    <>
                                        <div className="flex bg-gray-100 p-1 rounded-xl mb-4">
                                            <button onClick={() => setActiveCommTab('meus_grupos')} className={`flex-1 py-2 text-sm font-bold rounded-lg transition-colors ${activeCommTab === 'meus_grupos' ? 'bg-white shadow text-indigo-700' : 'text-gray-500 hover:text-gray-700'}`}>
                                                MEUS GRUPOS
                                            </button>
                                            <button onClick={() => setActiveCommTab('disponiveis')} className={`flex-1 py-2 text-sm font-bold rounded-lg transition-colors ${activeCommTab === 'disponiveis' ? 'bg-white shadow text-indigo-700' : 'text-gray-500 hover:text-gray-700'}`}>
                                                GRUPOS DISPONÍVEIS
                                            </button>
                                        </div>

                                        <div className="grid gap-3">
                                            {Object.keys(communityDetails.groups).map(groupId => {
                                                const gData = commGroupsData[groupId];
                                                const cGroup = communityDetails.groups[groupId];
                                                if (!gData) return null;

                                                const isMember = gData.members && gData.members[user.id];
                                                const memberCount = gData.members ? Object.keys(gData.members).length : 0;

                                                if (activeCommTab === 'meus_grupos' && isMember) {
                                                    return (
                                                        <div key={groupId} className="bg-white p-4 rounded-xl border border-indigo-100 shadow-sm flex items-center justify-between">
                                                            <div>
                                                                <h4 className="font-bold text-gray-800 text-lg flex items-center gap-2">🎮 {gData.name}</h4>
                                                                <p className="text-sm text-gray-500">{memberCount} membros • Você é membro</p>
                                                            </div>
                                                            <button onClick={() => window.location.href=`chat.html?chatId=${groupId}`} className="px-4 py-2 bg-indigo-50 text-indigo-700 font-bold rounded-lg hover:bg-indigo-100 flex items-center gap-2 transition-colors">
                                                                <div className="icon-message-circle"></div> ENTRAR
                                                            </button>
                                                        </div>
                                                    )
                                                }
                                                
                                                if (activeCommTab === 'disponiveis' && !isMember) {
                                                    const requested = pendingRequests[groupId] && pendingRequests[groupId][user.id];
                                                    
                                                    return (
                                                        <div key={groupId} className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between opacity-80 hover:opacity-100 transition-opacity">
                                                            <div>
                                                                <h4 className="font-bold text-gray-800 text-lg flex items-center gap-2">🎮 {gData.name}</h4>
                                                                <p className="text-sm text-gray-500">{memberCount} membros • Você NÃO é membro</p>
                                                            </div>
                                                            {requested ? (
                                                                <span className="px-4 py-2 bg-yellow-50 text-yellow-700 font-bold rounded-lg border border-yellow-200 text-sm">
                                                                    ⏳ PENDENTE
                                                                </span>
                                                            ) : (
                                                                <button onClick={async () => {
                                                                    await db.ref(`solicitacoes_grupo/${groupId}/${user.id}`).set({
                                                                        status: 'pendente',
                                                                        data: Date.now(),
                                                                        nomeUsuario: user.name
                                                                    });
                                                                    showToast("Solicitação enviada!");
                                                                }} className="px-4 py-2 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 flex items-center gap-2 transition-colors text-sm shadow">
                                                                    <div className="icon-bell"></div> PEDIR ENTRADA
                                                                </button>
                                                            )}
                                                        </div>
                                                    )
                                                }
                                                return null;
                                            })}
                                        </div>
                                    </>
                                ) : (
                                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center">
                                        <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
                                            <div className="icon-folder-open text-4xl text-gray-300"></div>
                                        </div>
                                        <h4 className="text-lg font-bold text-gray-700 mb-2">Nenhum grupo adicionado</h4>
                                        <p className="text-gray-500 max-w-sm mx-auto">Os grupos adicionados aparecerão aqui para todos os membros da comunidade.</p>
                                    </div>
                                )}

                            </div>
                        </div>
                    )}
                </div>
            </main>

            {showRolesModal && cargosData && (
                <div className="fixed inset-0 bg-gray-900 bg-opacity-50 backdrop-blur-sm flex items-center justify-center z-[50] p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden animate-fade-in-up">
                        <div className="flex justify-between items-center p-6 border-b border-gray-100 bg-gray-50">
                            <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                                <div className="icon-shield text-indigo-600"></div> 
                                Cargos Globais da Comunidade
                            </h2>
                            <button onClick={() => setShowRolesModal(false)} className="text-gray-400 hover:text-gray-600 bg-white p-2 rounded-full shadow-sm">
                                <div className="icon-x text-xl"></div>
                            </button>
                        </div>
                        
                        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-gray-50">
                            {/* ADMINS */}
                            <div className="bg-white border-2 border-red-200 rounded-xl overflow-hidden shadow-sm">
                                <div className="bg-red-50 px-4 py-2 border-b border-red-200 font-bold text-red-800 flex justify-between items-center">
                                    <span>🛡️ ADMIN ({cargosData.admins?.length || 0})</span>
                                </div>
                                <div className="p-4 space-y-3">
                                    {(cargosData.admins || []).map(uid => (
                                        <div key={uid} className="flex justify-between items-center pl-4 border-l-2 border-red-200">
                                            <span className="font-medium text-gray-700">{getUserName(uid)}</span>
                                            {isAdmin && uid !== user.id && (
                                                <button onClick={() => adicionarAoCargo(uid, 'membro')} className="text-xs text-red-600 font-bold hover:bg-red-50 px-2 py-1 rounded">[REMOVER]</button>
                                            )}
                                        </div>
                                    ))}
                                    {isAdmin && (
                                        <button onClick={() => { setAddMemberTargetRole('admins'); setShowAddMemberModal(true); }} className="text-sm font-bold text-red-600 mt-2 hover:underline">
                                            [➕ ADICIONAR ADMIN]
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* MODERADORES */}
                            <div className="bg-white border-2 border-green-200 rounded-xl overflow-hidden shadow-sm">
                                <div className="bg-green-50 px-4 py-2 border-b border-green-200 font-bold text-green-800 flex justify-between items-center">
                                    <span>⭐ MODERADOR ({cargosData.moderadores?.length || 0})</span>
                                </div>
                                <div className="p-4 space-y-3">
                                    {(cargosData.moderadores || []).map(uid => (
                                        <div key={uid} className="flex justify-between items-center pl-4 border-l-2 border-green-200">
                                            <span className="font-medium text-gray-700">{getUserName(uid)}</span>
                                            {isAdmin && (
                                                <button onClick={() => adicionarAoCargo(uid, 'membro')} className="text-xs text-red-600 font-bold hover:bg-red-50 px-2 py-1 rounded">[REMOVER]</button>
                                            )}
                                        </div>
                                    ))}
                                    {isAdmin && (
                                        <button onClick={() => { setAddMemberTargetRole('moderadores'); setShowAddMemberModal(true); }} className="text-sm font-bold text-green-600 mt-2 hover:underline">
                                            [➕ ADICIONAR MODERADOR]
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* CARGOS PERSONALIZADOS */}
                            <div className="bg-white border-2 border-indigo-200 rounded-xl overflow-hidden shadow-sm">
                                <div className="bg-indigo-50 px-4 py-2 border-b border-indigo-200 font-bold text-indigo-800 flex justify-between items-center">
                                    <span>🎨 CARGOS PERSONALIZADOS GLOBAIS</span>
                                </div>
                                <div className="p-4 space-y-6">
                                    {Object.keys(cargosData.cargos_personalizados || {}).length === 0 && (
                                        <p className="text-sm text-gray-500 italic">Nenhum cargo personalizado criado nesta comunidade.</p>
                                    )}
                                    {Object.entries(cargosData.cargos_personalizados || {}).map(([cName, cData]) => (
                                        <div key={cName} className="border border-gray-100 rounded-lg p-3">
                                            <div className="flex justify-between items-center mb-3">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-3 h-3 rounded-full" style={{backgroundColor: cData.cor}}></div>
                                                    <span className="font-bold text-gray-800">{cName.toUpperCase()}</span>
                                                </div>
                                                {isAdmin && (
                                                    <div className="flex gap-2">
                                                        <button onClick={() => { setEditingRole({id: cName, cor: cData.cor, permissoes: cData.permissoes || []}); setShowRoleModal(true); }} className="text-xs text-indigo-600 font-bold hover:underline">EDITAR</button>
                                                        <button onClick={async () => { if(window.confirm("Apagar cargo global?")) await db.ref(`communities/${activeCommunity.id}/cargos/cargos_personalizados/${cName}`).remove(); }} className="text-xs text-red-600 font-bold hover:underline">EXCLUIR</button>
                                                    </div>
                                                )}
                                            </div>
                                            <div className="pl-4 border-l-2 border-gray-200 space-y-2">
                                                {(cData.membros || []).map(uid => (
                                                    <div key={uid} className="flex justify-between items-center">
                                                        <span className="text-sm font-medium text-gray-700">{getUserName(uid)}</span>
                                                        {isAdmin && <button onClick={() => adicionarAoCargo(uid, 'membro')} className="text-xs text-red-600 font-bold hover:bg-red-50 px-2 py-1 rounded">[REMOVER]</button>}
                                                    </div>
                                                ))}
                                                {isAdmin && <button onClick={() => { setAddMemberTargetRole(cName); setShowAddMemberModal(true); }} className="text-sm font-bold text-indigo-600 mt-2 hover:underline">[➕ ADICIONAR]</button>}
                                            </div>
                                        </div>
                                    ))}
                                    {isAdmin && (
                                        <div className="pt-4 border-t border-gray-100">
                                            <button onClick={() => { setEditingRole({ id: '', cor: '#AA00FF', permissoes: ['enviar_mensagem', 'enviar_foto'] }); setShowRoleModal(true); }} className="w-full py-3 bg-gray-900 text-white rounded-xl font-bold hover:bg-black transition-colors">
                                                [➕ CRIAR CARGO GLOBLAL PERSONALIZADO]
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Sub-modals for Community roles */}
            {showAddMemberModal && communityDetails && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl animate-fade-in-up">
                        <div className="p-4 border-b bg-gray-50 flex justify-between items-center">
                            <h3 className="font-bold text-gray-800">Adicionar à {addMemberTargetRole.toUpperCase()}</h3>
                            <button onClick={() => setShowAddMemberModal(false)} className="text-gray-500 hover:bg-gray-200 p-1 rounded-full"><div className="icon-x"></div></button>
                        </div>
                        <div className="max-h-64 overflow-y-auto p-2">
                            {Object.keys(communityDetails.members || {}).filter(uid => uid !== user.id).map(uid => (
                                <div key={uid} onClick={() => adicionarAoCargo(uid, addMemberTargetRole)} className="p-3 hover:bg-indigo-50 rounded-xl cursor-pointer flex items-center justify-between group">
                                    <span className="font-medium text-gray-800">{getUserName(uid)}</span>
                                    <span className="text-indigo-600 opacity-0 group-hover:opacity-100 font-bold text-sm">SELECIONAR</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {showRoleModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-hidden shadow-2xl flex flex-col animate-fade-in-up">
                        <div className="p-4 border-b bg-gray-50 flex justify-between items-center text-center">
                            <h3 className="font-bold text-gray-800 w-full">✨ {editingRole.id ? 'EDITAR' : 'CRIAR NOVO'} CARGO GLOBAL</h3>
                        </div>
                        <div className="p-6 overflow-y-auto flex-1 space-y-6">
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-2">Nome do cargo:</label>
                                <input type="text" value={editingRole.id} onChange={e => setEditingRole({...editingRole, id: e.target.value.replace(/[^a-zA-Z0-9_]/g, '')})} disabled={!!editingRole.id && cargosData.cargos_personalizados?.[editingRole.id]} placeholder="Ex: VIP" className="w-full p-3 border border-gray-300 rounded-xl outline-none uppercase font-bold text-gray-800"/>
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-2">Cor do cargo:</label>
                                <div className="flex gap-4 items-center">
                                    <input type="color" value={editingRole.cor} onChange={e => setEditingRole({...editingRole, cor: e.target.value})} className="w-12 h-12 rounded cursor-pointer border-0 p-0"/>
                                    <span className="font-mono text-gray-600 bg-gray-100 px-3 py-1 rounded">{editingRole.cor.toUpperCase()}</span>
                                </div>
                            </div>
                            <div className="border-t border-gray-200 pt-4">
                                <label className="block text-sm font-bold text-gray-700 mb-3">PERMISSÕES GLOBAIS:</label>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    {AVAILABLE_PERMISSIONS.map(perm => (
                                        <label key={perm.id} className="flex items-center gap-3 cursor-pointer p-2 hover:bg-gray-50 rounded-lg">
                                            <input type="checkbox" checked={editingRole.permissoes.includes(perm.id)} onChange={e => {
                                                const next = e.target.checked ? [...editingRole.permissoes, perm.id] : editingRole.permissoes.filter(p => p !== perm.id);
                                                setEditingRole({...editingRole, permissoes: next});
                                            }} className="w-5 h-5 accent-indigo-600" />
                                            <span className="text-sm font-medium text-gray-700">{perm.label}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        </div>
                        <div className="p-4 border-t bg-gray-50 flex gap-3">
                            <button onClick={() => setShowRoleModal(false)} className="flex-1 py-3 bg-gray-200 text-gray-700 font-bold rounded-xl hover:bg-gray-300">CANCELAR</button>
                            <button onClick={handleSaveCustomRole} disabled={!editingRole.id} className="flex-1 py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 disabled:opacity-50">SALVAR</button>
                        </div>
                    </div>
                </div>
            )}

            {toastMessage && (
                <div className={`fixed bottom-6 right-4 p-4 rounded-xl shadow-2xl text-white font-medium z-[100] flex items-center gap-2 transform transition-all ${toastMessage.type === 'error' ? 'bg-red-500' : 'bg-gray-800'}`}>
                    <div className={`icon-${toastMessage.type === 'error' ? 'alert-circle' : 'check-circle'} text-xl`}></div>
                    {toastMessage.message}
                </div>
            )}

            {showAddByUsernameModal && (
                <div className="fixed inset-0 bg-gray-900 bg-opacity-50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm animate-fade-in-up">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-bold text-gray-800">Adicionar Membro</h2>
                            <button onClick={() => setShowAddByUsernameModal(false)} className="text-gray-400 hover:text-gray-600">
                                <div className="icon-x text-xl"></div>
                            </button>
                        </div>
                        <div className="relative mb-6">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">@</span>
                            <input 
                                type="text" 
                                placeholder="username" 
                                value={addUsername}
                                onChange={e => setAddUsername(e.target.value)}
                                className="w-full pl-8 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                            />
                        </div>
                        <button onClick={handleAddByUsername} disabled={!addUsername.trim()} className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 disabled:opacity-50 transition-colors">
                            Adicionar à Comunidade
                        </button>
                    </div>
                </div>
            )}

            {showAddGroupModal && (
                <div className="fixed inset-0 bg-gray-900 bg-opacity-50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md animate-fade-in-up">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-bold text-gray-800">Adicionar Grupo</h2>
                            <button onClick={() => setShowAddGroupModal(false)} className="text-gray-400 hover:text-gray-600">
                                <div className="icon-x text-xl"></div>
                            </button>
                        </div>
                        <div className="space-y-4 mb-6">
                            {userGroups.length === 0 ? (
                                <p className="text-gray-500 text-center py-4 bg-gray-50 rounded-xl">Você não possui grupos para adicionar.</p>
                            ) : (
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Selecione um grupo</label>
                                    <select value={selectedGroupToAdd} onChange={e => setSelectedGroupToAdd(e.target.value)} className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none">
                                        <option value="">Selecione...</option>
                                        {userGroups.map(g => {
                                            const isAlreadyAdded = communityDetails?.groups && communityDetails.groups[g.id];
                                            return (
                                                <option key={g.id} value={g.id} disabled={isAlreadyAdded}>
                                                    {g.name} {isAlreadyAdded ? '(Já adicionado)' : ''}
                                                </option>
                                            );
                                        })}
                                    </select>
                                </div>
                            )}
                        </div>
                        <button onClick={async () => {
                            if (!selectedGroupToAdd) return;
                            const groupInfo = userGroups.find(g => g.id === selectedGroupToAdd);
                            if (!groupInfo) return;
                            
                            await db.ref(`communities/${activeCommunity.id}/groups/${groupInfo.id}`).set({
                                name: groupInfo.name,
                                addedAt: Date.now(),
                                addedBy: user.id
                            });
                            
                            // RULE 2: TRANSFER MEMBERS & SET OWNER AS ADMIN
                            const groupSnap = await db.ref(`groups/${groupInfo.id}`).once('value');
                            const gData = groupSnap.val();
                            
                            if (gData && gData.members) {
                                for (const memberId of Object.keys(gData.members)) {
                                    // Add member to community
                                    await db.ref(`communities/${activeCommunity.id}/members/${memberId}`).set({ role: 'membro', joinedAt: Date.now() });
                                    await db.ref(`users/${memberId}/communities/${activeCommunity.id}`).set({
                                        name: activeCommunity.name,
                                        role: 'membro',
                                        joinedAt: Date.now()
                                    });
                                    // Update their chat reference to hide it from main list
                                    await db.ref(`users/${memberId}/chats/${groupInfo.id}`).update({ communityId: activeCommunity.id });
                                }

                                // Set group owner as community admin
                                if (gData.members) {
                                    const owners = Object.keys(gData.members).filter(uid => gData.members[uid].role === 'admin' || gData.members[uid].role === 'owner');
                                    // Or fetch from cargos
                                    const cargosSnap = await db.ref(`groups/${groupInfo.id}/cargos/dono`).once('value');
                                    const dono = cargosSnap.val();
                                    if (dono) {
                                        const commAdminsSnap = await db.ref(`communities/${activeCommunity.id}/cargos/admins`).once('value');
                                        const commAdmins = commAdminsSnap.val() || [];
                                        if (!commAdmins.includes(dono)) {
                                            await db.ref(`communities/${activeCommunity.id}/cargos/admins`).set([...commAdmins, dono]);
                                        }
                                    }
                                }
                            }

                            // Adicionar o ID da comunidade no próprio grupo
                            await db.ref(`groups/${groupInfo.id}/communityId`).set(activeCommunity.id);
                            await db.ref(`groups/${groupInfo.id}/estaEmComunidade`).set(true);
                            
                            showToast("Grupo adicionado e membros transferidos!");
                            setShowAddGroupModal(false);
                            setSelectedGroupToAdd('');
                        }} disabled={!selectedGroupToAdd} className="w-full p-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                            Adicionar à Comunidade
                        </button>
                    </div>
                </div>
            )}

            {showCreate && (
                <div className="fixed inset-0 bg-gray-900 bg-opacity-50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-bold text-gray-800">Nova Comunidade</h2>
                            <button onClick={() => setShowCreate(false)} className="text-gray-400 hover:text-gray-600">
                                <div className="icon-x text-xl"></div>
                            </button>
                        </div>
                        <div className="space-y-4 mb-6">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Nome</label>
                                <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Desenvolvedores BR" className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"/>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Descrição</label>
                                <textarea value={desc} onChange={e => setDesc(e.target.value)} placeholder="Sobre a comunidade..." className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none resize-none h-24"></textarea>
                            </div>
                        </div>
                        <button onClick={handleCreate} disabled={!name.trim()} className="w-full p-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed">
                            Criar
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
window.CommunityList = CommunityList;
