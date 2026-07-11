function StudioDashboard({ user }) {
    const [uploadType, setUploadType] = React.useState(null);
    const [showLiveModal, setShowLiveModal] = React.useState(false);
    const [showPollModal, setShowPollModal] = React.useState(false);
    const [activeSection, setActiveSection] = React.useState('recent'); // recent, drafts, scheduled, folders
    const [myContents, setMyContents] = React.useState([]);
    const [loading, setLoading] = React.useState(true);
    const [searchQuery, setSearchQuery] = React.useState('');

    const contentTypes = [
        { id: 'photo', label: 'Fotos', desc: 'Imagens de alta qualidade', accept: '.jpg,.png,.gif,.webp', acceptRegex: /image\/.*/, maxSize: '10MB', icon: 'image', color: 'bg-blue-500' },
        { id: 'video', label: 'Vídeos', desc: 'Conteúdo em movimento', accept: '.mp4,.mov,.avi', acceptRegex: /video\/.*/, maxSize: '500MB', icon: 'video', color: 'bg-purple-500' },
        { id: 'audio', label: 'Áudios', desc: 'Músicas e podcasts', accept: '.mp3,.wav', acceptRegex: /audio\/.*/, maxSize: '50MB', icon: 'music', color: 'bg-green-500' },
        { id: 'document', label: 'Documentos', desc: 'PDF, DOC, e mais', accept: '.pdf,.doc,.docx', acceptRegex: /application\/.*/, maxSize: '20MB', icon: 'file-text', color: 'bg-orange-500' },
        { id: 'story', label: 'Stories', desc: 'Conteúdo efêmero (60s)', accept: '.jpg,.png,.mp4', acceptRegex: /(image|video)\/.*/, maxSize: '50MB', icon: 'clock', color: 'bg-pink-500' },
    ];

    React.useEffect(() => {
        if(!user || !user.uid && !user.id) return;
        const uid = user.uid || user.id;
        
        const postsRef = firebase.database().ref('social_posts');
        const listener = postsRef.orderByChild('authorId').equalTo(uid).on('value', (snapshot) => {
            const data = snapshot.val();
            if(data) {
                const postsArray = Object.keys(data).map(key => ({
                    id: key,
                    ...data[key]
                })).sort((a,b) => (b.createdAt || 0) - (a.createdAt || 0));
                setMyContents(postsArray);
            } else {
                setMyContents([]);
            }
            setLoading(false);
        });

        return () => postsRef.off('value', listener);
    }, [user]);

    const formatTime = (ts) => {
        if(!ts) return 'Desconhecido';
        const d = new Date(ts);
        return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'});
    };

    const getIconForType = (type) => {
        if(type === 'video') return 'video';
        if(type === 'photo' || type === 'image') return 'image';
        if(type === 'audio') return 'music';
        if(type === 'poll') return 'chart-bar';
        return 'file';
    };

    const filteredContents = myContents.filter(item => {
        if(!searchQuery) return true;
        const q = searchQuery.toLowerCase();
        return (item.title && item.title.toLowerCase().includes(q)) || 
               (item.question && item.question.toLowerCase().includes(q)) ||
               (item.content && item.content.toLowerCase().includes(q));
    });

    return (
        <div className="flex flex-col h-full bg-[var(--dark-bg)] text-white overflow-hidden p-4 md:p-8" data-name="studio-dashboard">
            
            {/* Top Bar: Search */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
                <div className="relative w-full md:w-96">
                    <div className="icon-search absolute left-3 top-3 text-gray-400"></div>
                    <input 
                        type="text" 
                        placeholder="Buscar em seus uploads..." 
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="w-full bg-[var(--dark-surface)] border border-[var(--dark-border)] rounded-full py-2 pl-10 pr-4 outline-none focus:border-indigo-500 text-white" 
                    />
                </div>
            </div>

            {/* Content Management Sections */}
            <div className="flex-1 flex flex-col min-h-0 bg-[var(--dark-surface)] border border-[var(--dark-border)] rounded-2xl">
                <div className="flex border-b border-[var(--dark-border)] px-4">
                    {[
                        { id: 'recent', label: 'Recentes', icon: 'clock' },
                        { id: 'drafts', label: 'Rascunhos', icon: 'file-edit' },
                        { id: 'scheduled', label: 'Agendados', icon: 'calendar' },
                        { id: 'folders', label: 'Pastas', icon: 'folder' }
                    ].map(tab => (
                        <button 
                            key={tab.id}
                            onClick={() => setActiveSection(tab.id)}
                            className={`px-4 py-4 font-medium text-sm flex items-center gap-2 border-b-2 transition-colors ${activeSection === tab.id ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-gray-400 hover:text-gray-200'}`}
                        >
                            <div className={`icon-${tab.icon}`}></div> {tab.label}
                        </button>
                    ))}
                </div>
                
                <div className="flex-1 overflow-y-auto p-4 md:p-6">
                    {activeSection === 'recent' && (
                        <div>
                            {loading ? (
                                <div className="flex justify-center items-center py-20 text-indigo-400">
                                    <div className="icon-loader animate-spin text-4xl"></div>
                                </div>
                            ) : filteredContents.length > 0 ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {filteredContents.map(item => (
                                        <div key={item.id} className="bg-gray-800/50 border border-[var(--dark-border)] rounded-xl p-4 flex items-center gap-4 hover:bg-gray-800 transition cursor-pointer group">
                                            <div className="w-16 h-16 bg-gray-900 rounded-lg flex items-center justify-center text-gray-500 shrink-0 overflow-hidden relative">
                                                {item.type === 'photo' || item.type === 'image' ? (
                                                    <img src={item.mediaUrl || item.url} className="w-full h-full object-cover" alt="" />
                                                ) : item.type === 'video' ? (
                                                    <video src={item.mediaUrl || item.url} className="w-full h-full object-cover" muted />
                                                ) : (
                                                    <div className={`icon-${getIconForType(item.type)} text-2xl group-hover:text-indigo-400 transition-colors`}></div>
                                                )}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <h4 className="font-bold text-sm truncate">{item.title || item.question || item.content || 'Sem título'}</h4>
                                                <p className="text-xs text-gray-400 mt-1">{formatTime(item.createdAt)}</p>
                                                <div className="flex items-center gap-3 text-xs text-gray-500 mt-2">
                                                    <div className="flex items-center gap-1"><div className="icon-heart"></div> {item.likes || 0}</div>
                                                    {item.type === 'poll' && <div className="flex items-center gap-1 text-indigo-400"><div className="icon-chart-bar"></div> Enquete</div>}
                                                </div>
                                            </div>
                                            <button className="text-gray-400 hover:text-white p-2" onClick={(e)=>{
                                                e.stopPropagation();
                                                if(confirm('Deseja excluir este item?')) {
                                                    firebase.database().ref(`social_posts/${item.id}`).remove();
                                                }
                                            }}><div className="icon-trash"></div></button>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center py-20 text-gray-500">
                                    <div className="icon-inbox text-6xl mb-4 opacity-50"></div>
                                    <p>Nenhum conteúdo encontrado.</p>
                                </div>
                            )}
                        </div>
                    )}
                    {activeSection === 'drafts' && (
                        <div className="flex flex-col items-center justify-center py-20 text-gray-500">
                            <div className="icon-file-edit text-6xl mb-4 opacity-50"></div>
                            <p>Nenhum rascunho salvo.</p>
                        </div>
                    )}
                    {activeSection === 'scheduled' && (
                        <div className="flex flex-col items-center justify-center py-20 text-gray-500">
                            <div className="icon-calendar text-6xl mb-4 opacity-50"></div>
                            <p>Nenhum conteúdo agendado.</p>
                        </div>
                    )}
                    {activeSection === 'folders' && (
                        <div className="flex flex-col items-center justify-center py-20 text-gray-500">
                            <div className="icon-folder text-6xl mb-4 opacity-50"></div>
                            <p>Crie coleções para organizar seus conteúdos.</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Modals */}
            {uploadType && <GenericUpload user={user} contentType={uploadType.id} config={uploadType} onClose={() => setUploadType(null)} onUploadComplete={() => setUploadType(null)} />}
            {showLiveModal && <LiveScheduleModal onClose={() => setShowLiveModal(false)} onSchedule={(data) => console.log('Scheduled', data)} />}
            {showPollModal && <PollConfigModal user={user} onClose={() => setShowPollModal(false)} onPost={(data) => console.log('Poll created')} />}
        </div>
    );
}

window.StudioDashboard = StudioDashboard;