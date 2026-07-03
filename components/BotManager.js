function BotManager({ user }) {
    const db = window.firebaseDB;
    const [bots, setBots] = React.useState([]);
    const [showCreate, setShowCreate] = React.useState(false);
    const [botName, setBotName] = React.useState('');
    const [botUsername, setBotUsername] = React.useState('');
    const [botAvatarUrl, setBotAvatarUrl] = React.useState('');
    const [botDescription, setBotDescription] = React.useState('');
    const [loading, setLoading] = React.useState(false);
    const [toastMessage, setToastMessage] = React.useState(null);
    const [showAddGroupModal, setShowAddGroupModal] = React.useState(null); // holds botId
    const [showHostModal, setShowHostModal] = React.useState(false);
    const [userGroups, setUserGroups] = React.useState([]);
    const [selectedGroup, setSelectedGroup] = React.useState('');
    const [activeLink, setActiveLink] = React.useState({ botId: null, url: '' });

    React.useEffect(() => {
        if (!db) return;
        const ref = db.ref('users');
        ref.orderByChild('ownerId').equalTo(user.id).on('value', snap => {
            const data = snap.val();
            if (data) {
                const botList = Object.keys(data)
                    .map(k => ({ id: k, ...data[k] }))
                    .filter(u => u.isBot === true);
                setBots(botList);
            } else {
                setBots([]);
            }
        });
        return () => ref.off();
    }, [db, user.id]);

    const showToast = (message, type = "success") => {
        setToastMessage({ message, type });
        setTimeout(() => setToastMessage(null), 3000);
    };

    const handleCreateBot = async () => {
        if (!botName.trim() || !botUsername.trim()) {
            showToast("Preencha todos os campos", "error");
            return;
        }

        const sUser = botUsername.trim().toLowerCase().replace('@', '').replace(/[^a-z0-9_]/g, '');
        if (sUser.length < 3) {
            showToast("O @arroba deve ter pelo menos 3 caracteres", "error");
            return;
        }

        setLoading(true);
        try {
            // Check if username exists
            const snap = await db.ref('users').orderByChild('username').equalTo(sUser).once('value');
            if (snap.exists()) {
                showToast("Este @arroba já está em uso!", "error");
                setLoading(false);
                return;
            }

            const botId = `bot_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;

            const inviteToken = `inv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

            const botData = {
                name: botName.trim(),
                username: sUser,
                description: botDescription.trim(),
                isBot: true,
                ownerId: user.id,
                createdAt: Date.now(),
                profilePicture: botAvatarUrl.trim() || null,
                inviteToken: inviteToken
            };

            await db.ref(`users/${botId}`).set(botData);
            
            showToast("Bot criado com sucesso!");
            setShowCreate(false);
            setBotName('');
            setBotUsername('');
            setBotAvatarUrl('');
            setBotDescription('');
        } catch (error) {
            console.error(error);
            showToast("Erro ao criar bot", "error");
        } finally {
            setLoading(false);
        }
    };

    const copyToClipboard = (text) => {
        navigator.clipboard.writeText(text);
        showToast("Copiado para a área de transferência!");
    };

    const handleDeleteBot = async (botId) => {
        if (window.confirm("Deseja realmente excluir este bot? Esta ação não pode ser desfeita.")) {
            await db.ref(`users/${botId}`).remove();
            showToast("Bot excluído!");
        }
    };

    const generateInviteLink = async (bot) => {
        let token = bot.inviteToken;
        if (!token) {
            token = `inv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            await db.ref(`users/${bot.id}/inviteToken`).set(token);
        }
        const url = window.location.href.split('?')[0].replace('bots.html', 'invite_bot.html') + '?token=' + token;
        setActiveLink({ botId: bot.id, url });
    };

    const openAddGroupModal = async (botId) => {
        setShowAddGroupModal(botId);
        setSelectedGroup('');
        setLoading(true);
        try {
            const snap = await db.ref('groups').once('value');
            const data = snap.val();
            if (data) {
                const ownedGroups = Object.keys(data).filter(gid => {
                    const gData = data[gid];
                    const isMemberAdmin = gData?.members && (gData.members[user.id] === 'admin' || gData.members[user.id] === 'owner' || gData.members[user.id]?.role === 'admin' || gData.members[user.id]?.role === 'owner');
                    return gData && (gData.createdBy === user.id || gData.ownerId === user.id || gData.admin === user.id || isMemberAdmin);
                }).map(gid => ({ id: gid, name: data[gid].name || data[gid].groupName || 'Grupo' }));
                setUserGroups(ownedGroups);
            } else {
                setUserGroups([]);
            }
        } catch (e) {
            console.error(e);
            showToast("Erro ao carregar seus grupos.", "error");
        } finally {
            setLoading(false);
        }
    };

    const handleAddBotToGroup = async () => {
        if (!selectedGroup || !showAddGroupModal) return;
        setLoading(true);
        try {
            const botId = showAddGroupModal;
            const bot = bots.find(b => b.id === botId);
            const groupInfo = userGroups.find(g => g.id === selectedGroup);

            const memberSnap = await db.ref(`groups/${selectedGroup}/members/${botId}`).once('value');
            if (memberSnap.exists()) {
                showToast("O bot já faz parte deste grupo!", "error");
                setLoading(false);
                return;
            }

            await db.ref(`groups/${selectedGroup}/members/${botId}`).set({ role: 'membro', joinedAt: Date.now() });
            await db.ref(`users/${botId}/chats/${selectedGroup}`).set({
                name: groupInfo.name,
                type: 'group',
                timestamp: Date.now()
            });
            await db.ref(`groups/${selectedGroup}/auditLog`).push({
                timestamp: Date.now(),
                user: user.name,
                action: `Adicionou o bot @${bot.username} ao grupo diretamente pelo portal.`
            });

            // System message
            await db.ref(`chats/${selectedGroup}/messages`).push({
                senderId: 'system',
                text: `O bot @${bot.username} foi adicionado ao grupo.`,
                timestamp: Date.now(),
                type: 'system'
            });

            showToast("Bot adicionado ao grupo com sucesso!");
            setShowAddGroupModal(null);
        } catch (err) {
            console.error(err);
            showToast("Erro ao adicionar bot ao grupo.", "error");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex flex-col min-h-screen bg-gray-50" data-name="bot-manager">
            <header className="bg-white shadow-sm px-4 py-3 flex items-center justify-between sticky top-0 z-20">
                <div className="flex items-center gap-4">
                    <button onClick={() => window.location.href = 'index.html'} className="p-2 hover:bg-gray-100 rounded-full text-gray-600">
                        <div className="icon-arrow-left text-xl"></div>
                    </button>
                    <h1 className="text-xl font-bold text-gray-800">Portal do Desenvolvedor</h1>
                </div>
            </header>

            <main className="flex-1 w-full max-w-4xl mx-auto p-4 sm:p-6 animate-fade-in-up">
                <div className="bg-gradient-to-r from-gray-800 to-gray-900 rounded-2xl p-6 mb-8 text-white shadow-lg relative overflow-hidden">
                    <div className="relative z-10">
                        <h2 className="text-2xl font-bold mb-2 flex items-center gap-2">
                            <div className="icon-bot"></div> Meus Bots
                        </h2>
                        <p className="text-gray-300 max-w-lg mb-6 text-sm">
                            Crie bots para interagir nos seus grupos. Adicione o bot aos seus próprios grupos pelo portal ou envie o link de convite para que outros usuários possam adicioná-lo.
                        </p>
                        <div className="flex flex-wrap gap-3">
                            <button onClick={() => setShowCreate(true)} className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 shadow-md transition-colors flex items-center gap-2">
                                <div className="icon-plus"></div> Novo Bot
                            </button>
                            <button onClick={() => setShowHostModal(true)} className="px-6 py-3 bg-gray-700 text-white rounded-xl font-bold hover:bg-gray-600 shadow-md transition-colors flex items-center gap-2 border border-gray-600">
                                <div className="icon-book-open"></div> Documentação SDK
                            </button>
                        </div>
                    </div>
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 opacity-10 pointer-events-none hidden md:block">
                        <div className="icon-cpu text-[150px]"></div>
                    </div>
                </div>

                <div className="space-y-4">
                    <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2 px-2">
                        Bots Registrados ({bots.length})
                    </h3>

                    {bots.length === 0 ? (
                        <div className="text-center py-12 px-4 bg-white rounded-2xl border border-gray-200 border-dashed">
                            <div className="icon-bot text-5xl text-gray-300 mb-4 mx-auto"></div>
                            <p className="text-gray-500 font-medium">Você ainda não tem nenhum bot.</p>
                        </div>
                    ) : (
                        <div className="grid gap-4">
                            {bots.map(bot => (
                                <div key={bot.id} className="bg-white p-5 rounded-2xl shadow-sm border border-gray-200">
                                    <div className="flex justify-between items-start mb-4">
                                        <div className="flex items-center gap-4">
                                            {bot.profilePicture ? (
                                                <img src={bot.profilePicture} alt="Avatar" className="w-14 h-14 rounded-xl object-cover border border-indigo-100 shadow-sm" />
                                            ) : (
                                                <div className="w-14 h-14 bg-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center text-3xl shadow-sm">
                                                    <div className="icon-bot"></div>
                                                </div>
                                            )}
                                            <div>
                                                <h4 className="font-bold text-gray-800 text-lg">{bot.name}</h4>
                                                <p className="text-sm text-indigo-600 font-bold">@{bot.username}</p>
                                                {bot.description && <p className="text-xs text-gray-500 mt-1 max-w-sm line-clamp-2">{bot.description}</p>}
                                            </div>
                                        </div>
                                        <button onClick={() => handleDeleteBot(bot.id)} className="text-red-500 hover:bg-red-50 p-2 rounded-lg transition-colors" title="Excluir Bot">
                                            <div className="icon-trash-2"></div>
                                        </button>
                                    </div>
                                    
                                    <div className="mt-4 flex flex-wrap gap-2">
                                        <button onClick={() => generateInviteLink(bot)} className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 px-4 py-2 rounded-xl font-bold transition-colors flex items-center gap-2 text-sm">
                                            <div className="icon-link"></div> Gerar Link de Convite
                                        </button>
                                        <button onClick={() => openAddGroupModal(bot.id)} className="bg-green-50 hover:bg-green-100 text-green-700 px-4 py-2 rounded-xl font-bold transition-colors flex items-center gap-2 text-sm">
                                            <div className="icon-users"></div> Adicionar ao Grupo
                                        </button>
                                        <button onClick={() => copyToClipboard(bot.id)} className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-xl font-bold transition-colors flex items-center gap-2 text-sm">
                                            <div className="icon-copy"></div> Copiar ID
                                        </button>
                                    </div>

                                    {activeLink.botId === bot.id && (
                                        <div className="mt-4 bg-green-50 border border-green-200 rounded-xl p-4 animate-fade-in-up w-full">
                                            <p className="text-xs text-green-800 font-bold mb-2">Link de Convite Gerado!</p>
                                            <div className="flex gap-2">
                                                <input type="text" readOnly value={activeLink.url} className="flex-1 bg-white border border-green-200 rounded-lg px-3 py-2 text-sm text-gray-600 outline-none" />
                                                <button onClick={() => copyToClipboard(activeLink.url)} className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-bold text-sm transition-colors">Copiar</button>
                                            </div>
                                        </div>
                                    )}

                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </main>

            {showCreate && (
                <div className="fixed inset-0 bg-gray-900 bg-opacity-50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md animate-fade-in-up">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-bold text-gray-800">Criar Novo Bot</h2>
                            <button onClick={() => setShowCreate(false)} className="text-gray-400 hover:text-gray-600">
                                <div className="icon-x text-xl"></div>
                            </button>
                        </div>
                        
                        <div className="space-y-4 mb-6 max-h-96 overflow-y-auto px-1 no-scrollbar">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Nome do Bot</label>
                                <input 
                                    type="text" 
                                    value={botName}
                                    onChange={e => setBotName(e.target.value)}
                                    placeholder="Ex: AutoModerator, SuporteBot" 
                                    className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                                />
                            </div>
                            
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Username do Bot (@arroba)</label>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">@</span>
                                    <input 
                                        type="text" 
                                        value={botUsername}
                                        onChange={e => setBotUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                                        placeholder="meu_bot_legal" 
                                        className="w-full pl-8 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                                    />
                                </div>
                                <p className="text-xs text-gray-500 mt-1">Apenas letras, números e underline (_).</p>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">URL da Foto de Perfil (Opcional)</label>
                                <input 
                                    type="url" 
                                    value={botAvatarUrl}
                                    onChange={e => setBotAvatarUrl(e.target.value)}
                                    placeholder="https://..." 
                                    className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Descrição (Opcional)</label>
                                <textarea 
                                    value={botDescription}
                                    onChange={e => setBotDescription(e.target.value)}
                                    placeholder="Uma breve descrição sobre o que este bot faz..." 
                                    className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none resize-none h-20"
                                ></textarea>
                            </div>
                        </div>

                        <button 
                            onClick={handleCreateBot} 
                            disabled={loading || !botName.trim() || !botUsername.trim()} 
                            className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 disabled:opacity-50 transition-colors flex justify-center items-center gap-2"
                        >
                            {loading ? <div className="icon-loader animate-spin"></div> : 'Criar Bot'}
                        </button>
                    </div>
                </div>
            )}

            {showAddGroupModal && (
                <div className="fixed inset-0 bg-gray-900 bg-opacity-50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm animate-fade-in-up">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-xl font-bold text-gray-800">Adicionar ao Grupo</h2>
                            <button onClick={() => setShowAddGroupModal(null)} className="text-gray-400 hover:text-gray-600">
                                <div className="icon-x text-xl"></div>
                            </button>
                        </div>
                        <p className="text-sm text-gray-600 mb-4">Selecione um dos seus grupos para adicionar este bot diretamente.</p>
                        
                        <div className="mb-6">
                            {userGroups.length === 0 ? (
                                <div className="p-3 bg-gray-100 text-gray-500 rounded-xl text-sm">Você não participa de nenhum grupo.</div>
                            ) : (
                                <select 
                                    value={selectedGroup}
                                    onChange={e => setSelectedGroup(e.target.value)}
                                    className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
                                >
                                    <option value="">-- Escolha um grupo --</option>
                                    {userGroups.map(g => (
                                        <option key={g.id} value={g.id}>{g.name}</option>
                                    ))}
                                </select>
                            )}
                        </div>

                        <div className="flex gap-2">
                            <button onClick={() => setShowAddGroupModal(null)} className="flex-1 py-3 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition-colors">Cancelar</button>
                            <button 
                                onClick={handleAddBotToGroup}
                                disabled={loading || !selectedGroup}
                                className="flex-1 py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {loading ? <div className="icon-loader animate-spin"></div> : 'Adicionar'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showHostModal && (
                <div className="fixed inset-0 bg-gray-900 bg-opacity-50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-3xl animate-fade-in-up max-h-[90vh] flex flex-col">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                                <div className="icon-book-open text-indigo-600"></div> Documentação do SDK (Node.js)
                            </h2>
                            <button onClick={() => setShowHostModal(false)} className="text-gray-400 hover:text-gray-600">
                                <div className="icon-x text-xl"></div>
                            </button>
                        </div>
                        
                        <div className="overflow-y-auto pr-2 space-y-6 text-gray-700 text-sm flex-1">
                            <div className="bg-indigo-50 border border-indigo-100 p-4 rounded-xl text-indigo-900">
                                <h3 className="font-bold mb-2 text-base flex items-center gap-2">
                                    <div className="icon-zap"></div> Guia Rápido
                                </h3>
                                <p>O SDK é um motor de mensagens hospedado na nuvem que permite criar bots e automatizar interações em grupos usando apenas algumas linhas de código em Node.js.</p>
                            </div>

                            <div>
                                <h3 className="font-bold text-gray-900 mb-2 text-base border-b pb-2">🚀 Instalação (Sem dependências extras!)</h3>
                                <p className="mb-2 text-gray-600">Requisitos: Apenas Node.js instalado e o ID do seu bot.</p>
                                <div className="bg-gray-900 rounded-xl p-4 relative group text-left">
                                    <button onClick={() => copyToClipboard(`const https = require('https');
const vm = require('vm');

const SDK_URL = 'https://app.mensagens.site.je/bot/sdk.js';

https.get(SDK_URL, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
        const sandbox = { module: { exports: {} }, require: require };
        new vm.Script(data).runInNewContext(sandbox);
        const MessageSDK = sandbox.module.exports;
        
        (async () => {
            const bot = new MessageSDK();
            await bot.iniciar({ botId: 'SEU_BOT_ID_AQUI' });
            
            // Seu código aqui
            const grupos = await bot.listarGrupos();
            console.log('Meus grupos:', grupos);
        })();
    });
});`)} className="absolute right-2 top-2 p-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-gray-300">
                                        <div className="icon-copy"></div>
                                    </button>
                                    <pre className="text-green-400 font-mono text-xs overflow-x-auto whitespace-pre-wrap">
{`const https = require('https');
const vm = require('vm');

