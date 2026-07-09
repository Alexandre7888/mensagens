function AdminPanel() {
  const [activeTab, setActiveTab] = React.useState('users');
  const [users, setUsers] = React.useState([]);
  const [bannedUsers, setBannedUsers] = React.useState([]);
  const [groups, setGroups] = React.useState([]);
  const [appeals, setAppeals] = React.useState([]);
  const [moderations, setModerations] = React.useState([]);
  const [activeLives, setActiveLives] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [selectedUser, setSelectedUser] = React.useState(null);
  const [banModalUser, setBanModalUser] = React.useState(null);
  const [banTemplates, setBanTemplates] = React.useState([]);
  const [includeReason, setIncludeReason] = React.useState(false);
  const [banReason, setBanReason] = React.useState('');
  const [newTemplateText, setNewTemplateText] = React.useState('');

  React.useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    if (window.firebaseDB) {
      const usersSnap = await window.firebaseDB.ref('users').once('value');
      const bannedSnap = await window.firebaseDB.ref('banned_users').once('value');
      const groupsSnap = await window.firebaseDB.ref('groups').once('value');
      const modSnap = await window.firebaseDB.ref('moderacoes').once('value');
      const livesSnap = await window.firebaseDB.ref('lives').once('value');
      
      const usersList = [];
      usersSnap.forEach(child => {
        usersList.push({ id: child.key, ...child.val() });
      });
      
      const bannedList = [];
      bannedSnap.forEach(child => {
        bannedList.push({ id: child.key, ...child.val() });
      });
      
      const groupsList = [];
      groupsSnap.forEach(child => {
        groupsList.push({ id: child.key, ...child.val() });
      });

      const modList = [];
      if (modSnap.exists()) {
        modSnap.forEach(child => {
          modList.push({ id: child.key, ...child.val() });
        });
        modList.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      }

      const appealsList = [];
      if (window.firebaseFirestore) {
          const appealsSnap = await window.firebaseFirestore.collection('face_verifications').get();
          appealsSnap.forEach(doc => {
              appealsList.push({ id: doc.id, ...doc.data() });
          });
      }

      const templatesSnap = await window.firebaseDB.ref('ban_templates').once('value');
      if (templatesSnap.exists()) {
        setBanTemplates(templatesSnap.val());
      } else {
        const defaultTemplates = ['Comportamento Inadequado', 'Spam / Flood', 'Violação dos Termos de Uso'];
        await window.firebaseDB.ref('ban_templates').set(defaultTemplates);
        setBanTemplates(defaultTemplates);
      }

      const livesList = [];
      if (livesSnap.exists()) {
        livesSnap.forEach(child => {
          if(child.val().status === 'active') {
              livesList.push({ id: child.key, ...child.val() });
          }
        });
      }

      setUsers(usersList);
      setBannedUsers(bannedList);
      setGroups(groupsList);
      setAppeals(appealsList);
      setModerations(modList);
      setActiveLives(livesList);
    }
    setLoading(false);
  };

  const handleUpdateAppealStatus = async (appealId, status, bUser) => {
    try {
      if (window.firebaseFirestore) {
          await window.firebaseFirestore.collection('face_verifications').doc(appealId).update({ status });
      } else {
          await window.firebaseDB.ref(`verificacoes/${appealId}`).update({ status });
      }
      
      if (status === 'aprovado' && bUser) {
        if (bUser.backup) {
           const jsonString = decodeURIComponent(escape(atob(bUser.backup)));
           const userData = JSON.parse(jsonString);
           await window.firebaseDB.ref(`users/${bUser.id}`).set(userData);
        }
        await window.firebaseDB.ref(`banned_users/${bUser.id}`).remove();
        alert('Apelação aprovada. Usuário foi desbanido e restaurado!');
      } else {
        alert(`Apelação atualizada para: ${status}`);
      }
      loadData();
    } catch (err) {
      console.error('Erro ao atualizar apelação:', err);
      alert('Erro ao processar a apelação.');
    }
  };

  const handleBanUser = async (user, type) => {
    let banUntil = null;
    let label = 'Permanente';
    const now = Date.now();
    
    if (type === '15m') { banUntil = now + (15 * 60 * 1000); label = '15 Minutos'; }
    if (type === '1h') { banUntil = now + (60 * 60 * 1000); label = '1 Hora'; }
    if (type === '24h') { banUntil = now + (24 * 60 * 60 * 1000); label = '24 Horas'; }
    if (type === '7d') { banUntil = now + (7 * 24 * 60 * 60 * 1000); label = '7 Dias'; }

    try {
      const userJsonString = JSON.stringify(user);
      const base64Data = btoa(unescape(encodeURIComponent(userJsonString)));

      const banPayload = {
        bannedAt: now,
        banUntil: banUntil,
        banType: type,
        backup: base64Data,
        status: 'banned',
        originalId: user.id
      };

      if (includeReason && banReason.trim()) {
        banPayload.reason = banReason.trim();
      }

      await window.firebaseDB.ref(`banned_users/${user.id}`).set(banPayload);
      await window.firebaseDB.ref(`users/${user.id}`).remove();

      setBanModalUser(null);
      if (selectedUser?.id === user.id) setSelectedUser(null);
      loadData();
      
      alert(`Usuário banido com sucesso (${label}).`);
    } catch (error) {
      console.error('Erro ao banir usuário:', error);
      alert('Erro ao banir usuário.');
    }
  };

  const handleUnbanUser = async (bannedUser) => {
    if (!window.confirm('Tem certeza que deseja desbanir este usuário? Os dados serão restaurados.')) return;

    try {
      if (bannedUser.backup) {
         const jsonString = decodeURIComponent(escape(atob(bannedUser.backup)));
         const userData = JSON.parse(jsonString);
         await window.firebaseDB.ref(`users/${bannedUser.id}`).set(userData);
      }
      
      await window.firebaseDB.ref(`banned_users/${bannedUser.id}`).remove();
      loadData();
      alert('Usuário desbanido e dados restaurados!');
    } catch (err) {
      console.error('Erro ao desbanir:', err);
      alert('Erro ao desbanir.');
    }
  };

  const handleWipeAndBackup = async () => {
    if (!window.confirm("⚠️ ATENÇÃO: Isso apagará TODO o banco de dados do servidor e criará um backup local. O seu acesso de administrador será mantido. Tem certeza que deseja continuar?")) return;
    
    setLoading(true);
    try {
      const snap = await window.firebaseDB.ref('/').once('value');
      const allData = snap.val();
      
      if (allData) {
        localStorage.setItem('admin_db_backup', JSON.stringify(allData));
        await window.firebaseDB.ref('/').remove();
        
        if (allData.system_config) {
          await window.firebaseDB.ref('system_config').set(allData.system_config);
        }
        
        alert("Servidor apagado com sucesso! Backup foi salvo localmente.");
        loadData();
      }
    } catch(e) {
      console.error('Erro no wipe:', e);
      alert("Erro ao realizar o procedimento.");
    }
    setLoading(false);
  };

  const handleAddTemplate = async () => {
    if (!newTemplateText.trim()) return;
    const updated = [...banTemplates, newTemplateText.trim()];
    setBanTemplates(updated);
    await window.firebaseDB.ref('ban_templates').set(updated);
    setNewTemplateText('');
  };

  const handleDismissModeration = async (modId) => {
    if (!window.confirm('Marcar como moderação leve e ignorar esta infração?')) return;
    try {
      await window.firebaseDB.ref(`moderacoes/${modId}`).remove();
      loadData();
    } catch (err) {
      console.error('Erro ao ignorar moderação:', err);
      alert('Erro ao ignorar moderação.');
    }
  };

  const openBanModal = (user) => {
    setBanModalUser(user);
    setIncludeReason(false);
    setBanReason('');
    setNewTemplateText('');
  };

  const handleRestore = async () => {
    if (!window.confirm("Isso irá sobrescrever os dados atuais do servidor com o backup salvo localmente. Continuar?")) return;
    
    setLoading(true);
    try {
      const backupStr = localStorage.getItem('admin_db_backup');
      if (!backupStr) {
        alert("Nenhum backup encontrado no armazenamento local deste navegador.");
        setLoading(false);
        return;
      }
      
      const allData = JSON.parse(backupStr);
      await window.firebaseDB.ref('/').set(allData);
      
      alert("Servidor restaurado com sucesso a partir do backup!");
      loadData();
    } catch(e) {
      console.error('Erro na restauração:', e);
      alert("Erro ao restaurar o servidor.");
    }
    setLoading(false);
  };

  const tabs = [
    { id: 'users', label: 'Usuários Ativos', icon: 'users', count: users.length },
    { id: 'banned', label: 'Usuários Banidos', icon: 'user-x', count: bannedUsers.length },
    { id: 'moderations', label: 'Moderações', icon: 'shield-alert', count: moderations.length },
    { id: 'lives', label: 'Lives Ativas', icon: 'radio', count: activeLives.length },
    { id: 'groups', label: 'Monitoramento', icon: 'activity' },
    { id: 'danger', label: 'Sistema & Dados', icon: 'database' }
  ];

  return (
    <div className="flex h-screen bg-[#0f111a] text-slate-300 font-sans" data-name="admin-panel" data-file="components/AdminPanel.js">
      {/* Sidebar Corporativa */}
      <div className="w-72 bg-[#161b22] border-r border-slate-800/60 flex flex-col flex-shrink-0 shadow-2xl z-20 relative">
        <div className="h-20 flex items-center px-6 border-b border-slate-800/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <div className="icon-shield-check text-white text-xl"></div>
            </div>
            <div>
              <h1 className="font-bold text-slate-100 text-lg tracking-tight">Phantora Admin</h1>
              <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">Centro de Controle</p>
            </div>
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto py-6 px-4 space-y-1 custom-scrollbar">
          <p className="px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4">Gerenciamento</p>
          
          {tabs.map(tab => (
            <button 
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`w-full flex items-center justify-between px-3 py-3 rounded-xl transition-all duration-200 group ${
                activeTab === tab.id 
                ? 'bg-indigo-500/10 text-indigo-400' 
                : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`icon-${tab.icon} text-lg ${activeTab === tab.id ? 'text-indigo-400' : 'text-slate-500 group-hover:text-slate-300'}`}></div>
                <span className="font-medium text-sm">{tab.label}</span>
              </div>
              {tab.count !== undefined && (
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  activeTab === tab.id ? 'bg-indigo-500/20 text-indigo-300' : 'bg-slate-800 text-slate-400 group-hover:bg-slate-700'
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
        
        <div className="p-4 border-t border-slate-800/60 bg-slate-900/30">
          <div className="flex items-center gap-3 px-3 py-2">
            <div className="w-8 h-8 bg-emerald-500/20 rounded-full flex items-center justify-center border border-emerald-500/30">
              <div className="icon-wifi text-emerald-400 text-sm"></div>
            </div>
            <div>
              <p className="text-sm font-medium text-slate-200">Sistema Online</p>
              <p className="text-xs text-slate-500">Conectado ao Firebase</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 bg-[#0b0d14] relative">
        {/* Top Header */}
        <header className="h-20 bg-[#0f111a]/80 backdrop-blur-md border-b border-slate-800/60 flex items-center justify-between px-8 sticky top-0 z-10">
          <div>
            <h2 className="text-2xl font-semibold text-slate-100 tracking-tight">
              {tabs.find(t => t.id === activeTab)?.label}
            </h2>
            <p className="text-sm text-slate-500 mt-0.5">
              Gerencie os dados e mantenha a comunidade segura.
            </p>
          </div>
          
          <div className="flex items-center gap-4">
            <button onClick={loadData} className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm font-medium transition-colors border border-slate-700/50 shadow-sm">
              <div className={`icon-refresh-cw ${loading ? 'animate-spin' : ''}`}></div>
              Atualizar Dados
            </button>
          </div>
        </header>

        {/* Content Wrapper */}
        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
          {loading ? (
            <div className="flex flex-col justify-center items-center h-full space-y-4">
              <div className="w-12 h-12 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin"></div>
              <p className="text-slate-400 font-medium animate-pulse">Sincronizando com o servidor...</p>
            </div>
          ) : (
            <div className="max-w-7xl mx-auto">
              
              {/* Usuários Ativos (Formato Tabela Profissional) */}
              {activeTab === 'users' && (
                <div className="bg-[#161b22] border border-slate-800/60 rounded-2xl shadow-xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-900/50 border-b border-slate-800/60">
                          <th className="px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Usuário</th>
                          <th className="px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">ID Único</th>
                          <th className="px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Status</th>
                          <th className="px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider text-right">Ações</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60">
                        {users.map(user => (
                          <tr key={user.id} className="hover:bg-slate-800/30 transition-colors group">
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                <img src={user.profilePicture || 'https://resource.trickle.so/coding_trickle/trickle_avatar.png'} alt="Avatar" className="w-10 h-10 rounded-full object-cover bg-slate-800 border border-slate-700" />
                                <div>
                                  <p className="font-medium text-slate-200">{user.username || user.nome || 'Sem Nome'}</p>
                                  <p className="text-xs text-slate-500">{user.email || 'Sem email'}</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <code className="text-xs text-slate-400 bg-slate-900 px-2 py-1 rounded border border-slate-800 font-mono">
                                {user.id.substring(0, 15)}...
                              </code>
                            </td>
                            <td className="px-6 py-4">
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                                Ativo
                              </span>
                            </td>
                            <td className="px-6 py-4 text-right">
                              <div className="flex justify-end gap-2">
                                <button onClick={() => setSelectedUser(user)} className="p-2 text-slate-400 hover:text-indigo-400 hover:bg-indigo-500/10 rounded-lg transition-colors" title="Inspecionar">
                                  <div className="icon-eye"></div>
                                </button>
                                <button onClick={() => openBanModal(user)} className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors" title="Banir">
                                  <div className="icon-gavel"></div>
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {users.length === 0 && (
                    <div className="p-12 text-center text-slate-500">Nenhum usuário ativo encontrado.</div>
                  )}
                </div>
              )}

              {/* Usuários Banidos (Formato Tabela Profissional) */}
              {activeTab === 'banned' && (
                <div className="bg-[#161b22] border border-red-900/30 rounded-2xl shadow-xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-900/50 border-b border-slate-800/60">
                          <th className="px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Usuário</th>
                          <th className="px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Motivo / Tipo</th>
                          <th className="px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Apelação</th>
                          <th className="px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider text-right">Ações</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60">
                        {bannedUsers.map(bUser => {
                          const originalData = bUser.backup ? JSON.parse(decodeURIComponent(escape(atob(bUser.backup)))) : {};
                          const isTemp = !!bUser.banUntil;
                          const expired = isTemp && Date.now() > bUser.banUntil;
                          const userAppeal = appeals.find(a => a.userId === bUser.id);
                          
                          return (
                            <tr key={bUser.id} className="hover:bg-slate-800/30 transition-colors">
                              <td className="px-6 py-4">
                                <div className="flex items-center gap-3">
                                  <div className="relative">
                                    <img src={originalData.profilePicture || 'https://resource.trickle.so/coding_trickle/trickle_avatar.png'} alt="Avatar" className="w-10 h-10 rounded-full object-cover bg-slate-800 border border-slate-700 grayscale opacity-70" />
                                    <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-red-500 rounded-full border-2 border-[#161b22] flex items-center justify-center">
                                      <div className="icon-x text-[8px] text-white font-bold"></div>
                                    </div>
                                  </div>
                                  <div>
                                    <p className="font-medium text-slate-300 line-through decoration-red-500/50">{originalData.username || originalData.nome || 'Desconhecido'}</p>
                                    <code className="text-[10px] text-slate-500 font-mono">{bUser.id.substring(0, 15)}...</code>
                                  </div>
                                </div>
                              </td>
                              <td className="px-6 py-4">
                                <div className="flex flex-col gap-1">
                                  <span className={`inline-flex items-center w-fit px-2 py-0.5 rounded text-[10px] font-medium border ${
                                    isTemp ? (expired ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border-amber-500/20')
                                    : 'bg-red-500/10 text-red-400 border-red-500/20'
                                  }`}>
                                    {isTemp ? (expired ? 'Expirado' : `Temp: ${new Date(bUser.banUntil).toLocaleDateString()}`) : 'Permanente'}
                                  </span>
                                  {bUser.reason && <p className="text-xs text-slate-400 max-w-xs truncate">{bUser.reason}</p>}
                                </div>
                              </td>
                              <td className="px-6 py-4">
                                {userAppeal ? (
                                  <div className="flex flex-col gap-2 bg-slate-900/50 p-3 rounded-lg border border-slate-800">
                                    <div className="flex items-center justify-between">
                                      <span className="text-xs font-semibold text-slate-300">Selfie enviada</span>
                                      <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                                        userAppeal.status === 'pendente' ? 'bg-amber-500/20 text-amber-400' :
                                        userAppeal.status === 'aprovado' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
                                      }`}>{userAppeal.status}</span>
                                    </div>
                                    {userAppeal.status === 'pendente' && (
                                      <div className="flex gap-2 mt-1">
                                        <button onClick={() => handleUpdateAppealStatus(userAppeal.id, 'aprovado', bUser)} className="flex-1 py-1 bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 rounded text-[10px] font-bold transition">Aprovar</button>
                                        <button onClick={() => handleUpdateAppealStatus(userAppeal.id, 'rejeitado', null)} className="flex-1 py-1 bg-red-500/20 text-red-400 hover:bg-red-500/30 rounded text-[10px] font-bold transition">Rejeitar</button>
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-xs text-slate-500 italic">Nenhuma apelação</span>
                                )}
                              </td>
                              <td className="px-6 py-4 text-right">
                                <button onClick={() => handleUnbanUser(bUser)} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-emerald-500/10 text-slate-300 hover:text-emerald-400 border border-slate-700 rounded-lg text-xs font-medium transition-all">
                                  <div className="icon-rotate-ccw"></div> Restaurar
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  {bannedUsers.length === 0 && (
                    <div className="p-12 text-center text-slate-500">Nenhum usuário banido no momento.</div>
                  )}
                </div>
              )}

              {/* Moderações */}
              {activeTab === 'moderations' && (
                <div className="space-y-4">
                  {moderations.length === 0 && (
                    <div className="bg-[#161b22] border border-slate-800/60 rounded-2xl p-12 text-center text-slate-500 shadow-sm">
                      <div className="icon-shield-check text-4xl mx-auto mb-3 text-emerald-500/50"></div>
                      <p>Nenhuma infração registrada pelo sistema automático.</p>
                    </div>
                  )}
                  {moderations.map(mod => {
                    const user = users.find(u => u.id === mod.usuarioId) || {};
                    return (
                      <div key={mod.id} className="bg-[#161b22] border border-amber-900/30 hover:border-amber-500/50 transition-colors rounded-2xl p-5 shadow-lg flex flex-col md:flex-row gap-6 items-start md:items-center">
                        <div className="flex items-center gap-4 min-w-[200px]">
                          <img src={user.profilePicture || 'https://resource.trickle.so/coding_trickle/trickle_avatar.png'} alt="Avatar" className="w-12 h-12 rounded-full object-cover bg-slate-800 border border-slate-700" />
                          <div>
                            <h3 className="font-semibold text-slate-200">{user.username || user.nome || 'Usuário Desconhecido'}</h3>
                            <p className="text-xs text-slate-500">ID: {mod.usuarioId?.substring(0,8)}...</p>
                          </div>
                        </div>
                        
                        <div className="flex-1 bg-slate-900/50 p-4 rounded-xl border border-slate-800 w-full relative">
                          <div className="absolute top-4 right-4 text-[10px] text-slate-500">{new Date(mod.timestamp).toLocaleString()}</div>
                          <span className="inline-block px-2 py-0.5 bg-red-500/10 text-red-400 border border-red-500/20 rounded text-[10px] font-bold uppercase mb-2">
                            {mod.bloqueado ? 'Mensagem Bloqueada' : 'Alerta Leve'}
                          </span>
                          <p className="text-sm text-slate-300 mb-2 border-l-2 border-slate-700 pl-3 italic">"{mod.mensagemOriginal}"</p>
                          <p className="text-xs text-amber-500 font-medium">Filtro acionado por: <span className="text-amber-400 bg-amber-500/10 px-1 rounded">{mod.palavraDetectada}</span></p>
                        </div>

                        <div className="flex flex-col gap-2 min-w-[140px]">
                          <button onClick={() => { if (user.id) openBanModal(user); else alert('Usuário não encontrado.'); }} className="w-full px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm font-semibold transition-colors shadow-lg shadow-red-500/20">
                            Banir Usuário
                          </button>
                          <button onClick={() => handleDismissModeration(mod.id)} className="w-full px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm font-medium transition-colors border border-slate-700">
                            Ignorar (Limpar)
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Lives Ativas */}
              {activeTab === 'lives' && (
                <div className="bg-[#161b22] border border-slate-800/60 rounded-2xl shadow-xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-900/50 border-b border-slate-800/60">
                          <th className="px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Host</th>
                          <th className="px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Título da Live</th>
                          <th className="px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Visualizadores</th>
                          <th className="px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider text-right">Ações</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60">
                        {activeLives.map(live => (
                          <tr key={live.id} className="hover:bg-slate-800/30 transition-colors">
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                <div>
                                  <p className="font-medium text-slate-200">{live.hostName || 'Sem Nome'}</p>
                                  <p className="text-xs text-slate-500">ID: {live.hostId.substring(0, 15)}...</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <p className="text-sm text-slate-300">{live.title}</p>
                              <span className="text-[10px] bg-indigo-500/20 text-indigo-400 px-2 py-0.5 rounded uppercase">{live.category || 'Geral'}</span>
                            </td>
                            <td className="px-6 py-4">
                              <span className="text-emerald-400 font-medium">{live.viewers ? Object.keys(live.viewers).length : 0} online</span>
                            </td>
                            <td className="px-6 py-4 text-right">
                              <div className="flex justify-end gap-2">
                                <button 
                                  onClick={async () => {
                                    if(window.confirm('Tem certeza que deseja derrubar essa live?')) {
                                      await window.firebaseDB.ref(`lives/${live.id}`).remove();
                                      loadData();
                                    }
                                  }} 
                                  className="p-2 text-slate-400 hover:text-orange-400 hover:bg-orange-500/10 rounded-lg transition-colors" title="Derrubar Live"
                                >
                                  <div className="icon-power"></div>
                                </button>
                                <button 
                                  onClick={() => {
                                    const usr = users.find(u => u.id === live.hostId);
                                    if(usr) openBanModal(usr); else alert('Usuário host não encontrado.');
                                  }} 
                                  className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors" title="Banir Host"
                                >
                                  <div className="icon-gavel"></div>
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {activeLives.length === 0 && (
                    <div className="p-12 text-center text-slate-500 flex flex-col items-center">
                        <div className="icon-radio text-4xl mb-3 opacity-30"></div>
                        Nenhuma live online no momento.
                    </div>
                  )}
                </div>
              )}

              {/* Monitoramento de Grupos */}
              {activeTab === 'groups' && (
                <div className="bg-[#161b22] border border-slate-800/60 rounded-2xl shadow-xl overflow-hidden flex flex-col h-[70vh]">
                  <div className="p-6 border-b border-slate-800/60 bg-slate-900/30">
                    <h3 className="text-lg font-semibold text-slate-200">Log de Comunidades (Tempo Real)</h3>
                    <p className="text-sm text-slate-500">Monitoramento passivo de todas as atividades nos grupos.</p>
                  </div>
                  <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar bg-[#0b0d14] font-mono text-sm">
                    {groups.map(group => (
                      <div key={group.id} className="bg-[#161b22] border border-slate-800 p-4 rounded-xl">
                        <div className="flex items-center justify-between mb-3 border-b border-slate-800 pb-2">
                          <span className="text-indigo-400 font-bold">[{group.name}]</span>
                          <span className="text-xs text-slate-500">ID: {group.id}</span>
                        </div>
                        <div className="space-y-2">
                          {group.messages ? Object.entries(group.messages).slice(-10).map(([msgId, msg]) => (
                            <div key={msgId} className="flex gap-3 hover:bg-slate-800/50 p-1 rounded">
                              <span className="text-emerald-400 w-32 truncate shrink-0 text-right">{msg.senderName}:</span> 
                              <span className="text-slate-300 flex-1">{msg.text || (msg.mediaUrl ? '[Mídia Anexada]' : '[Ação do Sistema]')}</span>
                            </div>
                          )) : <div className="text-slate-600 italic">Sem histórico recente.</div>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Sistema & Dados (Danger Zone) */}
              {activeTab === 'danger' && (
                <div className="max-w-3xl mx-auto">
                  <div className="bg-[#161b22] border border-red-900/50 rounded-3xl p-10 shadow-2xl relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-600 to-red-900"></div>
                    
                    <div className="flex items-start gap-6 mb-8">
                      <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center shrink-0">
                        <div className="icon-triangle-alert text-3xl text-red-500"></div>
                      </div>
                      <div>
                        <h2 className="text-2xl font-bold text-slate-100 mb-2">Controle do Banco de Dados</h2>
                        <p className="text-slate-400 leading-relaxed">
                          Ações nesta área são críticas. Um Wipe Server apagará todos os dados de produção (usuários, mensagens, grupos), mantendo apenas as configurações do sistema para o administrador.
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-5 flex flex-col">
                        <h3 className="font-semibold text-slate-200 mb-1">Reset de Fábrica</h3>
                        <p className="text-xs text-slate-500 mb-4 flex-1">Apaga o servidor e salva backup no navegador local.</p>
                        <button onClick={handleWipeAndBackup} className="w-full py-2.5 bg-red-500/10 hover:bg-red-500 border border-red-500/50 hover:border-red-500 text-red-400 hover:text-white rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2">
                          <div className="icon-trash"></div>
                          Wipe Server
                        </button>
                      </div>
                      
                      <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-5 flex flex-col">
                        <h3 className="font-semibold text-slate-200 mb-1">Restaurar Sistema</h3>
                        <p className="text-xs text-slate-500 mb-4 flex-1">Recupera os dados do último backup local realizado.</p>
                        <button onClick={handleRestore} className="w-full py-2.5 bg-indigo-500/10 hover:bg-indigo-500 border border-indigo-500/50 hover:border-indigo-500 text-indigo-400 hover:text-white rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2">
                          <div className="icon-rotate-ccw"></div>
                          Carregar Backup
                        </button>
                      </div>
                    </div>

                    <div className="mt-6 bg-amber-500/10 border border-amber-500/20 p-4 rounded-xl flex items-start gap-3">
                      <div className="icon-info text-amber-500 mt-0.5"></div>
                      <p className="text-xs text-amber-500/90 leading-relaxed">
                        <strong>Nota Técnica:</strong> O backup local depende do `localStorage` do navegador, que geralmente tem um limite de 5MB a 10MB. Se a base for muito grande, o backup pode falhar. Recomenda-se realizar exportação direta via painel do Firebase para bases maiores.
                      </p>
                    </div>
                  </div>
                </div>
              )}

            </div>
          )}
        </div>
      </div>

      {/* Modal de Inspeção */}
      {selectedUser && (
        <div className="fixed inset-0 bg-[#0b0d14]/90 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-[#161b22] border border-slate-800 shadow-2xl rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
              <h3 className="font-semibold text-slate-200 flex items-center gap-2">
                <div className="icon-file-code text-indigo-400"></div> Inspeção de Dados Brutos
              </h3>
              <button onClick={() => setSelectedUser(null)} className="text-slate-500 hover:text-slate-300 transition-colors p-1 bg-slate-800 rounded-lg">
                <div className="icon-x"></div>
              </button>
            </div>
            <div className="p-6 overflow-y-auto flex-1 font-mono text-xs text-emerald-400 bg-[#0b0d14] custom-scrollbar">
              <pre>{JSON.stringify(selectedUser, null, 2)}</pre>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Banimento Profissional */}
      {banModalUser && (
        <div className="fixed inset-0 bg-[#0b0d14]/90 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-[#161b22] border border-red-900/30 shadow-2xl rounded-2xl w-full max-w-md flex flex-col overflow-hidden">
            <div className="px-6 py-5 border-b border-slate-800 bg-slate-900/50 text-center">
              <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-3">
                <div className="icon-gavel text-2xl text-red-500"></div>
              </div>
              <h3 className="font-bold text-slate-100 text-lg">Aplicar Punição</h3>
              <p className="text-sm text-slate-400">Alvo: <strong className="text-slate-200">{banModalUser.username || banModalUser.nome}</strong></p>
            </div>
            
            <div className="p-6 overflow-y-auto max-h-[60vh] custom-scrollbar">
              <div className="mb-6">
                <label className="flex items-center justify-between cursor-pointer p-3 bg-slate-900 border border-slate-800 rounded-xl hover:border-slate-700 transition-colors">
                  <span className="text-sm font-medium text-slate-300">Incluir motivo (opcional)</span>
                  <div className="relative inline-block w-10 h-5 align-middle select-none transition duration-200 ease-in">
                    <input type="checkbox" className="toggle-checkbox absolute block w-5 h-5 rounded-full bg-white border-4 border-slate-700 appearance-none cursor-pointer transition-transform duration-200" style={{ transform: includeReason ? 'translateX(1.25rem)' : 'translateX(0)', borderColor: includeReason ? '#6366f1' : '#334155' }} checked={includeReason} onChange={(e) => setIncludeReason(e.target.checked)} />
                    <div className={`toggle-label block overflow-hidden h-5 rounded-full cursor-pointer transition-colors duration-200 ${includeReason ? 'bg-indigo-500' : 'bg-slate-700'}`}></div>
                  </div>
                </label>
                
                {includeReason && (
                  <div className="mt-3 space-y-3 animate-in fade-in slide-in-from-top-2">
                    <div className="flex flex-wrap gap-1.5">
                      {banTemplates.map((template, idx) => (
                        <button key={idx} onClick={() => setBanReason(template)} className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-medium rounded border border-slate-700 transition-colors">
                          {template}
                        </button>
                      ))}
                    </div>
                    <textarea value={banReason} onChange={(e) => setBanReason(e.target.value)} placeholder="Descreva o motivo detalhado..." className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-slate-200 text-sm focus:outline-none focus:border-indigo-500 transition-colors min-h-[80px] resize-none"></textarea>
                    <div className="flex gap-2">
                      <input type="text" value={newTemplateText} onChange={(e) => setNewTemplateText(e.target.value)} placeholder="Criar novo template rápido..." className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-slate-200 text-xs focus:outline-none focus:border-indigo-500" />
                      <button onClick={handleAddTemplate} className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border border-slate-700">Salvar</button>
                    </div>
                  </div>
                )}
              </div>

              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Duração da Suspensão</p>
              <div className="grid grid-cols-2 gap-2 mb-4">
                <button onClick={() => handleBanUser(banModalUser, '15m')} className="py-2.5 bg-slate-800 hover:bg-amber-500/10 hover:text-amber-400 border border-slate-700 hover:border-amber-500/30 text-slate-300 rounded-xl text-sm font-medium transition-all">15 Minutos</button>
                <button onClick={() => handleBanUser(banModalUser, '1h')} className="py-2.5 bg-slate-800 hover:bg-orange-500/10 hover:text-orange-400 border border-slate-700 hover:border-orange-500/30 text-slate-300 rounded-xl text-sm font-medium transition-all">1 Hora</button>
                <button onClick={() => handleBanUser(banModalUser, '24h')} className="py-2.5 bg-slate-800 hover:bg-red-500/10 hover:text-red-400 border border-slate-700 hover:border-red-500/30 text-slate-300 rounded-xl text-sm font-medium transition-all">24 Horas</button>
                <button onClick={() => handleBanUser(banModalUser, '7d')} className="py-2.5 bg-slate-800 hover:bg-red-600/10 hover:text-red-500 border border-slate-700 hover:border-red-600/30 text-slate-300 rounded-xl text-sm font-medium transition-all">7 Dias</button>
              </div>
              <button onClick={() => handleBanUser(banModalUser, 'permanent')} className="w-full py-3 bg-red-500/10 hover:bg-red-600 text-red-500 hover:text-white border border-red-500/30 rounded-xl text-sm font-bold transition-all shadow-lg hover:shadow-red-500/20 flex justify-center items-center gap-2">
                <div className="icon-shield-ban"></div> Banimento Permanente
              </button>
            </div>
            
            <div className="px-6 py-4 border-t border-slate-800 bg-slate-900/50">
              <button onClick={() => setBanModalUser(null)} className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm font-medium transition-colors">Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* Estilos Globais Injetados para Scrollbar */}
      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #334155; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #475569; }
      `}} />
    </div>
  );
}
window.AdminPanel = AdminPanel;