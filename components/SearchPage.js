function SearchPage({ user }) {
    const [query, setQuery] = React.useState('');
    const [activeTab, setActiveTab] = React.useState('all'); // all, users, videos, audios
    const [results, setResults] = React.useState({ users: [], posts: [], audios: [] });
    const [isSearching, setIsSearching] = React.useState(false);

    React.useEffect(() => {
        const searchTimer = setTimeout(() => {
            if (query.trim().length >= 2) {
                performSearch(query.trim().toLowerCase());
            } else {
                setResults({ users: [], posts: [], audios: [] });
            }
        }, 500);
        return () => clearTimeout(searchTimer);
    }, [query]);

    const performSearch = async (searchTerm) => {
        setIsSearching(true);
        const db = window.firebaseDB;
        if (!db) return;

        try {
            // Search Users
            const usersSnap = await db.ref('users').once('value');
            const users = [];
            if (usersSnap.exists()) {
                const uData = usersSnap.val();
                for (const [id, data] of Object.entries(uData)) {
                    const name = (data.nome || data.name || '').toLowerCase();
                    const username = name.replace(/\s/g, '');
                    if (name.includes(searchTerm) || username.includes(searchTerm.replace('@', ''))) {
                        users.push({ id, name: data.nome || data.name, avatar: data.profilePicture });
                    }
                }
            }

            // Search Posts
            const postsSnap = await db.ref('beta_posts').once('value');
            const posts = [];
            if (postsSnap.exists()) {
                const pData = postsSnap.val();
                for (const [id, data] of Object.entries(pData)) {
                    const content = (data.content || '').toLowerCase();
                    const title = (data.title || '').toLowerCase();
                    const hashtags = (data.hashtags || []).join(' ').toLowerCase();
                    if (content.includes(searchTerm) || title.includes(searchTerm) || hashtags.includes(searchTerm)) {
                        posts.push({ id, ...data });
                    }
                }
            }

            // Search Audios
            const audiosSnap = await db.ref('beta_audios').once('value');
            const audios = [];
            if (audiosSnap.exists()) {
                const aData = audiosSnap.val();
                for (const [id, data] of Object.entries(aData)) {
                    const name = (data.name || '').toLowerCase();
                    const artist = (data.artistName || '').toLowerCase();
                    if (name.includes(searchTerm) || artist.includes(searchTerm)) {
                        audios.push({ id, ...data });
                    }
                }
            }

            setResults({ users, posts, audios });
        } catch (e) {
            console.error(e);
        } finally {
            setIsSearching(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col" data-name="search-page" data-file="components/SearchPage.js">
            <header className="bg-white shadow-sm px-4 py-3 sticky top-0 z-20 flex gap-3 items-center">
                <button onClick={() => window.history.back()} className="p-2 -ml-2 text-gray-600 hover:bg-gray-100 rounded-full">
                    <div className="icon-arrow-left text-xl"></div>
                </button>
                <div className="flex-1 relative">
                    <div className="icon-search absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"></div>
                    <input 
                        type="text" 
                        autoFocus
                        placeholder="Pesquisar usuários, vídeos, hashtags..." 
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 bg-gray-100 border-transparent rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                    />
                    {query && (
                        <button onClick={() => setQuery('')} className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600">
                            <div className="icon-x text-sm"></div>
                        </button>
                    )}
                </div>
            </header>

            <div className="flex bg-white border-b border-gray-200 overflow-x-auto scrollbar-hide px-2">
                {[
                    { id: 'all', label: 'Tudo' },
                    { id: 'users', label: 'Usuários' },
                    { id: 'videos', label: 'Vídeos' },
                    { id: 'audios', label: 'Áudios' }
                ].map(tab => (
                    <button 
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`px-4 py-3 font-medium text-sm whitespace-nowrap border-b-2 transition-colors ${activeTab === tab.id ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-800'}`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            <div className="flex-1 overflow-y-auto p-4 max-w-2xl mx-auto w-full">
                {isSearching ? (
                    <div className="flex justify-center py-10"><div className="icon-loader animate-spin text-3xl text-indigo-500"></div></div>
                ) : query.trim().length < 2 ? (
                    <div className="text-center py-10 text-gray-500">
                        <div className="icon-search text-5xl mb-4 opacity-20 mx-auto"></div>
                        <p>Digite algo para começar a pesquisar</p>
                    </div>
                ) : (
                    <div className="space-y-6">
                        {(activeTab === 'all' || activeTab === 'users') && results.users.length > 0 && (
                            <div>
                                <h3 className="font-bold text-gray-800 mb-3 px-1 text-sm uppercase tracking-wider">Usuários</h3>
                                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                                    {results.users.map(u => (
                                        <div key={u.id} onClick={() => window.location.href = `channel.html?uid=${u.id}`} className="flex items-center gap-3 p-3 border-b border-gray-50 last:border-0 hover:bg-gray-50 cursor-pointer">
                                            {u.avatar ? <img src={u.avatar} className="w-12 h-12 rounded-full object-cover" /> : <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold">{u.name.charAt(0).toUpperCase()}</div>}
                                            <div>
                                                <p className="font-bold text-gray-800">{u.name}</p>
                                                <p className="text-xs text-gray-500">@{u.name.toLowerCase().replace(/\s/g, '')}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {(activeTab === 'all' || activeTab === 'videos') && results.posts.length > 0 && (
                            <div>
                                <h3 className="font-bold text-gray-800 mb-3 px-1 text-sm uppercase tracking-wider">Vídeos e Posts</h3>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                    {results.posts.map(post => (
                                        <a href={`social.html?v=${post.id}`} key={post.id} className="aspect-[3/4] bg-black rounded-lg overflow-hidden relative group">
                                            {post.mediaUrl ? (
                                                post.type === 'video' || post.mediaUrl.match(/\.(mp4|webm|ogg|mov)$/i) ? 
                                                    <video src={post.mediaUrl} className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition" /> :
                                                    <img src={post.mediaUrl} className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition" />
                                            ) : (
                                                <div className="w-full h-full bg-indigo-50 flex items-center justify-center p-2"><p className="text-xs text-indigo-800 text-center line-clamp-4">{post.content}</p></div>
                                            )}
                                            <div className="absolute bottom-2 left-2 text-white text-xs drop-shadow-md bg-black/40 px-1.5 py-0.5 rounded backdrop-blur-sm">
                                                @{post.authorName.replace(/\s/g, '').toLowerCase()}
                                            </div>
                                        </a>
                                    ))}
                                </div>
                            </div>
                        )}

                        {(activeTab === 'all' || activeTab === 'audios') && results.audios.length > 0 && (
                            <div>
                                <h3 className="font-bold text-gray-800 mb-3 px-1 text-sm uppercase tracking-wider">Áudios Originais</h3>
                                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                                    {results.audios.map(audio => (
                                        <div key={audio.id} onClick={() => window.location.href = `audio.html?id=${audio.id}`} className="flex items-center gap-3 p-3 border-b border-gray-50 last:border-0 hover:bg-gray-50 cursor-pointer">
                                            <img src={audio.coverUrl || 'https://via.placeholder.com/150'} className="w-12 h-12 rounded-md object-cover border border-gray-200" />
                                            <div className="flex-1">
                                                <p className="font-bold text-gray-800">{audio.name}</p>
                                                <p className="text-xs text-gray-500">{audio.artistName}</p>
                                            </div>
                                            <div className="icon-chevron-right text-gray-400"></div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {results.users.length === 0 && results.posts.length === 0 && results.audios.length === 0 && (
                            <div className="text-center py-10 text-gray-500">Nenhum resultado encontrado para "{query}"</div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

window.SearchPage = SearchPage;