const SDK_URL = 'https://app.mensagens.site.je/bot/sdk.js';

https.get(SDK_URL, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
        const sandbox = { module: { exports: {} }, require: require };
        new vm.Script(data).runInNewContext(sandbox);
        const MessageSDK = sandbox.module.exports;
        
        (async () => {
            const bot = new MessageSDK();
            await bot.iniciar({ botId: 'SEU_BOT_ID_AQUI' });
            
            // Seu código aqui
            const grupos = await bot.listarGrupos();
            console.log('Meus grupos:', grupos);
        })();
    });
});`}</pre>
                                </div>
                            </div>

                            <div>
                                <h3 className="font-bold text-gray-900 mb-2 text-base border-b pb-2">🛠️ Funções Principais</h3>
                                <ul className="space-y-2 text-gray-600">
                                    <li><code className="bg-gray-100 px-2 py-0.5 rounded text-indigo-600 font-mono">bot.listarGrupos()</code> - Lista grupos que o bot participa</li>
                                    <li><code className="bg-gray-100 px-2 py-0.5 rounded text-indigo-600 font-mono">bot.enviarMensagem(id, texto)</code> - Envia mensagem para um grupo</li>
                                    <li><code className="bg-gray-100 px-2 py-0.5 rounded text-indigo-600 font-mono">bot.lerMensagens(id, limite)</code> - Lê as últimas mensagens</li>
                                    <li><code className="bg-gray-100 px-2 py-0.5 rounded text-indigo-600 font-mono">bot.listarMembros(id)</code> - Lista membros do grupo</li>
                                    <li><code className="bg-gray-100 px-2 py-0.5 rounded text-indigo-600 font-mono">bot.criarCargo(id, nome, cor)</code> - Cria cargo no grupo</li>
                                    <li><code className="bg-gray-100 px-2 py-0.5 rounded text-indigo-600 font-mono">bot.atribuirCargo(id, user, cargo)</code> - Atribui cargo a um membro</li>
                                    <li><code className="bg-gray-100 px-2 py-0.5 rounded text-indigo-600 font-mono">bot.registrarComando(nome, cb)</code> - Cria comandos para o chat (!comando)</li>
                                    <li><code className="bg-gray-100 px-2 py-0.5 rounded text-indigo-600 font-mono">bot.iniciarMonitoramento(id)</code> - Monitora grupo em tempo real</li>
                                </ul>
                            </div>

                            <div>
                                <h3 className="font-bold text-gray-900 mb-2 text-base border-b pb-2">💬 Exemplo: Criando um Comando</h3>
                                <div className="bg-gray-900 rounded-xl p-4 relative group text-left">
                                    <button onClick={() => copyToClipboard(`bot.registrarComando('ping', async (args, ctx) => {
    await ctx.enviarMsg('pong!');
});`)} className="absolute right-2 top-2 p-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-gray-300">
                                        <div className="icon-copy"></div>
                                    </button>
                                    <pre className="text-green-400 font-mono text-xs overflow-x-auto whitespace-pre-wrap">
{`// O bot responderá a '!ping' no chat automaticamente
bot.registrarComando('ping', async (args, ctx) => {
    await ctx.enviarMsg('pong!');
});`}</pre>
                                </div>
                            </div>
                            
                            <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-xl text-yellow-800">
                                <h4 className="font-bold mb-1 flex items-center gap-2"><div className="icon-triangle-alert"></div> Limites e Privacidade</h4>
                                <ul className="list-disc pl-5 space-y-1">
                                    <li>O bot só acessa grupos nos quais foi adicionado.</li>
                                    <li>Não é possível listar grupos que o bot não participa.</li>
                                    <li>As mensagens enviadas e recebidas são seguras.</li>
                                </ul>
                            </div>
                        </div>

                        <div className="mt-6 pt-4 border-t border-gray-100">
                            <button 
                                onClick={() => setShowHostModal(false)} 
                                className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-colors"
                            >
                                Fechar Documentação
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {toastMessage && (
                <div className={`fixed bottom-6 right-4 p-4 rounded-xl shadow-2xl text-white font-medium z-[100] flex items-center gap-2 transform transition-all animate-fade-in-up ${toastMessage.type === 'error' ? 'bg-red-500' : 'bg-gray-800'}`}>
                    <div className={`icon-${toastMessage.type === 'error' ? 'alert-circle' : 'check-circle'} text-xl`}></div>
                    {toastMessage.message}
                </div>
            )}
        </div>
    );
}

window.BotManager = BotManager;