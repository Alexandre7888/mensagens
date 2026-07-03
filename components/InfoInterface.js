function InfoInterface({ user, chat }) {
    const db = window.firebaseDB;
    const [inviteLink, setInviteLink] = React.useState('');
    const [groupMembers, setGroupMembers] = React.useState({});
    const [allUsersInfo, setAllUsersInfo] = React.useState({});
    
    // Roles State
    const [communityId, setCommunityId] = React.useState(null);
    const [cargosData, setCargosData] = React.useState(null);
    const [isAdmin, setIsAdmin] = React.useState(false);
    const [isOwner, setIsOwner] = React.useState(false);
    const [myRole, setMyRole] = React.useState('membro');

    const verificarPermissao = (acao) => {
        if (chat.type !== 'group') return true;
        if (isOwner) return true;
        if (myRole === 'mutado') return false;
        
        if (myRole === 'admin') return true; // Admins tem quase tudo
        
        if (myRole === 'moderador') {
            const modPerms = ['fixar_mensagem', 'mutar_membro', 'desmutar_membro'];
            return modPerms.includes(acao);
        }
        
        if (myRole === 'membro') return false;

        // Custom Role
        if (cargosData && cargosData.cargos_personalizados && cargosData.cargos_personalizados[myRole]) {
            const customPerms = cargosData.cargos_personalizados[myRole].permissoes || [];
            return customPerms.includes(acao);
        }

        return false;
    };
    
    const [toastMessage, setToastMessage] = React.useState(null);
    const [activeTab, setActiveTab] = React.useState('info'); // info, members, roles, audit, invites
    const [invites, setInvites] = React.useState({});
    const [showInviteModal, setShowInviteModal] = React.useState(false);
    const [inviteSettings, setInviteSettings] = React.useState({ type: 'temp', customName: '', duration: '24h' });
    const [userCredits, setUserCredits] = React.useState(0);
    const [auditLog, setAuditLog] = React.useState([]);
    const [showMenu, setShowMenu] = React.useState(false);

    // Modals
    const [showRoleModal, setShowRoleModal] = React.useState(false);
    const [editingRole, setEditingRole] = React.useState({ id: '', cor: '#FF0066', permissoes: [] });
    
    const [showAddMemberModal, setShowAddMemberModal] = React.useState(false);
    const [addMemberTargetRole, setAddMemberTargetRole] = React.useState('');
    const [showAddByUsernameModal, setShowAddByUsernameModal] = React.useState(false);
    const [addUsername, setAddUsername] = React.useState("");

    const AVAILABLE_PERMISSIONS = window.AVAILABLE_PERMISSIONS;

    React.useEffect(() => {
        if (chat.type === 'group' && db) {
            // Load all users to display names
            db.ref('users').once('value').then(snap => {
                setAllUsersInfo(snap.val() || {});
            });

            db.ref(`groups/${chat.id}/members`).on('value', snap => {
                setGroupMembers(snap.val() || {});
            });

            db.ref(`groups/${chat.id}/communityId`).once('value').then(cSnap => {
                const commId = cSnap.val();
                setCommunityId(commId);
                const fetchCargosPath = commId ? `communities/${commId}/cargos` : `groups/${chat.id}/cargos`;

                db.ref(fetchCargosPath).on('value', snap => {
                    let data = snap.val();
                    if (!data) {
                        data = { dono: user.id, admins: [], moderadores: [], mutados: [], cargos_personalizados: {} };
                        if (!commId) db.ref(fetchCargosPath).set(data);
                    }
                    setCargosData(data);

                    let role = 'membro';
                    if (data.dono === user.id) role = 'dono';
                    else if (data.admins && data.admins.includes(user.id)) role = 'admin';
                    else if (data.moderadores && data.moderadores.includes(user.id)) role = 'moderador';
                    else if (data.mutados && data.mutados.includes(user.id)) role = 'mutado';
                    else if (data.cargos_personalizados) {
                        for (const [cName, cData] of Object.entries(data.cargos_personalizados)) {
                            if (cData.membros && cData.membros.includes(user.id)) { role = cName; break; }
                        }
                    }
                    setMyRole(role);
                    setIsOwner(role === 'dono');
                    setIsAdmin(role === 'dono' || role === 'admin');
                });
            });

            db.ref(`groups/${chat.id}/auditLog`).on('value', snap => {
                const logs = snap.val();
                if (logs) setAuditLog(Object.keys(logs).map(k => ({ id: k, ...logs[k] })).reverse());
            });
        }

        if (db) {
            db.ref('invites').orderByChild('targetId').equalTo(chat.id).on('value', snap => {
                setInvites(snap.val() || {});
            });
            db.ref(`users/${user.id}/credits`).on('value', snap => {
                setUserCredits(snap.val() || 0);
            });
        }

        return () => {
            if (chat.type === 'group' && db) {
                db.ref(`groups/${chat.id}/members`).off();
                db.ref(`groups/${chat.id}/cargos`).off();
                db.ref(`groups/${chat.id}/auditLog`).off();
            }
            if (db) {
                db.ref('invites').off();
                db.ref(`users/${user.id}/credits`).off();
            }
        }
    }, [chat.id, db, user.id]);

    const generateRandomId = () => Math.random().toString(36).substr(2, 9);

    const handleCreateInvite = async () => {
        if (!db) return;
        
        const isCustom = inviteSettings.type === 'custom';
        const inviteId = isCustom ? inviteSettings.customName.toLowerCase().replace(/[^a-z0-9_-]/g, '') : generateRandomId();
        
        if (isCustom) {
            if (chat.type !== 'group') {
                showToastMessage("Links personalizados estão disponíveis apenas para grupos.", "error");
                return;
            }
            if (inviteId.length < 3) {
                showToastMessage("O nome personalizado deve ter pelo menos 3 caracteres.", "error");
                return;
            }
            const existing = await db.ref(`invites/${inviteId}`).once('value');
            if (existing.exists()) {
                showToastMessage("Esse nome personalizado já está em uso.", "error");
                return;
            }
            
            const cost = 5000;
            if (userCredits < cost) {
                showToastMessage(`Você precisa de ${cost} créditos para um convite personalizado.`, "error");
                return;
            }
            await db.ref(`users/${user.id}/credits`).set(userCredits - cost);
        }

        let expiresAt = null;
        if (!isCustom) {
            const hours = parseInt(inviteSettings.duration);
            expiresAt = Date.now() + (hours * 60 * 60 * 1000);
        } else {
            // Custom expires in 7 days
            expiresAt = Date.now() + (7 * 24 * 60 * 60 * 1000);
        }

        await db.ref(`invites/${inviteId}`).set({
            targetId: chat.id,
            type: chat.type === 'group' ? 'group' : 'user',
            createdBy: user.id,
            createdAt: Date.now(),
            expiresAt: expiresAt,
            isCustom: isCustom
        });

        showToastMessage("Convite criado com sucesso!");
        setShowInviteModal(false);
    };

    const handleDeleteInvite = async (inviteId) => {
        if (window.confirm("Deseja deletar este convite?")) {
            await db.ref(`invites/${inviteId}`).remove();
            showToastMessage("Convite deletado!");
        }
    };

    const showToastMessage = (message, type = "success") => {
        setToastMessage({ message, type });
        setTimeout(() => setToastMessage(null), 3000);
    };

    const logAction = async (actionText) => {
        if (chat.type === 'group' && db) {
            await db.ref(`groups/${chat.id}/auditLog`).push({
                timestamp: Date.now(),
                user: user.name,
                action: actionText
            });
        }
    };

    const getUserName = (uid) => {
        if (uid === user.id) return 'Você';
        return allUsersInfo[uid]?.name || allUsersInfo[uid]?.username || 'Usuário';
    };

    const getRoleColorAndName = (uid) => {
        if (!cargosData) return { name: 'Membro', color: '#9ca3af', icon: '👤' };
        if (cargosData.dono === uid) return { name: 'DONO', color: '#FFD700', icon: '👑' };
        if (cargosData.admins && cargosData.admins.includes(uid)) return { name: 'ADMIN', color: '#FF4444', icon: '🛡️' };
        if (cargosData.moderadores && cargosData.moderadores.includes(uid)) return { name: 'MODERADOR', color: '#44FF44', icon: '⭐' };
        if (cargosData.mutados && cargosData.mutados.includes(uid)) return { name: 'MUTADO', color: '#FF8800', icon: '🔇' };
        
        if (cargosData.cargos_personalizados) {
            for (const [cName, cData] of Object.entries(cargosData.cargos_personalizados)) {
                if (cData.membros && cData.membros.includes(uid)) {
                    return { name: cName.toUpperCase(), color: cData.cor || '#FF0066', icon: '🎨' };
                }
            }
        }
        return { name: 'MEMBRO', color: '#9ca3af', icon: '👤' };
    };

    const handleSaveCustomRole = async () => {
        if (!editingRole.id.trim()) return;
        const roleId = editingRole.id.trim();
        const refPath = communityId ? `communities/${communityId}/cargos/cargos_personalizados/${roleId}` : `groups/${chat.id}/cargos/cargos_personalizados/${roleId}`;
        
        await db.ref(refPath).update({
            cor: editingRole.cor,
            permissoes: editingRole.permissoes
        });
        
        logAction(`Criou/editou o cargo personalizado: ${roleId}`);
        setShowRoleModal(false);
        showToastMessage("Cargo salvo com sucesso!");
    };

    const handleDeleteCustomRole = async (roleName) => {
        if (window.confirm(`Tem certeza que deseja apagar o cargo ${roleName}?`)) {
            const refPath = communityId ? `communities/${communityId}/cargos/cargos_personalizados/${roleName}` : `groups/${chat.id}/cargos/cargos_personalizados/${roleName}`;
            await db.ref(refPath).remove();
            logAction(`Deletou o cargo: ${roleName}`);
            showToastMessage("Cargo deletado!");
        }
    };

    // Remove do cargo atual e adiciona no novo (ou remove totalmente se novo = null)
    const removerDoCargoAtual = async (uid) => {
        if (!cargosData) return;
        
        const updates = {};
        if (cargosData.admins && cargosData.admins.includes(uid)) {
            updates['admins'] = cargosData.admins.filter(id => id !== uid);
        }
        if (cargosData.moderadores && cargosData.moderadores.includes(uid)) {
            updates['moderadores'] = cargosData.moderadores.filter(id => id !== uid);
        }
        if (cargosData.mutados && cargosData.mutados.includes(uid)) {
            updates['mutados'] = cargosData.mutados.filter(id => id !== uid);
        }
        
        if (cargosData.cargos_personalizados) {
            for (const [cName, cData] of Object.entries(cargosData.cargos_personalizados)) {
                if (cData.membros && cData.membros.includes(uid)) {
                    updates[`cargos_personalizados/${cName}/membros`] = cData.membros.filter(id => id !== uid);
                }
            }
        }
        
        if (Object.keys(updates).length > 0) {
            const refPath = communityId ? `communities/${communityId}/cargos` : `groups/${chat.id}/cargos`;
            await db.ref(refPath).update(updates);
        }
    };

    const adicionarAoCargo = async (uid, novoCargo) => {
        const isMuting = novoCargo === 'mutados';
        const isAssigningRole = !isMuting && novoCargo !== 'membro';

        if (isMuting && !verificarPermissao('mutar_membro') && !isAdmin) {
            showToastMessage("Sem permissão para mutar", "error");
            return;
        }

        if (isAssigningRole && !isAdmin) {
            showToastMessage("Apenas administradores podem atribuir cargos.", "error");
            return;
        }

        if (novoCargo === 'membro' && !verificarPermissao('remover_membro') && !isAdmin) {
             showToastMessage("Sem permissão para remover de cargos", "error");
             return;
        }

        await removerDoCargoAtual(uid);

        if (novoCargo === 'membro') {
            logAction(`Definiu ${getUserName(uid)} como Membro`);
            showToastMessage("Membro atualizado!");
            return;
        }

        const refPath = communityId ? `communities/${communityId}/cargos` : `groups/${chat.id}/cargos`;
        if (['admins', 'moderadores', 'mutados'].includes(novoCargo)) {
            const currentList = cargosData[novoCargo] || [];
            if (!currentList.includes(uid)) {
                await db.ref(`${refPath}/${novoCargo}`).set([...currentList, uid]);
            }
        } else {
            // Cargo personalizado
            const roleData = cargosData.cargos_personalizados?.[novoCargo];
            if (roleData) {
                const currentMembros = roleData.membros || [];
                if (!currentMembros.includes(uid)) {
                    await db.ref(`${refPath}/cargos_personalizados/${novoCargo}/membros`).set([...currentMembros, uid]);
                }
            }
        }

        logAction(`Adicionou ${getUserName(uid)} ao cargo ${novoCargo}`);
        showToastMessage("Cargo atribuído!");
        setShowAddMemberModal(false);
    };

    const handleTransferOwner = async (newOwnerId) => {
        if (!isOwner) return;
        if (window.confirm(`Tem certeza que deseja transferir a posse do grupo para ${getUserName(newOwnerId)}? Você perderá o cargo de DONO.`)) {
            await removerDoCargoAtual(newOwnerId);
            const refPath = communityId ? `communities/${communityId}/cargos` : `groups/${chat.id}/cargos`;
            await db.ref(`${refPath}/dono`).set(newOwnerId);
            
            // Coloca o dono antigo como admin
            const currentAdmins = cargosData.admins || [];
            if (!currentAdmins.includes(user.id)) {
                await db.ref(`${refPath}/admins`).set([...currentAdmins, user.id]);
            }
            
            logAction(`Transferiu a posse do grupo para ${getUserName(newOwnerId)}`);
            showToastMessage("Posse transferida com sucesso!");
        }
    };

    const handleAddByUsername = async () => {
        const sUser = addUsername.trim().toLowerCase().replace('@', '');
        if (!sUser) return;
        try {
            const usersRef = await db.ref('users').orderByChild('username').equalTo(sUser).once('value');
            const data = usersRef.val();
            if (data) {
                const targetId = Object.keys(data)[0];
                if (groupMembers[targetId]) {
                    showToastMessage("Usuário já está no grupo!", "error");
                    return;
                }
                await db.ref(`groups/${chat.id}/members/${targetId}`).set({ role: 'membro', joinedAt: Date.now() });
                const updateData = { name: chat.name, type: 'group', timestamp: Date.now() };
                
                const cSnap = await db.ref(`groups/${chat.id}/communityId`).once('value');
                const commId = cSnap.val();
                if (commId) {
                    updateData.communityId = commId;
                    await db.ref(`communities/${commId}/members/${targetId}`).set({ role: 'membro', joinedAt: Date.now() });
                    const commSnap = await db.ref(`communities/${commId}`).once('value');
                    await db.ref(`users/${targetId}/communities/${commId}`).set({ name: commSnap.val().name, role: 'membro', joinedAt: Date.now() });
                }
                
                await db.ref(`users/${targetId}/chats/${chat.id}`).set(updateData);
                
                logAction(`Adicionou ${sUser} ao grupo via @arroba`);
                showToastMessage("Usuário adicionado com sucesso!", "success");
                setShowAddByUsernameModal(false);
                setAddUsername("");
            } else {
                showToastMessage("Usuário não encontrado.", "error");
            }
        } catch(e) {
            showToastMessage("Erro ao buscar.", "error");
        }
    };

    const handleDeleteGroup = async () => {
        if (!isOwner) return;
        if (window.confirm("ATENÇÃO: Deseja realmente apagar o grupo permanentemente? Isso não pode ser desfeito.")) {
            // Remove chats from all members
            for (const uid of Object.keys(groupMembers)) {
                await db.ref(`users/${uid}/chats/${chat.id}`).remove();
            }
            await db.ref(`groups/${chat.id}`).remove();
            window.location.href = 'index.html';
        }
    };

    if (chat.type === 'group' && !cargosData) return null;

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col pb-10" data-name="info-interface">
            <header className="bg-white shadow-sm px-4 py-3 flex items-center justify-between sticky top-0 z-20">
                <div className="flex items-center gap-4">
                    <button onClick={() => window.location.href = `chat.html?chatId=${chat.id}`} className="p-2 hover:bg-gray-100 rounded-full text-gray-600">
                        <div className="icon-arrow-left text-xl"></div>
                    </button>
                    <h1 className="text-xl font-bold text-gray-800">{chat.type === 'group' ? 'Menu do Grupo' : 'Perfil'}</h1>
                </div>
                {chat.type === 'group' && (
                    <div className="relative">
                        <button onClick={() => setShowMenu(!showMenu)} className="p-2 hover:bg-gray-100 rounded-full text-gray-600">
                            <div className="icon-ellipsis-vertical text-xl"></div>
                        </button>
                        {showMenu && (
                            <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-xl border border-gray-100 py-2 z-50">
                                <button onClick={() => { setActiveTab('info'); setShowMenu(false); }} className="w-full text-left px-4 py-2 hover:bg-gray-50 flex items-center gap-3">
                                    <div className="icon-info text-gray-400"></div> Editar grupo
                                </button>
                                <button onClick={() => { setActiveTab('members'); setShowMenu(false); }} className="w-full text-left px-4 py-2 hover:bg-gray-50 flex items-center gap-3">
                                    <div className="icon-users text-gray-400"></div> Membros ({Object.keys(groupMembers).length})
                                </button>
                                <button onClick={() => { setActiveTab('roles'); setShowMenu(false); }} className="w-full text-left px-4 py-2 hover:bg-gray-50 flex items-center gap-3 text-indigo-600 font-bold">
                                    <div className="icon-tag text-indigo-600"></div> Cargos
                                </button>
                                <button onClick={() => { setShowMenu(false); showToastMessage("Em breve"); }} className="w-full text-left px-4 py-2 hover:bg-gray-50 flex items-center gap-3">
                                    <div className="icon-pin text-gray-400"></div> Mensagens fixadas
                                </button>
                                <button onClick={() => { setActiveTab('roles'); setShowMenu(false); }} className="w-full text-left px-4 py-2 hover:bg-gray-50 flex items-center gap-3">
                                    <div className="icon-mic-off text-gray-400"></div> Mutados
                                </button>
                                <button onClick={() => { setActiveTab('invites'); setShowMenu(false); }} className="w-full text-left px-4 py-2 hover:bg-gray-50 flex items-center gap-3 text-indigo-600 font-bold">
                                    <div className="icon-link text-indigo-600"></div> Convites
                                </button>
                                <div className="h-px bg-gray-100 my-1"></div>
                                <button onClick={() => { window.location.href='index.html'; }} className="w-full text-left px-4 py-2 hover:bg-red-50 flex items-center gap-3 text-red-600">
                                    <div className="icon-log-out text-red-600"></div> Sair do grupo
                                </button>
                                {isOwner && (
                                    <button onClick={handleDeleteGroup} className="w-full text-left px-4 py-2 hover:bg-red-50 flex items-center gap-3 text-red-600 font-bold">
                                        <div className="icon-trash-2 text-red-600"></div> Apagar grupo
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </header>

            <main className="flex-1 w-full max-w-3xl mx-auto p-4 sm:p-6 animate-fade-in-up">
                
                <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden mb-6">
                    <div className="h-32 bg-gradient-to-r from-gray-800 to-gray-900 relative">
                        <div className="absolute -bottom-12 left-6 w-24 h-24 rounded-full border-4 border-white bg-indigo-100 flex items-center justify-center text-4xl font-bold text-indigo-700 shadow-md">
                            {chat.name.charAt(0).toUpperCase()}
                        </div>
                    </div>
                    <div className="pt-16 pb-6 px-6">
                        <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                            {chat.name}
                        </h2>
                        <div className="mt-2 text-sm text-gray-500 font-medium">
                            Seu cargo atual: <span className="font-bold uppercase" style={{color: getRoleColorAndName(user.id).color}}>{getRoleColorAndName(user.id).name}</span>
                        </div>
                    </div>
                </div>

                {/* TABS CONTEÚDO */}
                {activeTab === 'info' && (
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                        <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4">
                            {chat.type === 'group' ? 'Ações do Grupo' : 'Ações do Contato'}
                        </h3>
                        {chat.type === 'group' ? (
                            isAdmin ? (
                                <button onClick={() => setActiveTab('invites')} className="w-full flex items-center justify-center gap-3 py-3 px-4 bg-indigo-50 text-indigo-800 rounded-xl font-bold hover:bg-indigo-100 border border-indigo-200">
                                    <div className="icon-link"></div> Gerenciar Convites
                                </button>
                            ) : (
                                <div className="p-3 bg-gray-50 text-gray-500 rounded-xl text-center">Apenas admins podem gerenciar convites</div>
                            )
                        ) : (
                            <button onClick={() => setActiveTab('invites')} className="w-full flex items-center justify-center gap-3 py-3 px-4 bg-indigo-50 text-indigo-800 rounded-xl font-bold hover:bg-indigo-100 border border-indigo-200">
                                <div className="icon-share-2"></div> Gerenciar Convites Pessoais
                            </button>
                        )}
                        {inviteLink && (
                            <div className="mt-4 bg-green-50 border border-green-200 rounded-xl p-4">
                                <input type="text" readOnly value={inviteLink} className="w-full bg-white border border-green-200 rounded-lg px-3 py-2 text-sm text-gray-600 mb-2" />
                                <button onClick={() => { navigator.clipboard.writeText(inviteLink); showToastMessage("Copiado!"); }} className="w-full bg-green-600 text-white py-2 rounded-lg font-bold">Copiar Link</button>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'members' && (
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider">Todos os Membros</h3>
                            {(isAdmin || verificarPermissao('adicionar_membro')) && (
                                <button onClick={() => setShowAddByUsernameModal(true)} className="text-sm font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 bg-indigo-50 px-3 py-1.5 rounded-lg">
                                    <div className="icon-user-plus text-lg"></div> Adicionar
                                </button>
                            )}
                        </div>
                        <div className="space-y-3">
                            {Object.keys(groupMembers).map(uid => {
                                const roleInfo = getRoleColorAndName(uid);
                                return (
                                    <div key={uid} className="flex justify-between items-center bg-gray-50 p-3 rounded-xl border border-gray-100">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 bg-white border border-gray-200 rounded-full flex items-center justify-center text-gray-500 font-bold">
                                                <div className="icon-user"></div>
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="font-bold text-gray-800">{getUserName(uid)}</span>
                                                <span className="text-[10px] font-bold px-2 py-0.5 rounded text-white inline-block mt-0.5" style={{backgroundColor: roleInfo.color === '#FFFFFF' ? '#9ca3af' : roleInfo.color}}>
                                                    {roleInfo.icon} {roleInfo.name}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* TELA DE CARGOS */}
                {activeTab === 'roles' && (
                    <div className="space-y-6">
                        <div className="bg-gray-800 text-white p-4 rounded-xl text-center shadow-lg">
                            <h2 className="text-xl font-bold mb-1">🏷️ CARGOS GLOBAIS</h2>
                            <p className="text-sm text-gray-400">Hierarquia e permissões sincronizadas</p>
                        </div>

                        {/* DONO */}
                        <div className="bg-white border-2 border-yellow-200 rounded-xl overflow-hidden shadow-sm">
                            <div className="bg-yellow-50 px-4 py-2 border-b border-yellow-200 font-bold text-yellow-800 flex items-center gap-2">
                                👑 DONO (1)
                            </div>
                            <div className="p-4">
                                <div className="flex justify-between items-center">
                                    <span className="font-bold text-gray-800">
                                        {getUserName(cargosData.dono)} {cargosData.dono === user.id ? '(Você)' : ''}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* ADMIN */}
                        <div className="bg-white border-2 border-red-200 rounded-xl overflow-hidden shadow-sm">
                            <div className="bg-red-50 px-4 py-2 border-b border-red-200 font-bold text-red-800 flex justify-between items-center">
                                <span>🛡️ ADMIN ({cargosData.admins?.length || 0})</span>
                            </div>
                            <div className="p-4 space-y-3">
                                {(cargosData.admins || []).map(uid => (
                                    <div key={uid} className="flex justify-between items-center pl-4 border-l-2 border-red-200">
                                        <span className="font-medium text-gray-700">{getUserName(uid)}</span>
                                        {(isAdmin) && uid !== user.id && (
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

                        {/* MODERADOR */}
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

                        {/* MUTADOS */}
                        <div className="bg-white border-2 border-orange-200 rounded-xl overflow-hidden shadow-sm">
                            <div className="bg-orange-50 px-4 py-2 border-b border-orange-200 font-bold text-orange-800 flex justify-between items-center">
                                <span>🔇 MUTADOS ({cargosData.mutados?.length || 0})</span>
                            </div>
                            <div className="p-4 space-y-3">
                                {(cargosData.mutados || []).map(uid => (
                                    <div key={uid} className="flex justify-between items-center pl-4 border-l-2 border-orange-200">
                                        <span className="font-medium text-gray-700">{getUserName(uid)}</span>
                                        {(isAdmin || verificarPermissao('mutar_membro')) && (
                                            <button onClick={() => adicionarAoCargo(uid, 'membro')} className="text-xs text-green-600 font-bold hover:bg-green-50 px-2 py-1 rounded">[DESMUTAR]</button>
                                        )}
                                    </div>
                                ))}
                                {(isAdmin || verificarPermissao('mutar_membro')) && (
                                    <button onClick={() => { setAddMemberTargetRole('mutados'); setShowAddMemberModal(true); }} className="text-sm font-bold text-orange-600 mt-2 hover:underline">
                                        [➕ ADICIONAR MUTADO]
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* CARGOS PERSONALIZADOS */}
                        <div className="bg-white border-2 border-indigo-200 rounded-xl overflow-hidden shadow-sm">
                            <div className="bg-indigo-50 px-4 py-2 border-b border-indigo-200 font-bold text-indigo-800 flex justify-between items-center">
                                <span>🎨 CARGOS PERSONALIZADOS</span>
                            </div>
                            <div className="p-4 space-y-6">
                                {Object.keys(cargosData.cargos_personalizados || {}).length === 0 && (
                                    <p className="text-sm text-gray-500 italic">Nenhum cargo personalizado criado.</p>
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
                                                    <button onClick={() => handleDeleteCustomRole(cName)} className="text-xs text-red-600 font-bold hover:underline">EXCLUIR</button>
                                                </div>
                                            )}
                                        </div>
                                        <div className="pl-4 border-l-2 border-gray-200 space-y-2">
                                            {(cData.membros || []).map(uid => (
                                                <div key={uid} className="flex justify-between items-center">
                                                    <span className="text-sm font-medium text-gray-700">{getUserName(uid)}</span>
                                                    {isAdmin && (
                                                        <button onClick={() => adicionarAoCargo(uid, 'membro')} className="text-xs text-red-600 font-bold hover:bg-red-50 px-2 py-1 rounded">[REMOVER]</button>
                                                    )}
                                                </div>
                                            ))}
                                            {isAdmin && (
                                                <button onClick={() => { setAddMemberTargetRole(cName); setShowAddMemberModal(true); }} className="text-sm font-bold text-indigo-600 mt-2 hover:underline">
                                                    [➕ ADICIONAR]
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))}

                                {isAdmin && (
                                    <div className="pt-4 border-t border-gray-100">
                                        <button onClick={() => { setEditingRole({ id: '', cor: '#AA00FF', permissoes: ['enviar_mensagem', 'enviar_foto'] }); setShowRoleModal(true); }} className="w-full py-3 bg-gray-900 text-white rounded-xl font-bold hover:bg-black transition-colors">
                                            [➕ CRIAR CARGO PERSONALIZADO]
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* TELA DE CONVITES */}
                {activeTab === 'invites' && (
                    <div className="space-y-6">
                        <div className="bg-indigo-800 text-white p-4 rounded-xl text-center shadow-lg flex justify-between items-center">
                            <div>
                                <h2 className="text-xl font-bold mb-1">🔗 CONVITES</h2>
                                <p className="text-sm text-indigo-200">Gerencie links de acesso</p>
                            </div>
                            <button onClick={() => setShowInviteModal(true)} className="bg-white text-indigo-800 px-4 py-2 rounded-lg font-bold hover:bg-indigo-50">
                                + Novo
                            </button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {Object.keys(invites).length === 0 ? (
                                <p className="text-gray-500 text-center col-span-full py-6">Nenhum convite ativo no momento.</p>
                            ) : (
                                Object.entries(invites).map(([inviteId, data]) => {
                                    const isExpired = data.expiresAt && Date.now() > data.expiresAt;
                                    const linkUrl = `${window.location.origin}${window.location.pathname.replace('info.html','')}convite.html?id=${inviteId}`;
                                    
                                    return (
                                        <div key={inviteId} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-200 relative overflow-hidden flex flex-col justify-between">
                                            {data.isCustom && (
                                                <div className="absolute top-0 right-0 bg-yellow-400 text-yellow-900 text-[10px] font-bold px-2 py-1 rounded-bl-lg">
                                                    PREMIUM
                                                </div>
                                            )}
                                            <div>
                                                <h4 className="font-bold text-gray-800 text-lg mb-1 break-all">{inviteId}</h4>
                                                <p className="text-xs text-gray-500 mb-3">
                                                    {isExpired ? (
                                                        <span className="text-red-500 font-bold">Expirado</span>
                                                    ) : (
                                                        data.expiresAt ? `Expira em: ${new Date(data.expiresAt).toLocaleString()}` : 'Permanente'
                                                    )}
                                                </p>
                                            </div>
                                            <div className="flex gap-2 mt-4">
                                                <button onClick={() => { navigator.clipboard.writeText(linkUrl); showToastMessage("Link copiado!"); }} className="flex-1 bg-indigo-50 text-indigo-700 py-2 rounded-lg font-bold text-sm hover:bg-indigo-100 transition-colors">
                                                    Copiar
                                                </button>
                                                <button onClick={() => handleDeleteInvite(inviteId)} className="bg-red-50 text-red-600 px-3 py-2 rounded-lg hover:bg-red-100 transition-colors">
                                                    <div className="icon-trash-2"></div>
                                                </button>
                                            </div>
                                        </div>
                                    )
                                })
                            )}
                        </div>
                    </div>
                )}

            </main>

            {/* MODAL ADD BY USERNAME */}
            {showAddByUsernameModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl animate-fade-in-up p-6">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="font-bold text-gray-800 text-lg">Adicionar Membro</h3>
                            <button onClick={() => setShowAddByUsernameModal(false)} className="text-gray-500 hover:bg-gray-200 p-1 rounded-full"><div className="icon-x"></div></button>
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
                        <button onClick={handleAddByUsername} disabled={!addUsername.trim()} className="w-full py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 font-bold disabled:opacity-50 transition-colors">
                            Adicionar ao Grupo
                        </button>
                    </div>
                </div>
            )}

            {/* MODAL ADD MEMBER TO ROLE */}
            {showAddMemberModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl animate-fade-in-up">
                        <div className="p-4 border-b bg-gray-50 flex justify-between items-center">
                            <h3 className="font-bold text-gray-800">Adicionar a {addMemberTargetRole.toUpperCase()}</h3>
                            <button onClick={() => setShowAddMemberModal(false)} className="text-gray-500 hover:bg-gray-200 p-1 rounded-full"><div className="icon-x"></div></button>
                        </div>
                        <div className="max-h-64 overflow-y-auto p-2">
                            {Object.keys(groupMembers).filter(uid => uid !== user.id).map(uid => (
                                <div key={uid} onClick={() => adicionarAoCargo(uid, addMemberTargetRole)} className="p-3 hover:bg-indigo-50 rounded-xl cursor-pointer flex items-center justify-between group">
                                    <span className="font-medium text-gray-800">{getUserName(uid)}</span>
                                    <span className="text-indigo-600 opacity-0 group-hover:opacity-100 font-bold text-sm">SELECIONAR</span>
                                </div>
                            ))}
                            {Object.keys(groupMembers).length <= 1 && (
                                <p className="text-center p-4 text-gray-500 text-sm">Você é o único membro no grupo.</p>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL CREATE/EDIT CUSTOM ROLE */}
            {showRoleModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-hidden shadow-2xl flex flex-col animate-fade-in-up">
                        <div className="p-4 border-b bg-gray-50 flex justify-between items-center text-center">
                            <h3 className="font-bold text-gray-800 w-full">✨ {editingRole.id ? 'EDITAR' : 'CRIAR NOVO'} CARGO</h3>
                        </div>
                        
                        <div className="p-6 overflow-y-auto flex-1 space-y-6">
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-2">Nome do cargo:</label>
                                <input type="text" value={editingRole.id} onChange={e => setEditingRole({...editingRole, id: e.target.value.replace(/[^a-zA-Z0-9_]/g, '')})} disabled={!!editingRole.id && cargosData.cargos_personalizados?.[editingRole.id]} placeholder="Ex: VIP" className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none uppercase font-bold text-gray-800"/>
                                <p className="text-[10px] text-gray-400 mt-1">Apenas letras, números e underline.</p>
                            </div>
                            
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-2">Cor do cargo:</label>
                                <div className="flex gap-4 items-center">
                                    <input type="color" value={editingRole.cor} onChange={e => setEditingRole({...editingRole, cor: e.target.value})} className="w-12 h-12 rounded cursor-pointer border-0 p-0"/>
                                    <span className="font-mono text-gray-600 bg-gray-100 px-3 py-1 rounded">{editingRole.cor.toUpperCase()}</span>
                                </div>
                            </div>

                            <div className="border-t border-gray-200 pt-4">
                                <label className="block text-sm font-bold text-gray-700 mb-3">PERMISSÕES:</label>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    {AVAILABLE_PERMISSIONS.map(perm => (
                                        <label key={perm.id} className="flex items-center gap-3 cursor-pointer p-2 hover:bg-gray-50 rounded-lg">
                                            <input 
                                                type="checkbox" 
                                                checked={editingRole.permissoes.includes(perm.id)}
                                                onChange={e => {
                                                    const current = editingRole.permissoes;
                                                    const next = e.target.checked ? [...current, perm.id] : current.filter(p => p !== perm.id);
                                                    setEditingRole({...editingRole, permissoes: next});
                                                }}
                                                className="w-5 h-5 accent-indigo-600"
                                            />
                                            <span className="text-sm font-medium text-gray-700">{perm.label}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="p-4 border-t bg-gray-50 flex gap-3">
                            <button onClick={() => setShowRoleModal(false)} className="flex-1 py-3 bg-gray-200 text-gray-700 font-bold rounded-xl hover:bg-gray-300">CANCELAR</button>
                            <button onClick={handleSaveCustomRole} disabled={!editingRole.id} className="flex-1 py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 disabled:opacity-50">SALVAR CARGO</button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL CRIAR CONVITE */}
            {showInviteModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl animate-fade-in-up">
                        <div className="p-4 border-b bg-gray-50 flex justify-between items-center">
                            <h3 className="font-bold text-gray-800 text-lg">Criar Convite</h3>
                            <button onClick={() => setShowInviteModal(false)} className="text-gray-500 hover:bg-gray-200 p-1 rounded-full"><div className="icon-x"></div></button>
                        </div>
                        <div className="p-6 space-y-5">
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-2">Tipo de Convite:</label>
                                <div className="flex gap-2">
                                    <button 
                                        onClick={() => setInviteSettings({...inviteSettings, type: 'temp'})} 
                                        className={`flex-1 py-2 rounded-lg font-bold text-sm border-2 ${inviteSettings.type === 'temp' ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'border-gray-200 text-gray-500'}`}
                                    >
                                        Temporário (Grátis)
                                    </button>
                                    {chat.type === 'group' && (
                                        <button 
                                            onClick={() => setInviteSettings({...inviteSettings, type: 'custom'})} 
                                            className={`flex-1 py-2 rounded-lg font-bold text-sm border-2 flex items-center justify-center gap-1 ${inviteSettings.type === 'custom' ? 'border-yellow-500 bg-yellow-50 text-yellow-700' : 'border-gray-200 text-gray-500'}`}
                                        >
                                            <div className="icon-star text-xs"></div> Personalizado
                                        </button>
                                    )}
                                </div>
                            </div>

                            {inviteSettings.type === 'temp' ? (
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2">Duração:</label>
                                    <select 
                                        value={inviteSettings.duration}
                                        onChange={(e) => setInviteSettings({...inviteSettings, duration: e.target.value})}
                                        className="w-full p-3 border border-gray-300 rounded-xl outline-none focus:border-indigo-500"
                                    >
                                        <option value="1">1 Hora</option>
                                        <option value="24">24 Horas</option>
                                        <option value="168">7 Dias</option>
                                    </select>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 mb-2">Link Personalizado (Ex: meugrupo):</label>
                                        <input 
                                            type="text" 
                                            placeholder="Nome exclusivo"
                                            value={inviteSettings.customName}
                                            onChange={(e) => setInviteSettings({...inviteSettings, customName: e.target.value})}
                                            className="w-full p-3 border border-gray-300 rounded-xl outline-none focus:border-indigo-500 bg-gray-50"
                                        />
                                        <p className="text-xs text-gray-500 mt-1">Duração: 7 Dias. Requer renovação.</p>
                                    </div>
                                    <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 flex justify-between items-center">
                                        <span className="text-sm font-bold text-yellow-800">Custo:</span>
                                        <span className="text-lg font-black text-yellow-600 flex items-center gap-1">
                                            <div className="icon-coins text-yellow-500"></div> 5000
                                        </span>
                                    </div>
                                    <div className="text-center text-sm text-gray-500">
                                        Seu saldo: <span className="font-bold text-indigo-600">{userCredits} créditos</span>
                                    </div>
                                </div>
                            )}

                            <button 
                                onClick={handleCreateInvite}
                                className="w-full py-4 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-colors shadow-md"
                            >
                                Gerar Link de Convite
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {toastMessage && (
                <div className={`fixed bottom-6 right-4 p-4 rounded-xl shadow-2xl text-white font-medium z-[70] flex items-center gap-2 transform transition-all ${toastMessage.type === 'error' ? 'bg-red-500' : 'bg-gray-800'}`}>
                    <div className={`icon-${toastMessage.type === 'error' ? 'alert-circle' : 'check-circle'} text-xl`}></div>
                    {toastMessage.message}
                </div>
            )}
        </div>
    );
}

window.InfoInterface = InfoInterface;