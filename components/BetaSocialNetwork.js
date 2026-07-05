function BetaSocialNetwork({ user, onClose }) {
    const [posts, setPosts] = React.useState([]);
    const [showAddModal, setShowAddModal] = React.useState(false);
    const [postType, setPostType] = React.useState('text'); // text, image, upload, video
    const [postContent, setPostContent] = React.useState('');
    const [postMediaUrl, setPostMediaUrl] = React.useState('');
    const [editingPostId, setEditingPostId] = React.useState(null);
    const [activeCommentPost, setActiveCommentPost] = React.useState(null);
    const [commentText, setCommentText] = React.useState('');
    
    // Novas funcionalidades
    const [searchQuery, setSearchQuery] = React.useState('');
    const [filterType, setFilterType] = React.useState('all');
    const [theme, setTheme] = React.useState(localStorage.getItem('social_theme') || 'light');
    const [toast, setToast] = React.useState(null);
    const [now, setNow] = React.useState(Date.now());
    const [following, setFollowing] = React.useState({});

    // Upload states
    const [isUploading, setIsUploading] = React.useState(false);
    const [uploadProgress, setUploadProgress] = React.useState(0);
    const [uploadStatus, setUploadStatus] = React.useState('');
    
    // Camera state
    const [showCamera, setShowCamera] = React.useState(false);

    // Profile Modal
    const [selectedUser, setSelectedUser] = React.useState(null);

    React.useEffect(() => {
        const interval = setInterval(() => setNow(Date.now()), 30000);
        return () => clearInterval(interval);
    }, []);

    React.useEffect(() => {
        localStorage.setItem('social_theme', theme);
    }, [theme]);

    const showToast = (msg) => {
        setToast(msg);
        setTimeout(() => setToast(null), 3000);
    };

    React.useEffect(() => {
        const db = window.firebaseDB;
        if (!db) return;

        const postsRef = db.ref('beta_posts');
        const listener = postsRef.on('value', (snapshot) => {
            const data = snapshot.val();
            if (data) {
                const postsList = Object.keys(data).map(key => ({
                    id: key,
                    ...data[key],
                    likesCount: data[key].likes ? Object.keys(data[key].likes).length : 0,
                    hasLiked: data[key].likes ? !!data[key].likes[user.id] : false,
                    commentsCount: data[key].comments ? Object.keys(data[key].comments).length : 0,
                })).sort((a, b) => b.timestamp - a.timestamp);
                setPosts(postsList);
            } else {
                setPosts([]);
            }
        });

        const followsRef = db.ref(`beta_follows/${user.id}`);
        const followsListener = followsRef.on('value', (snap) => {
            setFollowing(snap.val() || {});
        });

        return () => {
            postsRef.off('value', listener);
            followsRef.off('value', followsListener);
        };
    }, [user.id]);

    const toggleFollow = async (targetId) => {
        const db = window.firebaseDB;
        if (!db) return;
        if (following[targetId]) {
            await db.ref(`beta_follows/${user.id}/${targetId}`).remove();
            showToast("Você deixou de seguir este usuário.");
        } else {
            await db.ref(`beta_follows/${user.id}/${targetId}`).set(true);
            showToast("Você agora está seguindo este usuário!");
        }
    };

    const getYoutubeId = (url) => {
        if (!url) return null;
        const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
        const match = url.match(regExp);
        return (match && match[2].length === 11) ? match[2] : null;
    };

    const comprimirImagem = (file) => {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = (event) => {
                const img = new Image();
                img.src = event.target.result;
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    let width = img.width;
                    let height = img.height;
                    const MAX_WIDTH = 1080;
                    if (width > MAX_WIDTH) {
                        height = Math.round((height * MAX_WIDTH) / width);
                        width = MAX_WIDTH;
                    }
                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);
                    const base64Comprimido = canvas.toDataURL('image/jpeg', 0.4); 
                    resolve({ base64: base64Comprimido, type: 'image/jpeg' });
                };
            };
        });
    };

    const comprimirVideo = async (file) => {
        try {
            const { FFmpeg } = await import('https://unpkg.com/@ffmpeg/ffmpeg@0.12.10/dist/esm/index.js');
            const { fetchFile } = await import('https://unpkg.com/@ffmpeg/util@0.12.1/dist/esm/index.js');
            
            const ffmpeg = new FFmpeg();
            await ffmpeg.load({
                coreURL: 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm/ffmpeg-core.js'
            });

            setUploadStatus('Processando e reduzindo tamanho do vídeo...');
            ffmpeg.on('progress', ({ progress }) => {
                setUploadProgress(Math.round(progress * 100));
            });

            const inputName = 'input.mp4';
            const outputName = 'output.mp4';
            await ffmpeg.writeFile(inputName, await fetchFile(file));
            await ffmpeg.exec([
                '-i', inputName,
                '-vf', 'scale=480:-2', 
                '-vcodec', 'libx264',
                '-crf', '32',          
                '-b:v', '400k',        
                '-b:a', '64k',         
                outputName
            ]);
            const data = await ffmpeg.readFile(outputName);
            const videoBlob = new Blob([data.buffer], { type: 'video/mp4' });
            
            return new Promise((resolve) => {
                const reader = new FileReader();
                reader.onloadend = () => {
                    resolve({ base64: reader.result, type: 'video/mp4' });
                };
                reader.readAsDataURL(videoBlob);
            });
        } catch (e) {
            console.error(e);
            setUploadStatus('Compressão falhou. Lendo original...');
            return null; // Fallback
        }
    };

    const processFile = async (file) => {
        if (!file) return;

        // Limite de 5MB (5 * 1024 * 1024 bytes)
        const MAX_SIZE = 5 * 1024 * 1024;
        if (file.size > MAX_SIZE) {
            showToast("O arquivo não pode ter mais que 5MB.");
            return;
        }

        setIsUploading(true);
        setUploadProgress(0);
        setUploadStatus('Iniciando processamento...');

        const FIREBASE_DB_URL = 'https://data-7dc04-default-rtdb.firebaseio.com';
        const PUTER_WORKER_URL = 'https://cdn-codehub-api.puter.work';
        
        const idAleatorio = crypto.randomUUID().replace(/-/g, '').substring(0, 12);
        const timestamp = Date.now();
        const extOriginalLimpa = file.name.split('.').pop().toLowerCase().replace(/[\.\$\#\[\]\/]/g, '');
        
        let nomeAleatorio = '';
        let base64Data = '';
        let contentTypeFinal = '';
        let finalPostType = 'image';

        try {
            if (file.type.startsWith('image/')) {
                nomeAleatorio = `file-${timestamp}-${idAleatorio}-jpg`;
                setUploadStatus('Comprimindo imagem...');
                const resultado = await comprimirImagem(file);
                base64Data = resultado.base64;
                contentTypeFinal = resultado.type;
                finalPostType = 'image';
            } 
            else if (file.type.startsWith('video/')) {
                nomeAleatorio = `file-${timestamp}-${idAleatorio}-mp4`;
                finalPostType = 'video';
                const resultadoVideo = await comprimirVideo(file);
                
                if (resultadoVideo) {
                    base64Data = resultadoVideo.base64;
                    contentTypeFinal = resultadoVideo.type;
                } else {
                    setUploadStatus('Convertendo vídeo para formato suportado...');
                    base64Data = await new Promise((resolve) => {
                        const reader = new FileReader();
                        reader.onload = (ev) => resolve(ev.target.result);
                        reader.readAsDataURL(file);
                    });
                    contentTypeFinal = file.type;
                }
            } 
            else {
                nomeAleatorio = `file-${timestamp}-${idAleatorio}-${extOriginalLimpa}`;
                setUploadStatus('Lendo arquivo original...');
                base64Data = await new Promise((resolve) => {
                    const reader = new FileReader();
                    reader.onload = (ev) => resolve(ev.target.result);
                    reader.readAsDataURL(file);
                });
                contentTypeFinal = file.type || 'application/octet-stream';
            }

            setUploadStatus('Enviando para os servidores...');
            const urlDiretaFirebase = `${FIREBASE_DB_URL}/arquivos/${encodeURIComponent(nomeAleatorio)}.json`;

            const response = await fetch(urlDiretaFirebase, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    base64: base64Data,
                    contentType: contentTypeFinal
                })
            });

            if (response.ok) {
                setUploadStatus('Upload concluído!');
                const linkVisualizacao = `${PUTER_WORKER_URL}/cdn/${encodeURIComponent(nomeAleatorio)}`;
                setPostMediaUrl(linkVisualizacao);
                setPostType(finalPostType);
                showToast("Mídia anexada com sucesso!");
            } else {
                const errText = await response.text();
                setUploadStatus(`Erro no upload: ${errText}`);
                showToast("Erro ao fazer upload da mídia.");
            }
        } catch (error) {
            setUploadStatus(`Erro: ${error.message}`);
            showToast("Erro no processamento da mídia.");
        } finally {
            setTimeout(() => {
                setIsUploading(false);
                setUploadStatus('');
                setUploadProgress(0);
            }, 2000);
        }
    };

    const handleFileUpload = (e) => {
        processFile(e.target.files[0]);
    };

    const handleCameraCapture = (file, type) => {
        setShowCamera(false);
        processFile(file);
    };

    const handleAddOrEditPost = async () => {
        if (!postContent.trim() && !postMediaUrl.trim()) {
            showToast("Digite algo ou adicione uma mídia para postar!");
            return;
        }

        const db = window.firebaseDB;
        if (!db) return;

        try {
            if (editingPostId) {
                await db.ref(`beta_posts/${editingPostId}`).update({
                    content: postContent.trim(),
                    mediaUrl: postMediaUrl.trim(),
                    type: postType,
                    editedAt: Date.now()
                });
                showToast("Post atualizado com sucesso!");
            } else {
                const newPost = {
                    authorId: user.id,
                    authorName: user.name,
                    authorAvatar: user.avatar || '',
                    type: postType,
                    content: postContent.trim(),
                    mediaUrl: postMediaUrl.trim(),
                    timestamp: Date.now(),
                    views: 0
                };
                await db.ref('beta_posts').push(newPost);
                showToast("Post publicado com sucesso!");
            }

            setShowAddModal(false);
            setEditingPostId(null);
            setPostContent('');
            setPostMediaUrl('');
            setPostType('text');
        } catch (error) {
            console.error("Erro ao salvar post:", error);
            showToast("Erro ao salvar publicação.");
        }
    };

    const handleDeletePost = async (postId) => {
        if (window.confirm("Deseja realmente excluir esta publicação?")) {
            await window.firebaseDB.ref(`beta_posts/${postId}`).remove();
            showToast("Post excluído!");
        }
    };

    const handleLike = async (postId, hasLiked) => {
        const db = window.firebaseDB;
        if (!db) return;

        const likeRef = db.ref(`beta_posts/${postId}/likes/${user.id}`);
        if (hasLiked) {
            await likeRef.remove();
        } else {
            await likeRef.set(true);
        }
    };

    const handleAddComment = async (postId) => {
        if (!commentText.trim()) return;
        const db = window.firebaseDB;
        
        try {
            await db.ref(`beta_posts/${postId}/comments`).push({
                authorId: user.id,
                authorName: user.name,
                authorAvatar: user.avatar || '',
                text: commentText.trim(),
                timestamp: Date.now()
            });
            setCommentText('');
            showToast("Comentário adicionado!");
        } catch (e) {
            console.error(e);
            showToast("Erro ao comentar.");
        }
    };

    const handleDeleteComment = async (postId, commentId) => {
        if (window.confirm("Apagar este comentário?")) {
            await window.firebaseDB.ref(`beta_posts/${postId}/comments/${commentId}`).remove();
            showToast("Comentário apagado.");
        }
    };

    const handleShare = (post) => {
        const textToCopy = post.mediaUrl || post.content || `Confira este post de ${post.authorName}`;
        navigator.clipboard.writeText(textToCopy).then(() => {
            showToast("Link copiado para a área de transferência!");
        }).catch(() => {
            showToast("Erro ao copiar link.");
        });
    };

    const handleExport = () => {
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(posts));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href",     dataStr);
        downloadAnchorNode.setAttribute("download", "phantora_posts_backup.json");
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
        showToast("Dados exportados!");
    };

    const handleImport = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const importedPosts = JSON.parse(event.target.result);
                if (window.confirm("Isso adicionará os posts importados ao servidor. Continuar?")) {
                    const db = window.firebaseDB;
                    for (const post of importedPosts) {
                        const { id, likesCount, hasLiked, commentsCount, ...postData } = post;
                        await db.ref('beta_posts').push(postData);
                    }
                    showToast("Dados importados com sucesso!");
                }
            } catch (err) {
                showToast("Erro ao ler o arquivo JSON.");
            }
        };
        reader.readAsText(file);
    };

    const getRelativeTime = (timestamp) => {
        const diffInSeconds = Math.floor((now - timestamp) / 1000);
        if (diffInSeconds < 60) return "agora mesmo";
        const diffInMinutes = Math.floor(diffInSeconds / 60);
        if (diffInMinutes < 60) return `há ${diffInMinutes} min`;
        const diffInHours = Math.floor(diffInMinutes / 60);
        if (diffInHours < 24) return `há ${diffInHours} h`;
        const diffInDays = Math.floor(diffInHours / 24);
        return `há ${diffInDays} d`;
    };



    const renderTextWithHashtags = (text) => {
        if (!text) return null;
        const words = text.split(/(\s+)/);
        return words.map((word, i) => {
            if (word.startsWith('#') && word.length > 1) {
                return <span key={i} className="text-indigo-500 font-medium cursor-pointer hover:underline">{word}</span>;
            }
            if (word.startsWith('@') && word.length > 1) {
                return <span key={i} className="text-blue-500 font-medium cursor-pointer hover:underline">{word}</span>;
            }
            return word;
        });
    };

    const filteredPosts = posts.filter(post => {
        const matchesSearch = post.content?.toLowerCase().includes(searchQuery.toLowerCase()) || 
                              post.authorName?.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesType = filterType === 'all' || post.type === filterType || (filterType === 'image' && post.type === 'video'); // Agrupando mídias
        return matchesSearch && matchesType;
    });

    const isDark = theme === 'dark';
    const bgClass = isDark ? 'bg-gray-900' : 'bg-gray-100';
    const cardBg = isDark ? 'bg-gray-800 border-gray-700 text-gray-100' : 'bg-white border-gray-200 text-gray-800';
    const textMuted = isDark ? 'text-gray-400' : 'text-gray-500';
    const headerBg = isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200';

    return (
        <div className={`fixed inset-0 ${bgClass} z-50 flex flex-col animate-fade-in-up transition-colors duration-300`} data-name="beta-social" data-file="components/BetaSocialNetwork.js">
            {toast && (
                <div className="fixed top-20 left-1/2 transform -translate-x-1/2 z-[70] bg-gray-800 text-white px-4 py-2 rounded-full shadow-lg text-sm flex items-center gap-2 animate-fade-in-up">
                    <div className="icon-info text-indigo-400"></div>
                    {toast}
                </div>
            )}

            <header className={`${headerBg} shadow-sm border-b px-4 py-3 flex items-center justify-between sticky top-0 z-10 transition-colors`}>
                <div className="flex items-center gap-2">
                    <button onClick={onClose} className={`p-2 -ml-2 ${isDark ? 'text-gray-300 hover:bg-gray-700' : 'text-gray-600 hover:bg-gray-100'} rounded-full`}>
                        <div className="icon-arrow-left text-xl"></div>
                    </button>
                    <h1 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-800'} flex items-center gap-2`}>
                        <div className="icon-globe text-indigo-500"></div>
                        Feed Global
                    </h1>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={() => setTheme(isDark ? 'light' : 'dark')} className={`p-2 rounded-full ${isDark ? 'text-yellow-400 hover:bg-gray-700' : 'text-gray-600 hover:bg-gray-100'}`}>
                        <div className={isDark ? "icon-sun" : "icon-moon"}></div>
                    </button>
                    <a href="network_stats.html" className={`p-2 rounded-full ${isDark ? 'text-gray-300 hover:bg-gray-700' : 'text-gray-600 hover:bg-gray-100'} transition-colors`} title="Seguidores e Curtidas">
                        <div className="icon-users text-xl"></div>
                    </a>
                    <a href="live.html" className={`p-2 rounded-full ${isDark ? 'text-red-400 hover:bg-gray-700' : 'text-red-500 hover:bg-red-50'} transition-colors`} title="Transmissões ao Vivo">
                        <div className="icon-radio text-xl"></div>
                    </a>
                    <button onClick={() => {
                        setEditingPostId(null);
                        setPostContent('');
                        setPostMediaUrl('');
                        setPostType('text');
                        setShowAddModal(true);
                    }} className="p-2 bg-indigo-600 text-white rounded-full hover:bg-indigo-700 shadow-sm">
                        <div className="icon-plus text-xl"></div>
                    </button>
                </div>
            </header>

            {/* Profile Modal */}
            {selectedUser && (
                <div className="fixed inset-0 z-[80] bg-black/50 flex items-center justify-center p-4 animate-fade-in-up">
                    <div className={`${isDark ? 'bg-gray-800 text-white' : 'bg-white text-gray-800'} w-full max-w-sm rounded-2xl shadow-xl overflow-hidden`}>
                        <div className="p-6 text-center relative">
                            <button onClick={() => setSelectedUser(null)} className="absolute top-4 right-4 p-1 text-gray-400 hover:text-gray-600 rounded-full">
                                <div className="icon-x text-xl"></div>
                            </button>
                            <img src={selectedUser.avatar || 'https://via.placeholder.com/150'} alt="Profile" className="w-24 h-24 rounded-full object-cover mx-auto border-4 border-indigo-100 mb-4" />
                            <h3 className="text-xl font-bold">{selectedUser.name}</h3>
                            <p className={`text-sm ${textMuted} mb-6`}>@{selectedUser.name.toLowerCase().replace(/\s/g, '')}</p>
                            
                            <div className="flex justify-center gap-4">
                                <a href={`chat.html?uid=${selectedUser.id}`} className="flex-1 py-2 bg-indigo-50 text-indigo-600 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-indigo-100 transition-colors">
                                    <div className="icon-message-circle"></div> Mensagem
                                </a>
                                <a href={`call.html?uid=${selectedUser.id}`} className="flex-1 py-2 bg-green-50 text-green-600 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-green-100 transition-colors">
                                    <div className="icon-phone"></div> Ligar
                                </a>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <div className="flex-1 overflow-y-auto p-4 md:p-6 pb-24 max-w-2xl mx-auto w-full space-y-6">
                
                {/* Search & Filters */}
                <div className={`p-4 rounded-2xl shadow-sm border ${cardBg} space-y-3`}>
                    <div className="relative">
                        <div className="icon-search absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"></div>
                        <input 
                            type="text" 
                            placeholder="Buscar posts ou autores..." 
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className={`w-full pl-10 pr-4 py-2 rounded-xl outline-none border ${isDark ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' : 'bg-gray-50 border-gray-200 text-gray-800'}`}
                        />
                    </div>
                    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                        {['all', 'text', 'image'].map(type => (
                            <button 
                                key={type}
                                onClick={() => setFilterType(type)}
                                className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${filterType === type ? 'bg-indigo-600 text-white' : (isDark ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-100 text-gray-600 hover:bg-gray-200')}`}
                            >
                                {type === 'all' ? 'Todos' : type === 'image' ? 'Mídia' : 'Texto'}
                            </button>
                        ))}
                    </div>
                    <div className="flex justify-between items-center pt-2 border-t border-gray-500/20">
                        <span className={`text-xs ${textMuted}`}>{filteredPosts.length} posts encontrados</span>
                        <div className="flex gap-2">
                            <button onClick={handleExport} className={`text-xs flex items-center gap-1 ${textMuted} hover:text-indigo-500`}><div className="icon-download"></div> Exportar</button>
                            <label className={`text-xs flex items-center gap-1 cursor-pointer ${textMuted} hover:text-indigo-500`}>
                                <div className="icon-upload"></div> Importar
                                <input type="file" accept=".json" className="hidden" onChange={handleImport} />
                            </label>
                        </div>
                    </div>
                </div>

                {filteredPosts.length === 0 ? (
                    <div className={`text-center mt-10 ${textMuted}`}>
                        <div className="icon-image text-4xl mb-3 opacity-50 mx-auto"></div>
                        <p>Nenhuma publicação encontrada.</p>
                    </div>
                ) : (
                    filteredPosts.map(post => (
                        <div key={post.id} className={`rounded-2xl shadow-sm border overflow-hidden ${cardBg}`}>
                            <div className="p-4 flex justify-between items-start">
                                <div className="flex items-center gap-3">
                                    <div 
                                        className="cursor-pointer"
                                        onClick={() => setSelectedUser({ id: post.authorId, name: post.authorName, avatar: post.authorAvatar })}
                                    >
                                        {post.authorAvatar ? (
                                            <img src={post.authorAvatar} alt="Avatar" className="w-10 h-10 rounded-full object-cover border border-gray-500/30" />
                                        ) : (
                                            <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold border border-indigo-200">
                                                {(post.authorName || '?').charAt(0).toUpperCase()}
                                            </div>
                                        )}
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <h3 
                                                className="font-bold text-sm hover:underline cursor-pointer"
                                                onClick={() => setSelectedUser({ id: post.authorId, name: post.authorName, avatar: post.authorAvatar })}
                                            >
                                                {post.authorName}
                                            </h3>
                                            {post.authorId !== user.id && (
                                                <button 
                                                    onClick={() => toggleFollow(post.authorId)}
                                                    className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors ${following[post.authorId] ? (isDark ? 'border-gray-600 text-gray-400 hover:text-red-400 hover:border-red-400' : 'border-gray-300 text-gray-500 hover:text-red-500 hover:border-red-300') : 'border-indigo-500 text-indigo-500 hover:bg-indigo-50'}`}
                                                >
                                                    {following[post.authorId] ? 'Seguindo' : 'Seguir'}
                                                </button>
                                            )}
                                        </div>
                                        <div className={`flex items-center gap-2 text-xs ${textMuted}`}>
                                            <span>{getRelativeTime(post.timestamp)}</span>
                                            {post.editedAt && <span>(editado)</span>}
                                        </div>
                                    </div>
                                </div>
                                
                                {post.authorId === user.id && (
                                    <div className="flex gap-2">
                                        <button onClick={() => {
                                            setEditingPostId(post.id);
                                            setPostContent(post.content || '');
                                            setPostMediaUrl(post.mediaUrl || '');
                                            setPostType(post.type || 'text');
                                            setShowAddModal(true);
                                        }} className={`${textMuted} hover:text-indigo-500 p-1`}>
                                            <div className="icon-pencil text-sm"></div>
                                        </button>
                                        <button onClick={() => handleDeletePost(post.id)} className={`${textMuted} hover:text-red-500 p-1`}>
                                            <div className="icon-trash text-sm"></div>
                                        </button>
                                    </div>
                                )}
                            </div>
                            
                            {post.content && (
                                <div className="px-4 pb-3 whitespace-pre-wrap text-[15px] break-words">
                                    {renderTextWithHashtags(post.content)}
                                </div>
                            )}

                            {(() => {
                                const url = post.mediaUrl;
                                if (!url) return null;
                                
                                const ytId = getYoutubeId(url);
                                if (ytId) {
                                    return (
                                        <div className="relative w-full bg-black flex justify-center items-center overflow-hidden" style={{ aspectRatio: '16/9' }}>
                                            <iframe 
                                                src={`https://www.youtube.com/embed/${ytId}`} 
                                                title="YouTube video player" 
                                                frameBorder="0" 
                                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                                                allowFullScreen
                                                className="w-full h-full absolute inset-0"
                                            ></iframe>
                                            <div className="absolute top-2 right-2 z-10 p-1 bg-white/90 backdrop-blur-sm rounded-lg shadow-lg">
                                                <img src="https://app.trickle.so/storage/public/images/usr_21422c7c08000001/b834fb47-4387-40bb-b8aa-c983117d9d5a.webp" alt="YouTube" className="w-6 h-6 object-contain pointer-events-none" />
                                            </div>
                                        </div>
                                    );
                                }
                                
                                const isVideo = post.type === 'video' || url.match(/\.(mp4|webm|ogg|mov)$/i) || (url.includes('file-') && url.includes('-mp4'));
                                
                                if (isVideo) {
                                    return (
                                        <div className="w-full bg-black flex justify-center items-center">
                                            <video src={url} controls playsInline preload="metadata" className="w-full max-h-96 object-contain"></video>
                                        </div>
                                    );
                                }
                                
                                if (post.type === 'image' || url) {
                                    return <img src={url} alt="Post media" className={`w-full max-h-96 object-contain ${isDark ? 'bg-black' : 'bg-gray-100'}`} loading="lazy" />;
                                }

                                return null;
                            })()}

                            <div className={`px-4 py-3 border-t flex items-center justify-between ${isDark ? 'border-gray-700' : 'border-gray-100'} ${textMuted}`}>
                                <div className="flex items-center gap-6">
                                    <button 
                                        onClick={() => handleLike(post.id, post.hasLiked)} 
                                        className={`flex items-center gap-1.5 transition-colors ${post.hasLiked ? 'text-red-500' : 'hover:text-red-500'}`}
                                    >
                                        <div className={`icon-heart ${post.hasLiked ? 'fill-current' : ''}`}></div>
                                        <span className="text-sm font-medium">{post.likesCount}</span>
                                    </button>
                                    
                                    <button 
                                        onClick={() => setActiveCommentPost(activeCommentPost === post.id ? null : post.id)}
                                        className="flex items-center gap-1.5 hover:text-indigo-500 transition-colors"
                                    >
                                        <div className="icon-message-circle"></div>
                                        <span className="text-sm font-medium">{post.commentsCount}</span>
                                    </button>
                                </div>
                                
                                <button onClick={() => handleShare(post)} className="hover:text-indigo-500 transition-colors">
                                    <div className="icon-share-2"></div>
                                </button>
                            </div>

                            {/* Comentários */}
                            {activeCommentPost === post.id && (
                                <div className={`p-4 border-t ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-gray-50 border-gray-200'}`}>
                                    <div className="flex gap-2 mb-4">
                                        <input 
                                            type="text" 
                                            value={commentText}
                                            onChange={(e) => setCommentText(e.target.value)}
                                            placeholder="Escreva um comentário..."
                                            className={`flex-1 rounded-full px-4 py-2 text-sm outline-none border focus:border-indigo-500 ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-800'}`}
                                            onKeyDown={(e) => e.key === 'Enter' && handleAddComment(post.id)}
                                        />
                                        <button 
                                            onClick={() => handleAddComment(post.id)}
                                            disabled={!commentText.trim()}
                                            className="bg-indigo-600 text-white p-2 rounded-full disabled:opacity-50 hover:bg-indigo-700 transition"
                                        >
                                            <div className="icon-send text-sm"></div>
                                        </button>
                                    </div>
                                    
                                    <div className="space-y-3 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                                        {post.comments && Object.keys(post.comments).map(cId => {
                                            const comment = post.comments[cId];
                                            return (
                                                <div key={cId} className="flex gap-2 group">
                                                    {comment.authorAvatar ? (
                                                        <img src={comment.authorAvatar} className="w-6 h-6 rounded-full object-cover" />
                                                    ) : (
                                                        <div className="w-6 h-6 rounded-full bg-indigo-200 flex items-center justify-center text-[10px] font-bold text-indigo-700 shrink-0">
                                                            {(comment.authorName || '?').charAt(0)}
                                                        </div>
                                                    )}
                                                    <div className={`px-3 py-2 rounded-2xl rounded-tl-none text-sm flex-1 ${isDark ? 'bg-gray-700 text-gray-200' : 'bg-white border border-gray-100 shadow-sm'}`}>
                                                        <div className="flex justify-between items-start">
                                                            <span className="font-bold block text-xs">{comment.authorName}</span>
                                                            {(comment.authorId === user.id || post.authorId === user.id) && (
                                                                <button onClick={() => handleDeleteComment(post.id, cId)} className="opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-700 text-xs transition-opacity">
                                                                    <div className="icon-x"></div>
                                                                </button>
                                                            )}
                                                        </div>
                                                        <span>{comment.text}</span>
                                                        <span className={`block text-[10px] mt-1 ${isDark ? 'text-gray-400' : 'text-gray-400'}`}>{getRelativeTime(comment.timestamp)}</span>
                                                    </div>
                                                </div>
                                            )
                                        })}
                                        {(!post.comments || Object.keys(post.comments).length === 0) && (
                                            <p className={`text-center text-xs py-2 ${textMuted}`}>Seja o primeiro a comentar.</p>
                                        )}
                                    </div>
                                </div>
                            )}

                        </div>
                    ))
                )}
            </div>

            {/* Modal Criar/Editar Post */}
            {showAddModal && (
                <div className="fixed inset-0 bg-black/60 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in-up">
                    <div className={`${isDark ? 'bg-gray-800 text-white' : 'bg-white'} w-full max-w-lg rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]`}>
                        <div className={`p-4 border-b flex justify-between items-center ${isDark ? 'border-gray-700 bg-gray-900' : 'border-gray-200 bg-gray-50'}`}>
                            <h2 className="text-lg font-bold">{editingPostId ? 'Editar Publicação' : 'Nova Publicação'}</h2>
                            <button onClick={() => { setShowAddModal(false); setEditingPostId(null); }} className={`p-1.5 rounded-full ${isDark ? 'text-gray-400 hover:bg-gray-700' : 'text-gray-500 hover:bg-gray-200'}`}>
                                <div className="icon-x text-xl"></div>
                            </button>
                        </div>
                        <div className="p-4 flex-1 overflow-y-auto space-y-4">
                            <div className={`flex p-1 rounded-xl gap-1 ${isDark ? 'bg-gray-700' : 'bg-gray-100'} overflow-x-auto`}>
                                {['text', 'image', 'upload'].map(t => (
                                    <button 
                                        key={t}
                                        onClick={() => setPostType(t)} 
                                        className={`flex-1 py-2 px-2 text-sm font-semibold rounded-lg transition-colors whitespace-nowrap ${postType === t ? (isDark ? 'bg-gray-600 text-white shadow' : 'bg-white text-indigo-600 shadow-sm') : (isDark ? 'text-gray-400' : 'text-gray-500')}`}
                                    >
                                        {t === 'text' ? 'Texto' : t === 'image' ? 'Link Imagem/Vídeo' : 'Upload/Câmera'}
                                    </button>
                                ))}
                            </div>

                            <div>
                                <textarea 
                                    placeholder="No que você está pensando? Use #hashtags ou @amigos" 
                                    value={postContent}
                                    onChange={e => setPostContent(e.target.value)}
                                    className={`w-full p-3 border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 resize-none min-h-[100px] ${isDark ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' : 'border-gray-300 bg-white'}`}
                                />
                            </div>

                            {postType === 'image' && (
                                <div>
                                    <input 
                                        type="url"
                                        placeholder={"Cole a URL da Imagem/GIF ou Vídeo direto..."}
                                        value={postMediaUrl}
                                        onChange={e => {
                                            const val = e.target.value;
                                            setPostMediaUrl(val);
                                            if (val.match(/\.(mp4|webm|ogg|mov)$/i)) {
                                                setPostType('video');
                                            } else if (getYoutubeId(val)) {
                                                setPostType('youtube');
                                            }
                                        }}
                                        className={`w-full p-3 border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 ${isDark ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' : 'border-gray-300 bg-white'}`}
                                    />
                                </div>
                            )}

                            {postType === 'upload' && (
                                <div className={`p-4 border-2 border-dashed rounded-xl text-center ${isDark ? 'border-gray-600 bg-gray-700' : 'border-gray-300 bg-gray-50'}`}>
                                    {isUploading ? (
                                        <div className="space-y-3">
                                            <div className="icon-loader text-2xl animate-spin mx-auto text-indigo-500"></div>
                                            <p className="text-sm font-medium text-indigo-500">{uploadStatus}</p>
                                            {uploadProgress > 0 && (
                                                <div className="w-full bg-gray-200 rounded-full h-2.5">
                                                    <div className="bg-indigo-600 h-2.5 rounded-full transition-all duration-300" style={{ width: `${uploadProgress}%` }}></div>
                                                </div>
                                            )}
                                        </div>
                                    ) : postMediaUrl ? (
                                        <div className="space-y-2">
                                            <div className="icon-circle-check text-3xl mx-auto text-green-500"></div>
                                            <p className="text-sm font-medium text-green-600">Mídia anexada com sucesso!</p>
                                            <button onClick={() => setPostMediaUrl('')} className="text-xs text-red-500 hover:underline font-bold">Remover arquivo</button>
                                        </div>
                                    ) : (
                                        <div className="space-y-4">
                                            <div className="icon-image mx-auto text-4xl text-gray-400"></div>
                                            <div className="flex flex-col sm:flex-row justify-center items-center gap-3">
                                                <label className="cursor-pointer bg-indigo-600 text-white px-5 py-2.5 rounded-lg text-sm font-bold hover:bg-indigo-700 transition flex items-center gap-2 w-full sm:w-auto justify-center">
                                                    <div className="icon-folder-open text-lg"></div> Galeria
                                                    <input type="file" accept="image/*,video/*" className="hidden" onChange={handleFileUpload} />
                                                </label>
                                                <button onClick={() => setShowCamera(true)} className={`px-5 py-2.5 rounded-lg text-sm font-bold transition flex items-center gap-2 w-full sm:w-auto justify-center ${isDark ? 'bg-gray-800 text-white border border-gray-600 hover:bg-gray-900' : 'bg-white text-gray-800 border border-gray-300 hover:bg-gray-100'}`}>
                                                    <div className="icon-camera text-lg"></div> Câmera
                                                </button>
                                            </div>
                                            <p className="text-xs text-gray-500 mt-2">Limite: 5MB por arquivo. Vídeos suportados serão comprimidos.</p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                        <div className={`p-4 border-t ${isDark ? 'border-gray-700 bg-gray-900' : 'border-gray-200 bg-white'}`}>
                            <button 
                                onClick={handleAddOrEditPost} 
                                disabled={isUploading}
                                className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 shadow-md transition-colors disabled:opacity-50"
                            >
                                {editingPostId ? 'Salvar Alterações' : 'Publicar'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
            
            {/* Renderização da Câmera por cima do Modal */}
            {showCamera && (
                <CameraCapture 
                    onCapture={handleCameraCapture} 
                    onClose={() => setShowCamera(false)} 
                />
            )}
        </div>
    );
}

window.BetaSocialNetwork = BetaSocialNetwork;