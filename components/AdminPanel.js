function AdminPanel() {
  const [activeTab, setActiveTab] = React.useState('users');
  const [users, setUsers] = React.useState([]);
  const [bannedUsers, setBannedUsers] = React.useState([]);
  const [groups, setGroups] = React.useState([]);
  const [appeals, setAppeals] = React.useState([]);
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

      setUsers(usersList);
      setBannedUsers(bannedList);
      setGroups(groupsList);
      setAppeals(appealsList);
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
        // Se aprovado, desbane automaticamente
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
    // type pode ser: 'permanent', '1h', '24h', '7d'
    let banUntil = null;
    let label = 'Permanente';
    const now = Date.now();
    
    if (type === '1h') { banUntil = now + (60 * 60 * 1000); label = '1 Hora'; }
    if (type === '24h') { banUntil = now + (24 * 60 * 60 * 1000); label = '24 Horas'; }
    if (type === '7d') { banUntil = now + (7 * 24 * 60 * 60 * 1000); label = '7 Dias'; }

    try {
      // 1. Converter dados do usuário para Base64 (backup)
      const userJsonString = JSON.stringify(user);
      const base64Data = btoa(unescape(encodeURIComponent(userJsonString)));

      // 2. Salvar flag de banimento com o backup no nó 'banned_users'
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

      // 3. Remover usuário do nó principal
      await window.firebaseDB.ref(`users/${user.id}`).remove();

      // Atualiza a lista local
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
    if (!window.confirm("⚠️ ATENÇÃO: Isso apagará TODO o banco de dados do servidor (usuários, grupos, mensagens) e criará um backup no armazenamento local do seu navegador. O seu acesso de administrador será mantido. Tem certeza que deseja continuar?")) return;
    
    setLoading(true);
    try {
      // Pega todos os dados do banco
      const snap = await window.firebaseDB.ref('/').once('value');
      const allData = snap.val();
      
      if (allData) {
        // Salva backup no localStorage
        localStorage.setItem('admin_db_backup', JSON.stringify(allData));
        
        // Apaga tudo
        await window.firebaseDB.ref('/').remove();
        
        // Restaura as configurações do sistema para o admin não perder o acesso
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

  return (
    <div className="flex h-screen overflow-hidden" data-name="admin-panel" data-file="components/AdminPanel.js">
      {/* Sidebar */}
      <div className="w-64 bg-gray-800 border-r border-gray-700 flex flex-col">
        <div className="p-4 border-b border-gray-700 flex items-center gap-3">
          <div className="icon-shield-check text-2xl text-green-500"></div>
          <h1 className="font-bold text-lg text-white">Central Admin</h1>
        </div>
        <nav className="flex-1 p-4 space-y-2">
          <button 
            onClick={() => setActiveTab('users')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${activeTab === 'users' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:bg-gray-700 hover:text-white'}`}
          >
            <div className="icon-users"></div> Usuários
          </button>
          <button 
            onClick={() => setActiveTab('banned')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${activeTab === 'banned' ? 'bg-red-600 text-white' : 'text-gray-400 hover:bg-gray-700 hover:text-white'}`}
          >
            <div className="icon-user-x"></div> Banidos ({bannedUsers.length})
          </button>
          <button 
            onClick={() => setActiveTab('groups')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${activeTab === 'groups' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:bg-gray-700 hover:text-white'}`}
          >
            <div className="icon-message-square"></div> Monitoramento
          </button>
          <button 
            onClick={() => setActiveTab('danger')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${activeTab === 'danger' ? 'bg-red-900 text-white' : 'text-gray-400 hover:bg-gray-700 hover:text-red-500'}`}
          >
            <div className="icon-triangle-alert"></div> Zona Perigosa
          </button>
        </nav>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col bg-gray-900">
        <div className="p-6 border-b border-gray-800 flex justify-between items-center bg-gray-800/50">
          <h2 className="text-xl font-bold capitalize text-white">{activeTab === 'banned' ? 'Usuários Banidos' : activeTab === 'danger' ? 'Zona Perigosa' : activeTab}</h2>
          <button onClick={loadData} className="p-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-gray-300">
            <div className="icon-refresh-cw"></div>
          </button>
        </div>

        <div className="flex-1 overflow-auto p-6">
          {loading ? (
            <div className="flex justify-center items-center h-full">
              <div className="icon-loader animate-spin text-4xl text-indigo-500"></div>
            </div>
          ) : (
            <>
              {activeTab === 'users' && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {users.map(user => (
                    <div key={user.id} className="bg-gray-800 border border-gray-700 rounded-xl p-4 flex flex-col">
                      <div className="flex items-center gap-4 mb-4">
                        <img src={user.profilePicture || 'https://resource.trickle.so/coding_trickle/trickle_avatar.png'} alt="Avatar" className="w-12 h-12 rounded-full object-cover bg-gray-700" />
                        <div>
                          <h3 className="font-bold text-white">{user.username || user.nome || 'Sem Nome'}</h3>
                          <p className="text-xs text-gray-400">ID: {user.id}</p>
                        </div>
                      </div>
                      <div className="mt-auto pt-4 border-t border-gray-700 flex gap-2">
                        <button onClick={() => setSelectedUser(user)} className="flex-1 py-2 bg-indigo-900/30 text-indigo-400 hover:bg-indigo-900/50 rounded-lg text-sm font-medium transition-colors">
                          Inspecionar
                        </button>
                        <button onClick={() => openBanModal(user)} className="flex-1 py-2 bg-red-900/30 text-red-400 hover:bg-red-900/50 rounded-lg text-sm font-medium transition-colors">
                          Banir
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {activeTab === 'banned' && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {bannedUsers.length === 0 && <p className="text-gray-400">Nenhum usuário banido.</p>}
                  {bannedUsers.map(bUser => {
                    const originalData = bUser.backup ? JSON.parse(decodeURIComponent(escape(atob(bUser.backup)))) : {};
                    const isTemp = !!bUser.banUntil;
                    const expired = isTemp && Date.now() > bUser.banUntil;
                    const userAppeal = appeals.find(a => a.userId === bUser.id);
                    
                    return (
                      <div key={bUser.id} className="bg-gray-800 border border-red-900/50 rounded-xl p-4 flex flex-col">
                        <div className="flex items-center gap-4 mb-4">
                          <img src={originalData.profilePicture || 'https://resource.trickle.so/coding_trickle/trickle_avatar.png'} alt="Avatar" className="w-12 h-12 rounded-full object-cover grayscale opacity-50" />
                          <div>
                            <h3 className="font-bold text-gray-300">{originalData.username || originalData.nome || 'Desconhecido'}</h3>
                            <p className="text-xs text-gray-500">ID: {bUser.id}</p>
                          </div>
                        </div>
                        <div className="mb-4 text-xs">
                          {isTemp ? (
                             <span className={expired ? "text-green-400" : "text-yellow-500"}>
                               Temp: expira em {new Date(bUser.banUntil).toLocaleString()} {expired ? '(Expirado)' : ''}
                             </span>
                          ) : (
                             <span className="text-red-500">Banimento Permanente</span>
                          )}
                        </div>
                        
                        {userAppeal && (
                          <div className="mb-4 bg-gray-900 p-3 rounded-lg border border-yellow-900/50">
                            <h4 className="text-yellow-500 font-bold text-xs mb-2 flex items-center gap-2">
                              <div className="icon-scan-face"></div> Verificação Facial (Apelação)
                            </h4>
                            <p className="text-xs text-gray-400 mb-2">Status: <span className="font-bold uppercase text-white">{userAppeal.status}</span></p>
                            
                            {userAppeal.fotoUrl && (
                              <div className="relative mb-3 flex justify-center bg-gray-800 rounded-lg p-2 border border-gray-700">
                                  <img src={userAppeal.fotoUrl} alt="Rosto Capturado" className="w-24 h-24 object-cover rounded-full border-2 border-indigo-500" />
                              </div>
                            )}

                            {userAppeal.metadata && (
                              <div className="grid grid-cols-2 gap-2 mb-3">
                                  <div className="bg-gray-800 p-1.5 rounded border border-gray-700">
                                      <span className="text-[10px] text-gray-500 block">Qualidade</span>
                                      <span className="text-xs font-bold text-green-400">{userAppeal.metadata.qualityScore}%</span>
                                  </div>
                                  <div className="bg-gray-800 p-1.5 rounded border border-gray-700">
                                      <span className="text-[10px] text-gray-500 block">Simetria</span>
                                      <span className="text-xs font-bold text-indigo-400">{(userAppeal.metadata.symmetryScore * 100).toFixed(1)}%</span>
                                  </div>
                                  <div className="bg-gray-800 p-1.5 rounded border border-gray-700">
                                      <span className="text-[10px] text-gray-500 block">Dist. Olhos</span>
                                      <span className="text-xs font-bold text-gray-300">{userAppeal.metadata.eyeDistance}</span>
                                  </div>
                                  <div className="bg-gray-800 p-1.5 rounded border border-gray-700">
                                      <span className="text-[10px] text-gray-500 block">Captura</span>
                                      <span className="text-[10px] font-bold text-gray-300">{new Date(userAppeal.timestamp).toLocaleTimeString()}</span>
                                  </div>
                              </div>
                            )}
                            
                            {userAppeal.status === 'pendente' && (
                              <div className="flex gap-2 mt-2">
                                <button 
                                  onClick={() => handleUpdateAppealStatus(userAppeal.id, 'aprovado', bUser)}
                                  className="flex-1 py-1.5 bg-green-600 text-white rounded text-xs font-bold hover:bg-green-700 transition-colors flex items-center justify-center gap-1"
                                >
                                  <div className="icon-check"></div> Aprovar
                                </button>
                                <button 
                                  onClick={() => handleUpdateAppealStatus(userAppeal.id, 'rejeitado', null)}
                                  className="flex-1 py-1.5 bg-red-600 text-white rounded text-xs font-bold hover:bg-red-700 transition-colors flex items-center justify-center gap-1"
                                >
                                  <div className="icon-x"></div> Rejeitar
                                </button>
                              </div>
                            )}
                          </div>
                        )}

                        <div className="mt-auto pt-4 border-t border-gray-700 flex gap-2">
                          <button onClick={() => handleUnbanUser(bUser)} className="flex-1 py-2 bg-green-900/30 text-green-400 hover:bg-green-900/50 rounded-lg text-sm font-medium transition-colors">
                            Desbanir Manualmente
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {activeTab === 'groups' && (
                <div className="text-gray-400">
                  <p className="mb-4">O monitoramento completo das mensagens, áudios e grupos está em modo leitura direta do banco de dados.</p>
                  <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 font-mono text-sm max-h-[60vh] overflow-y-auto">
                    {groups.map(group => (
                      <div key={group.id} className="mb-6 pb-6 border-b border-gray-700 last:border-0">
                        <h3 className="text-indigo-400 font-bold mb-2">Grupo: {group.name} ({group.id})</h3>
                        <div className="pl-4 border-l-2 border-gray-700">
                          <p className="text-gray-500 mb-2">Mensagens recentes:</p>
                          {group.messages ? Object.entries(group.messages).slice(-5).map(([msgId, msg]) => (
                            <div key={msgId} className="mb-2">
                              <span className="text-green-400">{msg.senderName}:</span> <span className="text-gray-300">{msg.text || (msg.mediaUrl ? '[Mídia]' : '[Outro]')}</span>
                            </div>
                          )) : <span className="text-gray-600 italic">Sem mensagens</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeTab === 'danger' && (
                <div className="max-w-2xl mx-auto mt-8">
                  <div className="bg-red-900/20 border border-red-900 rounded-2xl p-8 text-center">
                    <div className="w-20 h-20 bg-red-900/50 rounded-full flex items-center justify-center mx-auto mb-6">
                      <div className="icon-triangle-alert text-4xl text-red-500"></div>
                    </div>
                    <h2 className="text-2xl font-bold text-red-500 mb-4">Apagar Servidor</h2>
                    <p className="text-gray-300 mb-8 leading-relaxed">
                      Esta ação irá remover todos os usuários, grupos e mensagens da nuvem do Firebase, exceto as configurações de administrador. Um backup completo será gerado e salvo no armazenamento local (localStorage) deste navegador para futura restauração.
                    </p>
                    
                    <div className="flex flex-col sm:flex-row gap-4 justify-center">
                      <button 
                        onClick={handleWipeAndBackup}
                        className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl flex items-center justify-center gap-2 transition-colors"
                      >
                        <div className="icon-trash"></div>
                        Fazer Backup Local e Apagar Tudo
                      </button>
                      
                      <button 
                        onClick={handleRestore}
                        className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl flex items-center justify-center gap-2 transition-colors"
                      >
                        <div className="icon-rotate-ccw"></div>
                        Restaurar Backup Local
                      </button>
                    </div>
                    
                    <div className="mt-8 p-4 bg-black/30 rounded-xl text-sm text-gray-400 text-left border border-gray-800">
                      <p className="mb-2"><strong className="text-gray-300">Nota técnica:</strong> O limite seguro do armazenamento local dos navegadores (localStorage) costuma ser de 5MB a 10MB. Se o seu banco de dados ultrapassar este limite, a restauração pode não funcionar corretamente. Use com sabedoria.</p>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Modal de Inspeção */}
      {selectedUser && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-gray-800 border border-gray-700 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            <div className="p-4 border-b border-gray-700 flex justify-between items-center">
              <h3 className="font-bold text-lg text-white">Inspeção Completa</h3>
              <button onClick={() => setSelectedUser(null)} className="text-gray-400 hover:text-white">
                <div className="icon-x text-xl"></div>
              </button>
            </div>
            <div className="p-6 overflow-y-auto flex-1 text-sm text-gray-300 font-mono">
              <pre>{JSON.stringify(selectedUser, null, 2)}</pre>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Banimento */}
      {banModalUser && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-gray-800 border border-red-900/50 rounded-2xl w-full max-w-lg p-6 text-center max-h-[90vh] flex flex-col">
            <div className="overflow-y-auto pr-2">
              <div className="icon-shield-alert text-5xl text-red-500 mx-auto mb-4"></div>
              <h3 className="text-xl font-bold text-white mb-2">Opções de Banimento</h3>
              <p className="text-sm text-gray-400 mb-6">Escolha a duração da suspensão para {banModalUser.username || banModalUser.nome}</p>
              
              <div className="mb-6 bg-gray-900/50 p-4 rounded-xl text-left border border-gray-700">
                <label className="flex items-center gap-3 cursor-pointer mb-3">
                  <input 
                    type="checkbox" 
                    className="w-5 h-5 rounded border-gray-600 bg-gray-700 text-indigo-500 focus:ring-indigo-500"
                    checked={includeReason}
                    onChange={(e) => setIncludeReason(e.target.checked)}
                  />
                  <span className="text-white font-medium">Incluir motivo do banimento</span>
                </label>
                
                {includeReason && (
                  <div className="mt-4 space-y-4">
                    <div>
                      <p className="text-xs text-gray-400 mb-2 uppercase tracking-wider">Templates Rápidos</p>
                      <div className="flex flex-wrap gap-2">
                        {banTemplates.map((template, idx) => (
                          <button 
                            key={idx}
                            onClick={() => setBanReason(template)}
                            className="px-3 py-1 bg-gray-700 hover:bg-gray-600 text-gray-300 text-xs rounded-lg transition-colors"
                          >
                            {template}
                          </button>
                        ))}
                      </div>
                    </div>
                    
                    <div>
                      <textarea
                        value={banReason}
                        onChange={(e) => setBanReason(e.target.value)}
                        placeholder="Escreva o motivo detalhado..."
                        className="w-full bg-gray-800 border border-gray-600 rounded-lg p-3 text-white text-sm focus:outline-none focus:border-indigo-500 min-h-[80px]"
                      ></textarea>
                    </div>

                    <div className="flex gap-2">
                      <input 
                        type="text"
                        value={newTemplateText}
                        onChange={(e) => setNewTemplateText(e.target.value)}
                        placeholder="Novo template..."
                        className="flex-1 bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500"
                      />
                      <button 
                        onClick={handleAddTemplate}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap"
                      >
                        Salvar
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <button onClick={() => handleBanUser(banModalUser, '1h')} className="w-full py-3 bg-yellow-600 hover:bg-yellow-700 text-white rounded-xl font-medium">1 Hora</button>
                <button onClick={() => handleBanUser(banModalUser, '24h')} className="w-full py-3 bg-orange-600 hover:bg-orange-700 text-white rounded-xl font-medium">24 Horas</button>
                <button onClick={() => handleBanUser(banModalUser, '7d')} className="w-full py-3 bg-red-500 hover:bg-red-600 text-white rounded-xl font-medium">7 Dias</button>
                <button onClick={() => handleBanUser(banModalUser, 'permanent')} className="w-full py-3 bg-red-800 hover:bg-red-900 text-white border border-red-600 rounded-xl font-bold">Permanente</button>
              </div>
              
              <button onClick={() => setBanModalUser(null)} className="mt-6 w-full py-2 text-gray-400 hover:text-white">Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
window.AdminPanel = AdminPanel;