function NetworkStats({ user, onClose }) {
    const [activeTab, setActiveTab] = React.useState('followers'); // followers, following, likes
    const [data, setData] = React.useState({ followers: [], following: [], likes: [] });
    const [loading, setLoading] = React.useState(true);

    React.useEffect(() => {
        const db = window.firebaseDB;
        if (!db || !user.id) return;

        const fetchData = async () => {
            setLoading(true);
            try {
                // Fetch followers/following relationships
                const followsSnap = await db.ref('follows').once('value');
                const follows = followsSnap.val() || {};
                
                const followersList = [];
                const followingList = [];
                
                // Who I follow
                if (follows[user.id]) {
                    Object.keys(follows[user.id]).forEach(id => {
                        if (follows[user.id][id]) followingList.push(id);
                    });
                }
                
                // Who follows me
                Object.keys(follows).forEach(followerId => {
                    if (follows[followerId][user.id]) {
                        followersList.push(followerId);
                    }
                });

                // Fetch Posts for likes
                const postsSnap = await db.ref('posts').once('value');
                const posts = postsSnap.val() || {};
                const likesList = [];
                
                Object.keys(posts).forEach(postId => {
                    const post = posts[postId];
                    if (post.likes && post.likes[user.id]) {
                        likesList.push({ id: postId, ...post });
                    }
                });

                // Get User details for the IDs
                const usersSnap = await db.ref('users').once('value');
                const usersData = usersSnap.val() || {};

                const resolveUsers = (idList) => idList.map(id => {
                    const u = usersData[id] || {};
                    return {
                        id,
                        name: u.nome || u.username || 'Usuário Desconhecido',
                        avatar: u.profilePicture || null,
                        hideProfile: u.hideProfileFromFollowers
                    };
                });

                setData({
                    followers: resolveUsers(followersList),
                    following: resolveUsers(followingList),
                    likes: likesList.sort((a,b) => b.timestamp - a.timestamp)
                });
            } catch (e) {
                console.error("Erro ao buscar estatísticas", e);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [user.id]);

    const renderUserList = (list) => {
        if (list.length === 0) {
            return <div className="text-center py-8 text-gray-500">Nenhum usuário encontrado.</div>;
        }
        return (
            <div className="space-y-4">
                {list.map(u => (
                    <div key={u.id} className="flex items-center gap-3 p-4 bg-white rounded-xl shadow-sm border border-gray-100">
                        {u.hideProfile ? (
                            <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center text-gray-500"><div className="icon-user"></div></div>
                        ) : u.avatar ? (
                            <img src={u.avatar} alt={u.name} className="w-12 h-12 rounded-full object-cover" />
                        ) : (
                            <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold">
                                {u.name.charAt(0)}
                            </div>
                        )}
                        <div className="flex-1">
                            <h4 className="font-bold text-gray-800">{u.hideProfile ? 'Usuário Oculto' : u.name}</h4>
                            <p className="text-xs text-gray-500">ID: {u.id.substring(0,8)}...</p>
                        </div>
                        <button onClick={async () => {
                            const db = window.firebaseDB;
                            const chatSnap = await db.ref(`users/${user.id}/chats`).once('value');
                            let chatId = null;
                            let aliasId = null;
                            if (chatSnap.exists()) {
                                for (const [id, data] of Object.entries(chatSnap.val())) {
                                    if (data.targetId === u.id || id === u.id) {
                                        chatId = id;
                                        aliasId = data.aliasId;
                                        break;
                                    }
                                }
                            }
                            if (!chatId) chatId = u.id;
                            if (!aliasId) {
                                aliasId = `c_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                                await db.ref(`users/${user.id}/chats/${chatId}`).update({ aliasId, targetId: u.id });
                                await db.ref(`chat_aliases/${aliasId}`).set({ realId: chatId });
                            }
                            window.location.href = `chat.html?c=${aliasId}`;
                        }} className="p-2 bg-indigo-50 text-indigo-600 rounded-full hover:bg-indigo-100">
                            <div className="icon-message-circle"></div>
                        </button>
                    </div>
                ))}
            </div>
        );
    };

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col" data-name="network-stats" data-file="components/NetworkStats.js">
            <header className="bg-white shadow-sm px-4 py-3 flex items-center gap-3 sticky top-0 z-10">
                <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full">
                    <div className="icon-arrow-left text-xl"></div>
                </button>
                <h1 className="text-xl font-bold text-gray-800">Rede & Estatísticas</h1>
            </header>
            
            <div className="bg-white border-b flex overflow-x-auto no-scrollbar">
                <button onClick={() => setActiveTab('followers')} className={`flex-1 py-3 px-4 font-semibold whitespace-nowrap border-b-2 transition-colors ${activeTab === 'followers' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500'}`}>Seguidores ({data.followers.length})</button>
                <button onClick={() => setActiveTab('following')} className={`flex-1 py-3 px-4 font-semibold whitespace-nowrap border-b-2 transition-colors ${activeTab === 'following' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500'}`}>Seguindo ({data.following.length})</button>
                <button onClick={() => setActiveTab('likes')} className={`flex-1 py-3 px-4 font-semibold whitespace-nowrap border-b-2 transition-colors ${activeTab === 'likes' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500'}`}>Curtidas ({data.likes.length})</button>
            </div>

            <main className="flex-1 p-4 max-w-2xl mx-auto w-full">
                {loading ? (
                    <div className="flex justify-center py-12"><div className="icon-loader animate-spin text-indigo-600 text-3xl"></div></div>
                ) : (
                    <div>
                        {activeTab === 'followers' && renderUserList(data.followers)}
                        {activeTab === 'following' && renderUserList(data.following)}
                        {activeTab === 'likes' && (
                            <div className="space-y-4">
                                {data.likes.length === 0 ? (
                                    <div className="text-center py-8 text-gray-500">Nenhuma curtida encontrada.</div>
                                ) : (
                                    data.likes.map(post => (
                                        <div key={post.id} className="p-4 bg-white rounded-xl shadow-sm border border-gray-100">
                                            <p className="text-xs text-gray-400 mb-1">Post de {post.authorName}</p>
                                            <p className="text-gray-800 text-sm mb-2">{post.content}</p>
                                            {post.mediaUrl && (
                                                <div className="text-xs text-indigo-500 flex items-center gap-1"><div className="icon-image"></div> Contém mídia</div>
                                            )}
                                        </div>
                                    ))
                                )}
                            </div>
                        )}
                    </div>
                )}
            </main>
        </div>
    );
}
window.NetworkStats = NetworkStats;