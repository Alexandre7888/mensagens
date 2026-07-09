function StudioMusicLibrary() {
    const [isUploadModalOpen, setIsUploadModalOpen] = React.useState(false);
    const [musics, setMusics] = React.useState([]);
    const [loading, setLoading] = React.useState(true);
    const [playingId, setPlayingId] = React.useState(null);
    const audioRef = React.useRef(new Audio());

    React.useEffect(() => {
        // Simulação de carregamento de músicas (depois conectar ao Firebase real)
        const fetchMusics = () => {
            try {
                const musicRef = firebase.database().ref('studio_musics');
                musicRef.on('value', (snapshot) => {
                    if (snapshot.exists()) {
                        const data = snapshot.val();
                        const musicList = Object.keys(data).map(key => ({
                            id: key,
                            ...data[key]
                        })).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
                        setMusics(musicList);
                    } else {
                        setMusics([]); 
                    }
                    setLoading(false);
                });
            } catch (error) {
                console.error("Erro ao carregar músicas:", error);
                setLoading(false);
            }
        };

        fetchMusics();

        return () => {
            if (typeof firebase !== 'undefined') {
                firebase.database().ref('studio_musics').off();
            }
            audioRef.current.pause();
        };
    }, []);

    const togglePlay = (music) => {
        if (playingId === music.id) {
            audioRef.current.pause();
            setPlayingId(null);
        } else {
            audioRef.current.src = music.audioUrl;
            audioRef.current.play().catch(e => console.log("Erro ao reproduzir (pode ser link mock):", e));
            setPlayingId(music.id);
        }
    };

    audioRef.current.onended = () => {
        setPlayingId(null);
    };

    return (
        <div className="flex flex-col h-full bg-[var(--dark-bg)]">
            {/* Header / Topbar */}
            <div className="px-8 py-6 border-b border-[var(--dark-border)] flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center bg-[var(--dark-surface)]/50 backdrop-blur-md sticky top-0 z-10">
                <div>
                    <h1 className="text-2xl font-bold text-white flex items-center gap-3">
                        <div className="icon-library text-indigo-400"></div>
                        Biblioteca de Músicas
                    </h1>
                    <p className="text-gray-400 text-sm mt-1">Gerencie suas faixas e áudios de alta qualidade</p>
                </div>
                
                <button 
                    onClick={() => setIsUploadModalOpen(true)}
                    className="group bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2.5 rounded-xl font-medium flex items-center gap-2 transition-all shadow-lg shadow-indigo-500/20"
                >
                    <div className="icon-plus text-xl transition-transform group-hover:rotate-90"></div>
                    Nova Música
                </button>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto p-8">
                {loading ? (
                    <div className="flex justify-center items-center h-64">
                        <div className="icon-loader animate-spin text-4xl text-indigo-500"></div>
                    </div>
                ) : musics.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed border-[var(--dark-border)] rounded-2xl bg-gray-800/30">
                        <div className="icon-music text-6xl text-gray-600 mb-4"></div>
                        <h3 className="text-xl font-bold text-gray-300">Nenhuma música encontrada</h3>
                        <p className="text-gray-500 mb-6 mt-2">Sua biblioteca está vazia. Comece enviando seu primeiro áudio.</p>
                        <button 
                            onClick={() => setIsUploadModalOpen(true)}
                            className="bg-gray-700 hover:bg-gray-600 text-white px-6 py-2 rounded-lg font-medium transition-colors"
                        >
                            Fazer Upload
                        </button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {musics.map((music) => (
                            <div key={music.id} className="bg-[var(--dark-surface)] border border-[var(--dark-border)] rounded-2xl overflow-hidden hover:border-indigo-500/50 transition-all group">
                                {/* Banner */}
                                <div className="relative aspect-video bg-gray-800 overflow-hidden">
                                    <img 
                                        src={music.bannerUrl || 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?q=80&w=2000&auto=format&fit=crop'} 
                                        alt={music.title} 
                                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                                    />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent"></div>
                                    
                                    {/* Play Button Overlay */}
                                    <button 
                                        onClick={() => togglePlay(music)}
                                        className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40 backdrop-blur-sm"
                                    >
                                        <div className={`w-16 h-16 rounded-full bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-900/50 hover:scale-110 transition-transform`}>
                                            <div className={`icon-${playingId === music.id ? 'pause' : 'play'} text-3xl text-white ml-${playingId === music.id ? '0' : '1'}`}></div>
                                        </div>
                                    </button>

                                    {/* Links Badges na imagem */}
                                    <div className="absolute bottom-3 right-3 flex gap-2">
                                        {music.youtubeUrl && (
                                            <a href={music.youtubeUrl} target="_blank" rel="noopener noreferrer" className="w-8 h-8 rounded-full bg-red-600 flex items-center justify-center hover:scale-110 transition-transform shadow-lg z-10" title="Ouvir no YouTube" onClick={e => e.stopPropagation()}>
                                                <img src="https://app.trickle.so/storage/public/images/usr_21422c7c08000001/b834fb47-4387-40bb-b8aa-c983117d9d5a.webp" alt="YouTube" className="w-4 h-4 brightness-0 invert" />
                                            </a>
                                        )}
                                        {music.spotifyUrl && (
                                            <a href={music.spotifyUrl} target="_blank" rel="noopener noreferrer" className="w-8 h-8 rounded-full bg-[#1DB954] flex items-center justify-center hover:scale-110 transition-transform shadow-lg z-10" title="Ouvir no Spotify" onClick={e => e.stopPropagation()}>
                                                <div className="icon-headphones text-white text-sm"></div>
                                            </a>
                                        )}
                                        {music.customAppUrl && music.customIconUrl && (
                                            <a href={music.customAppUrl} target="_blank" rel="noopener noreferrer" className="w-8 h-8 rounded-full bg-gray-800 border border-gray-600 flex items-center justify-center hover:scale-110 transition-transform shadow-lg z-10 overflow-hidden" title="Ouvir no App" onClick={e => e.stopPropagation()}>
                                                <img src={music.customIconUrl} alt="App" className="w-full h-full object-cover" />
                                            </a>
                                        )}
                                    </div>
                                </div>

                                {/* Info */}
                                <div className="p-5">
                                    <h3 className="font-bold text-lg text-white mb-1 line-clamp-1" title={music.title}>{music.title}</h3>
                                    <p className="text-gray-400 text-sm line-clamp-2 min-h-[40px]">{music.description}</p>
                                    
                                    {playingId === music.id && (
                                        <div className="mt-4 flex items-center gap-2 text-indigo-400 text-sm font-medium animate-pulse">
                                            <div className="icon-music"></div>
                                            Reproduzindo...
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Modal de Upload */}
            {isUploadModalOpen && (
                <StudioMusicUpload 
                    onClose={() => setIsUploadModalOpen(false)} 
                    onSuccess={() => {
                        setIsUploadModalOpen(false);
                        // Refresh will happen via Firebase listener
                    }}
                />
            )}
        </div>
    );
}