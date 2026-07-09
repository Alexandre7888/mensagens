function UserChannel({ currentUser, channelUserId }) {
    const [channelUser, setChannelUser] = React.useState(null);
    const [posts, setPosts] = React.useState([]);
    const [followers, setFollowers] = React.useState({});
    const [following, setFollowing] = React.useState({});
    const [currentUserFollowing, setCurrentUserFollowing] = React.useState({});
    const [activeTab, setActiveTab] = React.useState('videos'); // videos, followers, following
    const [loading, setLoading] = React.useState(true);
    const [isFriend, setIsFriend] = React.useState(false);
    const [privacySettings, setPrivacySettings] = React.useState({});
    const [userProfiles, setUserProfiles] = React.useState({});

    React.useEffect(() => {
        const db = window.firebaseDB;
        if (!db) return;

        const loadData = async () => {
            try {
                // Load channel user data
                const userSnap = await db.ref(`users/${channelUserId}`).once('value');
                let foundUser = null;
                
                if (userSnap.exists()) {
                    const uData = userSnap.val();
                    foundUser = {
                        id: channelUserId,
                        name: uData.nome || uData.name || 'Usuário',
                        avatar: uData.profilePicture || ''
                    };
                    setPrivacySettings({
                        hideProfileFromFollowers: uData.hideProfileFromFollowers || false,
                        allowFollowerMessages: uData.allowFollowerMessages !== false
                    });
                } else {
                    // Fallback to defaults if user node doesn't exist but we have the ID
                    setPrivacySettings({
                        hideProfileFromFollowers: false,
                        allowFollowerMessages: true
                    });
                }

                // Load their posts by fetching all and filtering in memory to avoid missing index errors
                const postsSnap = await db.ref('posts').once('value');
                let userPosts = [];
                
                if (postsSnap.exists()) {
                    const postsData = postsSnap.val();
                    userPosts = Object.keys(postsData)
                        .map(k => ({ id: k, ...postsData[k] }))
                        .filter(p => p.authorId === channelUserId)
                        .sort((a, b) => b.timestamp - a.timestamp);
                    setPosts(userPosts);
                }

                if (!foundUser && userPosts.length > 0) {
                    // Try to get user details from their first post if they don't exist in users node
                    const firstPost = userPosts[0];
                    foundUser = {
                        id: channelUserId,
                        name: firstPost.authorName || 'Usuário',
                        avatar: firstPost.authorAvatar || ''
                    };
                } else if (!foundUser) {
                    foundUser = {
                        id: channelUserId,
                        name: 'Usuário',
                        avatar: ''
                    };
                }
                
                setChannelUser(foundUser);

                // Load followers and following for channel user
                const allFollowsSnap = await db.ref('follows').once('value');
                if (allFollowsSnap.exists()) {
                    const allFollows = allFollowsSnap.val();
                    
                    // Users that follow the channel user
                    const channelFollowers = {};
                    for (const uid in allFollows) {
                        if (allFollows[uid][channelUserId]) {
                            channelFollowers[uid] = true;
                        }
                    }
                    setFollowers(channelFollowers);

                    // Users that channel user follows
                    setFollowing(allFollows[channelUserId] || {});

                    // Current user follows
                    setCurrentUserFollowing(allFollows[currentUser.id] || {});

                    // Check friendship (mutual follow)
                    const currentUserFollowsThem = allFollows[currentUser.id] && allFollows[currentUser.id][channelUserId];
                    const theyFollowCurrentUser = allFollows[channelUserId] && allFollows[channelUserId][currentUser.id];
                    setIsFriend(currentUserFollowsThem && theyFollowCurrentUser);
                }
            } catch (e) {
                console.error(e);
            }
            setLoading(false);
        };

        loadData();

        // Listeners for real-time updates on follows
        const followsRef = db.ref('follows');
        const listener = followsRef.on('value', (snap) => {
            if (snap.exists()) {
                const allFollows = snap.val();
                const channelFollowers = {};
                for (const uid in allFollows) {
                    if (allFollows[uid][channelUserId]) {
                        channelFollowers[uid] = true;
                    }
                }
                setFollowers(channelFollowers);
                setFollowing(allFollows[channelUserId] || {});
                setCurrentUserFollowing(allFollows[currentUser.id] || {});
                
                const currentUserFollowsThem = allFollows[currentUser.id] && allFollows[currentUser.id][channelUserId];
                const theyFollowCurrentUser = allFollows[channelUserId] && allFollows[channelUserId][currentUser.id];
                setIsFriend(currentUserFollowsThem && theyFollowCurrentUser);
            }
        });

        return () => followsRef.off('value', listener);
    }, [channelUserId, currentUser.id]);

    React.useEffect(() => {
        const db = window.firebaseDB;
        if (!db) return;

        const loadProfiles = async () => {
            const uidsToLoad = new Set([...Object.keys(followers), ...Object.keys(following)]);
            const newProfiles = { ...userProfiles };
            let needsUpdate = false;
            
            for (const uid of uidsToLoad) {
                if (!newProfiles[uid]) {
                    const snap = await db.ref(`users/${uid}`).once('value');
                    if (snap.exists()) {
                        const data = snap.val();
                        newProfiles[uid] = {
                            name: data.nome || data.name || 'Usuário',
                            avatar: data.profilePicture || ''
                        };
                        needsUpdate = true;
                    }
                }
            }
            
            if (needsUpdate) {
                setUserProfiles(newProfiles);
            }
        };

        if (Object.keys(followers).length > 0 || Object.keys(following).length > 0) {
            loadProfiles();
        }
    }, [followers, following]);

    const toggleFollow = async (targetId) => {
        const db = window.firebaseDB;
        if (!db) return;
        if (currentUserFollowing[targetId]) {
            await db.ref(`follows/${currentUser.id}/${targetId}`).remove();
        } else {
            await db.ref(`follows/${currentUser.id}/${targetId}`).set(true);
        }
    };

    if (loading) {
        return <div className="flex h-screen items-center justify-center"><div className="icon-loader animate-spin text-4xl text-indigo-600"></div></div>;
    }

    if (!channelUser) {
        return <div className="p-8 text-center">Usuário não encontrado.</div>;
    }

    const isOwnChannel = currentUser.id === channelUserId;
    const isPrivate = privacySettings.hideProfileFromFollowers && !isOwnChannel && !isFriend;

    return (
        <div className="min-h-screen bg-gray-50 pb-20" data-name="user-channel" data-file="components/UserChannel.js">
            <header className="bg-white shadow-sm border-b px-4 py-3 flex items-center sticky top-0 z-20">
                <button onClick={() => window.history.back()} className="p-2 -ml-2 text-gray-600 hover:bg-gray-100 rounded-full">
                    <div className="icon-arrow-left text-xl"></div>
                </button>
                <h1 className="text-xl font-bold text-gray-800 ml-2">{channelUser.name}</h1>
            </header>

            <div className="bg-white shadow-sm border-b mb-4">
                <div className="p-6 flex flex-col items-center">
                    <img 
                        src={(!isPrivate && channelUser.avatar) ? channelUser.avatar : 'https://via.placeholder.com/150'} 
                        className="w-24 h-24 rounded-full object-cover border-4 border-indigo-100 mb-4" 
                        alt={channelUser.name}
                    />
                    <h2 className="text-2xl font-bold text-gray-800">{isPrivate ? 'Usuário Privado' : channelUser.name}</h2>
                    <p className="text-gray-500 mb-6">@{channelUser.name.toLowerCase().replace(/\s/g, '')}</p>

                    <div className="flex gap-8 mb-6 text-center">
                        <div className="cursor-pointer" onClick={() => setActiveTab('videos')}>
                            <span className="block font-bold text-lg text-gray-800">{posts.length}</span>
                            <span className="text-sm text-gray-500">Posts</span>
                        </div>
                        <div className="cursor-pointer" onClick={() => setActiveTab('followers')}>
                            <span className="block font-bold text-lg text-gray-800">{Object.keys(followers).length}</span>
                            <span className="text-sm text-gray-500">Seguidores</span>
                        </div>
                        <div className="cursor-pointer" onClick={() => setActiveTab('following')}>
                            <span className="block font-bold text-lg text-gray-800">{Object.keys(following).length}</span>
                            <span className="text-sm text-gray-500">Seguindo</span>
                        </div>
                    </div>

                    {!isOwnChannel && (
                        <div className="flex gap-3 w-full max-w-xs">
                            <button 
                                onClick={() => toggleFollow(channelUserId)}
                                className={`flex-1 py-2 rounded-xl font-bold transition-colors ${currentUserFollowing[channelUserId] ? 'bg-gray-200 text-gray-800 hover:bg-gray-300' : 'bg-indigo-600 text-white hover:bg-indigo-700'}`}
                            >
                                {currentUserFollowing[channelUserId] ? 'Seguindo' : 'Seguir'}
                            </button>
                            
                            {isFriend && (
                                <a 
                                    href={`chat.html?chatId=${channelUserId}`}
                                    className="flex-1 py-2 bg-indigo-50 text-indigo-600 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-indigo-100"
                                >
                                    <div className="icon-message-circle"></div> Mensagem
                                </a>
                            )}
                        </div>
                    )}
                    {!isOwnChannel && !isFriend && (
                        <p className="text-xs text-gray-400 mt-3 text-center">Vocês precisam seguir um ao outro para trocar mensagens.</p>
                    )}
                </div>

                <div className="flex border-t border-gray-100">
                    <button onClick={() => setActiveTab('videos')} className={`flex-1 py-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'videos' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-800'}`}>Vídeos / Posts</button>
                    <button onClick={() => setActiveTab('followers')} className={`flex-1 py-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'followers' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-800'}`}>Seguidores</button>
                    <button onClick={() => setActiveTab('following')} className={`flex-1 py-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'following' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-800'}`}>Seguindo</button>
                </div>
            </div>

            <div className="max-w-2xl mx-auto p-4">
                {activeTab === 'videos' && (
                    <div className="grid grid-cols-3 gap-1 md:gap-2">
                        {posts.map(post => (
                            <a href={`social.html?v=${post.id}`} key={post.id} className="aspect-[3/4] bg-black relative group cursor-pointer overflow-hidden rounded-md">
                                {post.mediaUrl && (post.type === 'video' || post.mediaUrl.match(/\.(mp4|webm|ogg|mov)$/i)) ? (
                                    <video src={post.mediaUrl} className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition"></video>
                                ) : post.mediaUrl ? (
                                    <img src={post.mediaUrl} className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition" />
                                ) : (
                                    <div className="w-full h-full bg-indigo-100 flex items-center justify-center p-2">
                                        <p className="text-xs text-indigo-800 line-clamp-4 text-center">{post.content}</p>
                                    </div>
                                )}
                                {(post.type === 'video' || (post.mediaUrl && post.mediaUrl.match(/\.(mp4|webm|ogg|mov)$/i))) && (
                                    <div className="absolute top-1 right-1 text-white">
                                        <div className="icon-play text-sm drop-shadow-md"></div>
                                    </div>
                                )}
                                <div className="absolute bottom-1 left-1 flex items-center text-white text-xs drop-shadow-md">
                                    <div className="icon-heart mr-1 text-[10px]"></div>
                                    {post.likes ? Object.keys(post.likes).length : 0}
                                </div>
                            </a>
                        ))}
                        {posts.length === 0 && <div className="col-span-3 text-center py-10 text-gray-500">Nenhum post encontrado.</div>}
                    </div>
                )}

                {(activeTab === 'followers' || activeTab === 'following') && (
                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                        {(() => {
                            const list = activeTab === 'followers' ? Object.keys(followers) : Object.keys(following);
                            if (list.length === 0) return <div className="p-6 text-center text-gray-500">A lista está vazia.</div>;
                            return list.map(uid => (
                                <div key={uid} className="flex items-center justify-between p-4 border-b border-gray-50 last:border-0 hover:bg-gray-50 cursor-pointer" onClick={() => window.location.href = `channel.html?uid=${uid}`}>
                                    <div className="flex items-center gap-3">
                                        {userProfiles[uid]?.avatar ? (
                                            <img src={userProfiles[uid].avatar} className="w-10 h-10 rounded-full object-cover" />
                                        ) : (
                                            <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold">
                                                {userProfiles[uid]?.name ? userProfiles[uid].name.charAt(0).toUpperCase() : uid.substring(0, 2).toUpperCase()}
                                            </div>
                                        )}
                                        <div className="flex flex-col">
                                            <span className="font-bold text-sm text-gray-800">{userProfiles[uid]?.name || `ID: ${uid.substring(0, 8)}...`}</span>
                                            {userProfiles[uid]?.name && <span className="text-xs text-gray-500">@{userProfiles[uid].name.toLowerCase().replace(/\s/g, '')}</span>}
                                        </div>
                                    </div>
                                    {uid !== currentUser.id && (
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); toggleFollow(uid); }}
                                            className={`px-3 py-1 rounded-full text-xs font-bold transition-colors ${currentUserFollowing[uid] ? 'bg-gray-200 text-gray-700' : 'bg-indigo-600 text-white'}`}
                                        >
                                            {currentUserFollowing[uid] ? 'Seguindo' : 'Seguir'}
                                        </button>
                                    )}
                                </div>
                            ));
                        })()}
                    </div>
                )}
            </div>
        </div>
    );
}

window.UserChannel = UserChannel;