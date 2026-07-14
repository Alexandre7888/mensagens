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

    const [showDeviceManager, setShowDeviceManager] = React.useState(false);

    const tabs = [
        { id: 'geral', label: 'Geral', icon: 'smartphone' },
        { id: 'privacidade', label: 'Privacidade', icon: 'shield' },
        { id: 'experiencia', label: 'Experiência', icon: 'flask-conical' }
    ];

    if (!isOpen) return null;

    if (showDeviceManager) {
        return <window.DeviceManager onClose={() => setShowDeviceManager(false)} />;
    }

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
                            <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3">Dispositivos</h3>
                            <div className="bg-gray-50 p-4 rounded-xl">
                                <button 
                                    onClick={() => setShowDeviceManager(true)}
                                    className="w-full flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg hover:bg-indigo-50 hover:border-indigo-200 transition-colors group"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600">
                                            <div className="icon-tv text-xl"></div>
                                        </div>
                                        <div className="text-left">
                                            <h4 className="font-bold text-gray-800 group-hover:text-indigo-700">Dispositivos Conectados</h4>
                                            <p className="text-xs text-gray-500">Conectar TV (Phantora TV)</p>
                                        </div>
                                    </div>
                                    <div className="icon-chevron-right text-gray-400"></div>
                                </button>
                            </div>
                        </div>

                        <div>
                            <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3">Aparência</h3>
                            <div className="space-y-4 bg-gray-50 p-4 rounded-xl">
                                <div className="flex justify-between items-center">
                                    <span className="font-medium text-gray-700">Tema</span>
                                    <select value={settings.theme} onChange={e => updateSetting('theme', e.target.value)} className="bg-white border border-gray-200 rounded-lg px-3 py-1.5 outline-none">
                                        <option value="claro">Claro</option>
                                        <option value="escuro">Escuro</option>
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
                                <p className="text-xs text-gray-500 mb-4">Selecione "Apenas Próximos" para usar o algoritmo de localização e descobrir pessoas da sua região.</p>

                                <div className="border-t border-gray-200 pt-4 space-y-4">
                                    <label className="flex items-center justify-between cursor-pointer">
                                        <div className="flex flex-col">
                                            <span className="font-medium text-gray-700 text-sm">Receber mensagens de seguidores</span>
                                        </div>
                                        <input type="checkbox" checked={settings.allowFollowerMessages !== false} onChange={async e => {
                                            const val = e.target.checked;
                                            updateSetting('allowFollowerMessages', val);
                                            if (window.firebaseDB && window.currentUserData) {
                                                const uid = window.currentUserData.uid || window.currentUserData.userKey;
                                                await window.firebaseDB.ref(`users/${uid}`).update({ allowFollowerMessages: val });
                                            }
                                        }} className="w-5 h-5 accent-indigo-600" />
                                    </label>

                                    <label className="flex items-center justify-between cursor-pointer">
                                        <div className="flex flex-col">
                                            <span className="font-medium text-gray-700 text-sm">Receber ligações de seguidores</span>
                                        </div>
                                        <input type="checkbox" checked={settings.allowFollowerCalls !== false} onChange={async e => {
                                            const val = e.target.checked;
                                            updateSetting('allowFollowerCalls', val);
                                            if (window.firebaseDB && window.currentUserData) {
                                                const uid = window.currentUserData.uid || window.currentUserData.userKey;
                                                await window.firebaseDB.ref(`users/${uid}`).update({ allowFollowerCalls: val });
                                            }
                                        }} className="w-5 h-5 accent-indigo-600" />
                                    </label>

                                    <label className="flex items-center justify-between cursor-pointer">
                                        <div className="flex flex-col">
                                            <span className="font-medium text-gray-700 text-sm">Ocultar meu perfil para seguidores</span>
                                            <span className="text-xs text-gray-500">Esconde nome e foto</span>
                                        </div>
                                        <input type="checkbox" checked={settings.hideProfileFromFollowers === true} onChange={async e => {
                                            const val = e.target.checked;
                                            updateSetting('hideProfileFromFollowers', val);
                                            if (window.firebaseDB && window.currentUserData) {
                                                const uid = window.currentUserData.uid || window.currentUserData.userKey;
                                                await window.firebaseDB.ref(`users/${uid}`).update({ hideProfileFromFollowers: val });
                                            }
                                        }} className="w-5 h-5 accent-indigo-600" />
                                    </label>
                                </div>
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
                                    <div className="flex flex-col">
                                        <span className="font-medium text-gray-700">Permitir experiências Beta</span>
                                        <span className="text-xs text-gray-500">Recursos novos em teste (sujeito a bugs)</span>
                                    </div>
                                    <input type="checkbox" checked={settings.betaExperiences} onChange={e => updateSetting('betaExperiences', e.target.checked)} className="w-5 h-5 accent-indigo-600" />
                                </label>
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