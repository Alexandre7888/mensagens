function AudioPage({ user }) {
    const [audioData, setAudioData] = React.useState(null);
    const [videos, setVideos] = React.useState([]);
    const [loading, setLoading] = React.useState(true);
    const [isPlaying, setIsPlaying] = React.useState(false);
    const [showCamera, setShowCamera] = React.useState(false);
    const audioRef = React.useRef(null);
    
    const urlParams = new URLSearchParams(window.location.search);
    const audioId = urlParams.get('id');

    React.useEffect(() => {
        if (!audioId) {
            setLoading(false);
            return;
        }

        const fetchAudioData = async () => {
            const db = window.firebaseDB;
            if (!db) return;

            try {
                // Tenta buscar na biblioteca central de áudios
                const audioSnap = await db.ref(`audios/${audioId}`).once('value');
                let currentAudioData = null;

                if (audioSnap.exists()) {
                    currentAudioData = audioSnap.val();
                }

                // Buscar todos os vídeos que usam este áudio
                const postsSnap = await db.ref('posts').once('value');
                const usedVideos = [];
                
                if (postsSnap.exists()) {
                    const posts = postsSnap.val();
                    for (const [key, post] of Object.entries(posts)) {
                        if (post.type === 'video' && post.audioId === audioId) {
                            usedVideos.push({ id: key, ...post });
                            
                            // Se não existir na biblioteca, cria um áudio virtual baseado no post (fallback)
                            if (!currentAudioData) {
                                currentAudioData = {
                                    id: audioId,
                                    name: `Som original de ${post.authorName}`,
                                    artistName: `@${post.authorName.replace(/\s/g, '').toLowerCase()}`,
                                    coverUrl: post.authorAvatar || 'https://via.placeholder.com/150',
                                    mediaUrl: post.mediaUrl, // usa o próprio vídeo como fonte de áudio
                                    isOriginal: true
                                };
                            }
                        }
                    }
                }

                setAudioData(currentAudioData);
                setVideos(usedVideos.sort((a, b) => (b.views || 0) - (a.views || 0))); // Ordenar por views
            } catch (err) {
                console.error("Erro ao carregar áudio:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchAudioData();
    }, [audioId]);

    const togglePlay = () => {
        if (!audioRef.current) return;
        if (isPlaying) {
            audioRef.current.pause();
        } else {
            audioRef.current.play();
        }
        setIsPlaying(!isPlaying);
    };

    if (loading) {
        return <div className="min-h-screen flex items-center justify-center bg-gray-900"><div className="icon-loader animate-spin text-4xl text-indigo-500"></div></div>;
    }

    if (!audioData) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-gray-900 text-white p-4">
                <div className="icon-music text-6xl text-gray-600 mb-4"></div>
                <h2 className="text-xl font-bold mb-2">Áudio não encontrado</h2>
                <p className="text-gray-400 text-center mb-6">Este áudio pode ter sido removido ou o link é inválido.</p>
                <button onClick={() => window.history.back()} className="bg-indigo-600 px-6 py-2 rounded-full font-bold">Voltar</button>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-900 pb-24" data-name="audio-page" data-file="components/AudioPage.js">
            <header className="fixed top-0 left-0 right-0 bg-gray-900/80 backdrop-blur-md z-20 flex items-center p-4 border-b border-gray-800">
                <button onClick={() => window.history.back()} className="p-2 -ml-2 text-white hover:bg-gray-800 rounded-full">
                    <div className="icon-arrow-left text-xl"></div>
                </button>
                <h1 className="flex-1 text-center font-bold text-lg mr-8">Som</h1>
            </header>

            <div className="pt-20 px-4 max-w-2xl mx-auto">
                {/* Audio Header */}
                <div className="flex items-start gap-4 mb-8">
                    <div className="relative w-28 h-28 flex-shrink-0 rounded-xl overflow-hidden shadow-lg border border-gray-700 bg-gray-800">
                        <img src={audioData.coverUrl} className={`w-full h-full object-cover ${isPlaying ? 'animate-[spin_4s_linear_infinite] rounded-full scale-90' : ''} transition-all duration-300`} />
                        <button 
                            onClick={togglePlay}
                            className="absolute inset-0 m-auto w-12 h-12 bg-black/50 backdrop-blur-sm rounded-full flex items-center justify-center text-white hover:bg-black/70 transition"
                        >
                            <div className={isPlaying ? "icon-pause text-2xl" : "icon-play ml-1 text-2xl"}></div>
                        </button>
                    </div>
                    <div className="flex-1 pt-1">
                        <h2 className="text-2xl font-bold leading-tight mb-1">{audioData.name}</h2>
                        <p className="text-gray-400">{audioData.artistName}</p>
                        <p className="text-sm text-gray-500 mt-2">{videos.length} vídeos</p>
                    </div>
                </div>

                {audioData.mediaUrl && (
                    <audio 
                        ref={audioRef} 
                        src={audioData.mediaUrl} 
                        loop 
                        onPause={() => setIsPlaying(false)}
                        onPlay={() => setIsPlaying(true)}
                        className="hidden" 
                    />
                )}

                {/* Videos Grid */}
                <div className="grid grid-cols-3 gap-1 md:gap-2">
                    {videos.map(video => (
                        <a href={`social.html?v=${video.id}`} key={video.id} className="aspect-[3/4] bg-gray-800 relative group overflow-hidden">
                            <video src={video.mediaUrl} className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition" />
                            <div className="absolute bottom-1 left-1 flex items-center gap-1 text-white text-xs drop-shadow-md">
                                <div className="icon-play text-xs"></div> {video.views || 0}
                            </div>
                        </a>
                    ))}
                    {videos.length === 0 && (
                        <div className="col-span-3 text-center py-10 text-gray-500">Nenhum vídeo usando este áudio ainda.</div>
                    )}
                </div>
            </div>

            {/* Mobile Sticky Button */}
            <div className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-gray-900 via-gray-900 to-transparent z-30 md:hidden flex justify-center">
                <button 
                    onClick={() => setShowCamera(true)}
                    className="bg-red-500 w-full max-w-md py-4 rounded-full font-bold text-white shadow-lg flex items-center justify-center gap-2"
                >
                    <div className="icon-video text-xl"></div> Usar este áudio
                </button>
            </div>

            {/* Camera Overlay Component for Mobile */}
            {showCamera && (
                <CameraCapture 
                    user={user} 
                    onClose={() => setShowCamera(false)} 
                    onUploadComplete={() => {
                        setShowCamera(false);
                        window.location.reload();
                    }}
                    preSelectedAudio={audioData}
                />
            )}
        </div>
    );
}

window.AudioPage = AudioPage;