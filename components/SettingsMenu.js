function SettingsMenu({ isOpen, onClose }) {
    const [activeTab, setActiveTab] = React.useState('geral');
    const [deferredPrompt, setDeferredPrompt] = React.useState(null);
    const [isInstalled, setIsInstalled] = React.useState(false);

    // Load real settings state
    const [settings, setSettings] = React.useState(window.SettingsManager.getSettings());

    React.useEffect(() => {
        // PWA Install Event
        const handleBeforeInstallPrompt = (e) => {
            e.preventDefault();
            setDeferredPrompt(e);
            setIsInstalled(false);
        };

        window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

        // Check if already installed
        if (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true) {
            setIsInstalled(true);
        }

        return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    }, []);

    const handleInstallClick = async () => {
        if (deferredPrompt) {
            deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;
            if (outcome === 'accepted') {
                setIsInstalled(true);
            }
            setDeferredPrompt(null);
        }
    };

    const updateSetting = (key, value) => {
        const newSettings = { ...settings, [key]: value };
        setSettings(newSettings);
        window.SettingsManager.saveSettings(newSettings);
    };

    const tabs = [
        { id: 'geral', label: 'Geral', icon: 'smartphone' },
        { id: 'personalizacao', label: 'Personalização', icon: 'palette' },
        { id: 'privacidade', label: 'Privacidade e Segurança', icon: 'shield' },
        { id: 'dados', label: 'Dados e Armazenamento', icon: 'hard-drive' },
        { id: 'avancadas', label: 'Funções Avançadas', icon: 'rocket' },
        { id: 'experiencia', label: 'Experiência', icon: 'gamepad-2' }
    ];

    if (!isOpen) return null;

    const renderTabContent = () => {
        switch (activeTab) {
            case 'geral':
                return (
                    <div className="space-y-6 animate-fade-in">
                        <div className="bg-indigo-50 p-4 rounded-xl flex items-center justify-between border border-indigo-100">
                            <div>
                                <h4 className="font-bold text-indigo-900">Aplicativo PWA</h4>
                                <p className="text-sm text-indigo-700">Instale para acesso rápido e offline</p>
                            </div>
                            {isInstalled ? (
                                <span className="px-3 py-1 bg-green-100 text-green-700 text-sm font-bold rounded-full flex items-center gap-1"><div className="icon-check"></div> Instalado</span>
                            ) : (
                                <button onClick={handleInstallClick} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold shadow transition-colors">
                                    Instalar App
                                </button>
                            )}
                        </div>

                        <div>
                            <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3">Aparência e Idioma</h3>
                            <div className="space-y-4 bg-gray-50 p-4 rounded-xl">
                                <div className="flex justify-between items-center">
                                    <span className="font-medium text-gray-700">Tema</span>
                                    <select value={settings.theme} onChange={e => updateSetting('theme', e.target.value)} className="bg-white border border-gray-200 rounded-lg px-3 py-1.5 outline-none">
                                        <option value="claro">Claro</option>
                                        <option value="escuro">Escuro</option>
                                        <option value="sistema">Sistema</option>
                                    </select>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="font-medium text-gray-700">Idioma</span>
                                    <select value={settings.language} onChange={e => updateSetting('language', e.target.value)} className="bg-white border border-gray-200 rounded-lg px-3 py-1.5 outline-none">
                                        <option value="pt-BR">Português</option>
                                        <option value="en">Inglês</option>
                                        <option value="es">Espanhol</option>
                                    </select>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="font-medium text-gray-700">Tamanho da fonte</span>
                                    <select value={settings.fontSize} onChange={e => updateSetting('fontSize', e.target.value)} className="bg-white border border-gray-200 rounded-lg px-3 py-1.5 outline-none">
                                        <option value="pequeno">Pequeno</option>
                                        <option value="medio">Médio</option>
                                        <option value="grande">Grande</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        <div>
                            <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3">Notificações e Sons</h3>
                            <div className="space-y-4 bg-gray-50 p-4 rounded-xl">
                                <label className="flex items-center justify-between cursor-pointer">
                                    <span className="font-medium text-gray-700">Sons no aplicativo</span>
                                    <input type="checkbox" checked={settings.sound} onChange={e => updateSetting('sound', e.target.checked)} className="w-5 h-5 accent-indigo-600" />
                                </label>
                                <label className="flex items-center justify-between cursor-pointer">
                                    <span className="font-medium text-gray-700">Vibrar ao enviar mensagem</span>
                                    <input type="checkbox" checked={settings.vibration} onChange={e => updateSetting('vibration', e.target.checked)} className="w-5 h-5 accent-indigo-600" />
                                </label>
                                <div className="flex justify-between items-center">
                                    <span className="font-medium text-gray-700">Som de notificação</span>
                                    <select value={settings.msgSound} onChange={e => updateSetting('msgSound', e.target.value)} className="bg-white border border-gray-200 rounded-lg px-3 py-1.5 outline-none">
                                        <option value="padrao">Padrão</option>
                                        <option value="sino">Sino</option>
                                        <option value="pop">Pop</option>
                                        <option value="gota">Gota</option>
                                        <option value="retro">Retro</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                    </div>
                );
            case 'personalizacao':
                return (
                    <div className="space-y-6 animate-fade-in">
                        <div>
                            <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3">Estilo Visual</h3>
                            <div className="space-y-4 bg-gray-50 p-4 rounded-xl">
                                <div className="flex justify-between items-center">
                                    <span className="font-medium text-gray-700">Papel de parede do chat</span>
                                    <button className="px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-indigo-600 font-medium hover:bg-gray-50">Escolher</button>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="font-medium text-gray-700">Cor principal do app</span>
                                    <div className="flex gap-2">
                                        <div className="w-6 h-6 rounded-full bg-indigo-600 border-2 border-white ring-2 ring-indigo-300 cursor-pointer"></div>
                                        <div className="w-6 h-6 rounded-full bg-emerald-500 cursor-pointer"></div>
                                        <div className="w-6 h-6 rounded-full bg-rose-500 cursor-pointer"></div>
                                        <div className="w-6 h-6 rounded-full bg-amber-500 cursor-pointer"></div>
                                    </div>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="font-medium text-gray-700">Estilo das bolhas</span>
                                    <select value={settings.bubbleStyle} onChange={e => updateSetting('bubbleStyle', e.target.value)} className="bg-white border border-gray-200 rounded-lg px-3 py-1.5 outline-none">
                                        <option value="arredondado">Arredondado</option>
                                        <option value="quadrado">Quadrado</option>
                                        <option value="bolha">Bolha clássica</option>
                                    </select>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="font-medium text-gray-700">Animação de envio</span>
                                    <select value={settings.animations} onChange={e => updateSetting('animations', e.target.value)} className="bg-white border border-gray-200 rounded-lg px-3 py-1.5 outline-none">
                                        <option value="nenhuma">Nenhuma</option>
                                        <option value="deslizar">Deslizar</option>
                                        <option value="fade">Fade in</option>
                                        <option value="bounce">Bounce</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                    </div>
                );
            case 'privacidade':
                return (
                    <div className="space-y-6 animate-fade-in">
                        <div>
                            <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3">Controle de Privacidade</h3>
                            <div className="space-y-4 bg-gray-50 p-4 rounded-xl">
                                <div className="flex justify-between items-center">
                                    <span className="font-medium text-gray-700">Bloqueio do aplicativo</span>
                                    <select value={settings.appLock} onChange={e => updateSetting('appLock', e.target.value)} className="bg-white border border-gray-200 rounded-lg px-3 py-1.5 outline-none">
                                        <option value="nenhum">Nenhum</option>
                                        <option value="senha">Senha / PIN</option>
                                        <option value="biometria">Impressão Digital / Face ID</option>
                                    </select>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="font-medium text-gray-700">Mensagens temporárias padrão</span>
                                    <select value={settings.disappearingMsgs} onChange={e => updateSetting('disappearingMsgs', e.target.value)} className="bg-white border border-gray-200 rounded-lg px-3 py-1.5 outline-none">
                                        <option value="desligado">Desligado</option>
                                        <option value="5s">5 segundos</option>
                                        <option value="1min">1 minuto</option>
                                        <option value="24h">24 horas</option>
                                    </select>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="font-medium text-gray-700">Visto por último</span>
                                    <select value={settings.lastSeen} onChange={e => updateSetting('lastSeen', e.target.value)} className="bg-white border border-gray-200 rounded-lg px-3 py-1.5 outline-none">
                                        <option value="todos">Todos</option>
                                        <option value="contatos">Meus Contatos</option>
                                        <option value="ninguem">Ninguém</option>
                                    </select>
                                </div>
                                <label className="flex items-center justify-between cursor-pointer">
                                    <span className="font-medium text-gray-700">Confirmação de leitura</span>
                                    <input type="checkbox" checked={settings.readReceipts} onChange={e => updateSetting('readReceipts', e.target.checked)} className="w-5 h-5 accent-indigo-600" />
                                </label>
                            </div>
                        </div>
                        <div>
                            <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3">Sugestões de Amigos</h3>
                            <div className="space-y-4 bg-gray-50 p-4 rounded-xl">
                                <div className="flex justify-between items-center">
                                    <span className="font-medium text-gray-700">Aparecer em sugestões</span>
                                    <select value={settings.suggestionVisibility || 'global'} onChange={async e => {
                                        const newValue = e.target.value;
                                        updateSetting('suggestionVisibility', newValue);
                                        // Atualiza no Firebase
                                        if (window.firebaseDB && window.currentUserData) {
                                            const uid = window.currentUserData.uid || window.currentUserData.userKey;
                                            try {
                                                await window.firebaseDB.ref(`users/${uid}`).update({
                                                    suggestionVisibility: newValue
                                                });
                                            } catch (err) {
                                                console.error("Erro ao salvar visibilidade no servidor", err);
                                            }
                                        }
                                    }} className="bg-white border border-gray-200 rounded-lg px-3 py-1.5 outline-none">
                                        <option value="global">Publicamente (Global)</option>
                                        <option value="nearby">Apenas Próximos (Bairro)</option>
                                        <option value="hidden">Oculto</option>
                                    </select>
                                </div>
                                <p className="text-xs text-gray-500">Selecione "Apenas Próximos" para usar o algoritmo de localização e descobrir pessoas da sua região.</p>
                            </div>
                        </div>
                    </div>
                );
            case 'dados':
                return (
                    <div className="space-y-6 animate-fade-in">
                        <div>
                            <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3">Armazenamento e Backup</h3>
                            <div className="space-y-4 bg-gray-50 p-4 rounded-xl">
                                <div className="flex justify-between items-center">
                                    <span className="font-medium text-gray-700">Backup Automático</span>
                                    <select value={settings.autoBackup} onChange={e => updateSetting('autoBackup', e.target.value)} className="bg-white border border-gray-200 rounded-lg px-3 py-1.5 outline-none">
                                        <option value="diario">Diário</option>
                                        <option value="semanal">Semanal</option>
                                        <option value="mensal">Mensal</option>
                                        <option value="nunca">Nunca</option>
                                    </select>
                                </div>
                                <div className="grid grid-cols-2 gap-3 pt-2">
                                    <button className="py-2 bg-indigo-100 text-indigo-700 rounded-lg font-medium hover:bg-indigo-200">Fazer Backup</button>
                                    <button className="py-2 bg-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-300">Restaurar</button>
                                </div>
                                <hr className="my-2 border-gray-200"/>
                                <label className="flex items-center justify-between cursor-pointer">
                                    <span className="font-medium text-gray-700">Baixar mídia só no Wi-Fi</span>
                                    <input type="checkbox" checked={settings.dataUsageWifiOnly} onChange={e => updateSetting('dataUsageWifiOnly', e.target.checked)} className="w-5 h-5 accent-indigo-600" />
                                </label>
                                <div className="flex justify-between items-center">
                                    <span className="font-medium text-gray-700">Qualidade das imagens</span>
                                    <select value={settings.imgQuality} onChange={e => updateSetting('imgQuality', e.target.value)} className="bg-white border border-gray-200 rounded-lg px-3 py-1.5 outline-none">
                                        <option value="baixa">Baixa (Economia)</option>
                                        <option value="media">Média</option>
                                        <option value="alta">Alta (Original)</option>
                                    </select>
                                </div>
                                <button className="w-full mt-2 py-2.5 text-red-600 border border-red-200 rounded-lg font-medium hover:bg-red-50 flex items-center justify-center gap-2">
                                    <div className="icon-trash-2"></div> Limpar Cache e Mídias
                                </button>
                            </div>
                        </div>
                    </div>
                );
            case 'avancadas':
                return (
                    <div className="space-y-6 animate-fade-in">
                        <div>
                            <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3">Produtividade</h3>
                            <div className="space-y-4 bg-gray-50 p-4 rounded-xl">
                                <button className="w-full flex items-center justify-between py-2 text-left group">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600">
                                            <div className="icon-message-square"></div>
                                        </div>
                                        <span className="font-medium text-gray-700">Respostas Rápidas</span>
                                    </div>
                                    <div className="icon-chevron-right text-gray-400 group-hover:text-indigo-600"></div>
                                </button>
                                <button className="w-full flex items-center justify-between py-2 text-left group">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600">
                                            <div className="icon-keyboard"></div>
                                        </div>
                                        <span className="font-medium text-gray-700">Atalhos de Teclado</span>
                                    </div>
                                    <div className="icon-chevron-right text-gray-400 group-hover:text-indigo-600"></div>
                                </button>
                                <hr className="border-gray-200"/>
                                <label className="flex items-center justify-between cursor-pointer">
                                    <span className="font-medium text-gray-700">Deslizar para responder</span>
                                    <input type="checkbox" checked={settings.swipeReply} onChange={e => updateSetting('swipeReply', e.target.checked)} className="w-5 h-5 accent-indigo-600" />
                                </label>
                                <button className="w-full flex items-center justify-between py-2 text-left group">
                                    <span className="font-medium text-gray-700">Mensagens Agendadas</span>
                                    <div className="icon-chevron-right text-gray-400 group-hover:text-indigo-600"></div>
                                </button>
                            </div>
                        </div>
                    </div>
                );
            case 'experiencia':
                return (
                    <div className="space-y-6 animate-fade-in">
                        <div>
                            <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3">Acessibilidade e Desempenho</h3>
                            <div className="space-y-4 bg-gray-50 p-4 rounded-xl">
                                <label className="flex items-center justify-between cursor-pointer">
                                    <span className="font-medium text-gray-700">Modo escuro automático (18h-6h)</span>
                                    <input type="checkbox" checked={settings.autoDarkMode} onChange={e => updateSetting('autoDarkMode', e.target.checked)} className="w-5 h-5 accent-indigo-600" />
                                </label>
                                <label className="flex items-center justify-between cursor-pointer">
                                    <div className="flex flex-col">
                                        <span className="font-medium text-gray-700">Reduzir animações</span>
                                        <span className="text-xs text-gray-500">Para dispositivos mais lentos</span>
                                    </div>
                                    <input type="checkbox" checked={settings.reduceAnimations} onChange={e => updateSetting('reduceAnimations', e.target.checked)} className="w-5 h-5 accent-indigo-600" />
                                </label>
                                <div className="flex justify-between items-center">
                                    <span className="font-medium text-gray-700">Intensidade da Vibração</span>
                                    <select value={settings.vibrationIntensity} onChange={e => updateSetting('vibrationIntensity', e.target.value)} className="bg-white border border-gray-200 rounded-lg px-3 py-1.5 outline-none">
                                        <option value="leve">Leve</option>
                                        <option value="media">Média</option>
                                        <option value="forte">Forte</option>
                                    </select>
                                </div>
                                <hr className="border-gray-200"/>
                                <button className="w-full flex items-center justify-between py-2 text-left group">
                                    <span className="font-medium text-gray-700">Opções de Leitor de Tela</span>
                                    <div className="icon-chevron-right text-gray-400 group-hover:text-indigo-600"></div>
                                </button>
                            </div>
                        </div>
                    </div>
                );
            default:
                return null;
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-gray-900 bg-opacity-40 backdrop-blur-sm transition-opacity" data-name="settings-menu" data-file="components/SettingsMenu.js">
            <div className="bg-white w-full h-[90vh] sm:h-auto sm:max-h-[85vh] sm:max-w-3xl sm:rounded-2xl shadow-2xl flex flex-col sm:flex-row overflow-hidden transform transition-transform animate-fade-in-up">
                
                {/* Sidebar / Tabs */}
                <div className="sm:w-64 bg-gray-50 border-b sm:border-b-0 sm:border-r border-gray-200 flex-shrink-0 flex flex-col">
                    <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-white sm:bg-transparent">
                        <h2 className="text-xl font-bold text-gray-800">Configurações</h2>
                        <button onClick={onClose} className="p-1 hover:bg-gray-200 rounded-full sm:hidden">
                            <div className="icon-x text-xl"></div>
                        </button>
                    </div>
                    <div className="overflow-x-auto sm:overflow-y-auto flex sm:flex-col p-2 gap-1 no-scrollbar">
                        {tabs.map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`flex items-center gap-3 px-4 py-3 rounded-xl whitespace-nowrap transition-colors font-medium text-sm ${activeTab === tab.id ? 'bg-indigo-100 text-indigo-700' : 'text-gray-600 hover:bg-gray-100'}`}
                            >
                                <div className={`icon-${tab.icon} text-lg`}></div>
                                <span className="hidden sm:inline">{tab.label}</span>
                                <span className="sm:hidden">{tab.label.split(' ')[0]}</span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Content Area */}
                <div className="flex-1 flex flex-col bg-white overflow-hidden">
                    <div className="hidden sm:flex items-center justify-between p-4 border-b border-gray-100">
                        <h2 className="text-lg font-bold text-gray-800">{tabs.find(t => t.id === activeTab)?.label}</h2>
                        <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full text-gray-500">
                            <div className="icon-x text-xl"></div>
                        </button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 sm:p-6 no-scrollbar">
                        {renderTabContent()}
                    </div>
                </div>

            </div>
        </div>
    );
}

window.SettingsMenu = SettingsMenu;