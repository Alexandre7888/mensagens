function StudioLayout() {
    const [activeTab, setActiveTab] = React.useState('music');
    const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);

    const navItems = [
        { id: 'dashboard', label: 'Todos os conteúdos', icon: 'layout-dashboard' },
        { id: 'music', label: 'Música', icon: 'music' },
        { id: 'original-audio', label: 'Áudio Original', icon: 'mic' },
        { id: 'videos', label: 'Vídeos', icon: 'video' }
    ];

    const renderContent = () => {
        switch (activeTab) {
            case 'music':
                return <StudioMusicLibrary />;
            case 'dashboard':
                return (
                    <div className="p-8 flex flex-col items-center justify-center h-full text-gray-400">
                        <div className="icon-layout-dashboard text-6xl mb-4 opacity-50"></div>
                        <h2 className="text-2xl font-bold text-white mb-2">Visão Geral</h2>
                        <p>Selecione uma categoria no menu lateral para gerenciar seus conteúdos.</p>
                    </div>
                );
            default:
                return (
                    <div className="p-8 flex flex-col items-center justify-center h-full text-gray-400">
                        <div className="icon-hammer text-6xl mb-4 opacity-50"></div>
                        <h2 className="text-2xl font-bold text-white mb-2">Em Construção</h2>
                        <p>Esta seção será disponibilizada em breve.</p>
                    </div>
                );
        }
    };

    return (
        <div className="flex h-screen w-full bg-[var(--dark-bg)]">
            {/* Mobile Header */}
            <div className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-[var(--dark-surface)] border-b border-[var(--dark-border)] flex items-center justify-between px-4 z-50">
                <div className="flex items-center gap-3">
                    <img src="https://app.trickle.so/storage/public/images/usr_1b4249e300000001/69bb1bd2-fc92-4f38-85f2-a598ae69ef5e.1000336397" alt="Phantora Studio" className="w-8 h-8 rounded-lg" />
                    <span className="font-bold text-lg">Phantora Studio</span>
                </div>
                <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="p-2 bg-gray-800 rounded-lg text-white">
                    <div className={`icon-${isMobileMenuOpen ? 'x' : 'menu'} text-xl`}></div>
                </button>
            </div>

            {/* Sidebar */}
            <div className={`
                fixed inset-y-0 left-0 z-40 w-64 bg-[var(--dark-surface)] border-r border-[var(--dark-border)] transform transition-transform duration-300 ease-in-out flex flex-col
                lg:relative lg:translate-x-0 pt-16 lg:pt-0
                ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
            `}>
                <div className="hidden lg:flex items-center gap-3 p-6 border-b border-[var(--dark-border)]">
                    <img src="https://app.trickle.so/storage/public/images/usr_1b4249e300000001/69bb1bd2-fc92-4f38-85f2-a598ae69ef5e.1000336397" alt="Phantora Studio" className="w-10 h-10 rounded-xl shadow-lg" />
                    <div>
                        <h1 className="font-bold text-xl tracking-tight bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">Estúdio</h1>
                        <p className="text-xs text-gray-400">Gerenciador de Conteúdo</p>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-1">
                    {navItems.map(item => (
                        <button
                            key={item.id}
                            onClick={() => { setActiveTab(item.id); setIsMobileMenuOpen(false); }}
                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                                activeTab === item.id 
                                ? 'bg-indigo-500/20 text-indigo-400 font-medium' 
                                : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                            }`}
                        >
                            <div className={`icon-${item.icon} ${activeTab === item.id ? 'text-indigo-400' : ''}`}></div>
                            {item.label}
                        </button>
                    ))}
                </div>

                <div className="p-4 border-t border-[var(--dark-border)]">
                    <a href="index.html" className="flex items-center gap-3 px-4 py-3 text-gray-400 hover:bg-gray-800 hover:text-white rounded-xl transition-colors">
                        <div className="icon-log-out"></div>
                        Voltar ao App
                    </a>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 flex flex-col h-full overflow-hidden pt-16 lg:pt-0 relative">
                {renderContent()}
            </div>

            {/* Mobile Overlay */}
            {isMobileMenuOpen && (
                <div 
                    className="fixed inset-0 bg-black/60 z-30 lg:hidden backdrop-blur-sm"
                    onClick={() => setIsMobileMenuOpen(false)}
                ></div>
            )}
        </div>
    );
}