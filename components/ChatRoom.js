function ChatRoom({ user, chat }) {
    const db = window.firebaseDB;
    const firestore = window.firebaseFirestore;
    const messagesEndRef = React.useRef(null);
    const scrollContainerRef = React.useRef(null);
    
    const [messages, setMessages] = React.useState([]);
    const [messageInput, setMessageInput] = React.useState("");
    const [recording, setRecording] = React.useState(false);
    const [toastMessage, setToastMessage] = React.useState(null);
    const [editingMessage, setEditingMessage] = React.useState(null);
    const [replyingTo, setReplyingTo] = React.useState(null);
    const [showEmojiPicker, setShowEmojiPicker] = React.useState(false);
    const [showGifPicker, setShowGifPicker] = React.useState(false);
    const emojiPickerRef = React.useRef(null);
    
    // Selection state
    const [showCamera, setShowCamera] = React.useState(false);
    
    // Selection & Context Menu state
    const [selectionMode, setSelectionMode] = React.useState(false);
    const [contextMenu, setContextMenu] = React.useState(null);
    const [selectedMessages, setSelectedMessages] = React.useState([]);
    const [localDeletedIds, setLocalDeletedIds] = React.useState([]);

    // Admin & Deletion state
    const [isAdmin, setIsAdmin] = React.useState(false);
    const [pendingDelete, setPendingDelete] = React.useState(null);
    const deleteTimerRef = React.useRef(null);
    
    const [showChatInfo, setShowChatInfo] = React.useState(false);
    const [inviteLink, setInviteLink] = React.useState('');
    const [groupMembers, setGroupMembers] = React.useState({});
    const [cargosData, setCargosData] = React.useState(null);
    const [myRoleName, setMyRoleName] = React.useState('membro');
    const [lastMessageSentTime, setLastMessageSentTime] = React.useState(0);

    // Ephemeral (Secret) state
    const [ephemeralMode, setEphemeralMode] = React.useState(false);

    const encryptionKey = chat.id;

    const getYouTubeId = (url) => {
        const regExp = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|e(?:mbed)?)\/|\S*?[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
        const match = url.match(regExp);
        return match ? match[1] : null;
    };

    const renderTextWithLinks = (text) => {
        if (!text) return null;
        const processedText = window.CensorUtils ? window.CensorUtils.censor(text) : text;
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        
        let hasYouTube = false;
        let ytUrl = null;
        let hasSocialPost = false;
        let socialPostId = null;

        const parts = processedText.split(urlRegex).map((part, i) => {
            if (part.match(urlRegex)) {
                if (getYouTubeId(part) && !hasYouTube) {
                    hasYouTube = true;
                    ytUrl = part;
                }
                
                if (part.includes('social.html?v=') && !hasSocialPost) {
                    try {
                        const urlObj = new URL(part);
                        const v = urlObj.searchParams.get('v');
                        if (v) {
                            hasSocialPost = true;
                            socialPostId = v;
                        }
                    } catch(e) {
                        // fallback se URL for inválida
                        const match = part.match(/[?&]v=([^&]+)/);
                        if (match && match[1]) {
                            hasSocialPost = true;
                            socialPostId = match[1];
                        }
                    }
                }

                return (
                    <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="underline font-bold hover:opacity-80 transition-opacity drop-shadow-sm" style={{ color: 'inherit' }} onClick={(e) => e.stopPropagation()}>
                        {part}
                    </a>
                );
            }
            return part;
        });

        return (
            <>
                <div>{parts}</div>
                {hasYouTube && ytUrl && window.UniversalVideoPlayer && (
                    <div className="mt-2" onClick={(e) => e.stopPropagation()}>
                        <window.UniversalVideoPlayer src={ytUrl} />
                    </div>
                )}
                {hasSocialPost && socialPostId && (
                    <div onClick={(e) => e.stopPropagation()}>
                        <SocialPostPreview postId={socialPostId} />
                    </div>
                )}
            </>
        );
    };
    const [pullY, setPullY] = React.useState(0);
    const [appSettings, setAppSettings] = React.useState(window.SettingsManager.getSettings());
    const [showScrollBottom, setShowScrollBottom] = React.useState(false);

    const SocialPostPreview = ({ postId }) => {
        const [post, setPost] = React.useState(null);
        const [loading, setLoading] = React.useState(true);

        React.useEffect(() => {
            if (!db) return;
            db.ref(`beta_posts/${postId}`).once('value').then(snap => {
                setPost(snap.val());
                setLoading(false);
            }).catch(() => setLoading(false));
        }, [postId]);

        if (loading) return <div className="text-xs text-gray-500 mt-2">Carregando post...</div>;
        if (!post) return <div className="text-xs text-red-500 mt-2">Post indisponível ou apagado</div>;

        const mediaUrl = post.videoUrl || post.imageUrl;
        const postUrl = `${window.location.origin}${window.location.pathname.replace('chat.html', '')}social.html?v=${postId}`;

        return (
            <div 
                className="mt-2 mb-1 w-64 sm:w-72 rounded-xl overflow-hidden shadow-md border bg-black flex flex-col"
                style={{ borderColor: 'rgba(0,0,0,0.1)' }}
            >
                {mediaUrl && (
                    <div className="w-full bg-black flex justify-center items-center min-h-[150px] relative pointer-events-auto">
                        {mediaUrl.match(/\.(jpeg|jpg|gif|png|webp)$/i) || mediaUrl.includes('-jpg') || mediaUrl.includes('-png') || mediaUrl.includes('-gif') ? (
                            <img src={mediaUrl} className="w-full h-auto max-h-64 object-contain" alt="Post" />
                        ) : (
                            window.UniversalVideoPlayer ? <window.UniversalVideoPlayer src={mediaUrl} /> : <video src={mediaUrl} controls playsInline preload="metadata" className="w-full max-h-64 object-contain"></video>
                        )}
                    </div>
                )}
                <div className={`p-3 transition-colors ${ephemeralMode || document.documentElement.classList.contains('dark') ? 'bg-gray-800' : 'bg-white'}`}>
                    <div className="cursor-pointer" onClick={() => window.open(postUrl, '_blank')}>
                        <p className={`text-sm font-bold truncate ${ephemeralMode || document.documentElement.classList.contains('dark') ? 'text-white' : 'text-gray-900'}`}>@{post.authorName || 'Usuário'}</p>
                        <p className={`text-xs truncate mt-0.5 ${ephemeralMode || document.documentElement.classList.contains('dark') ? 'text-gray-300' : 'text-gray-600'}`}>{post.description}</p>
                    </div>
                    <div className="flex items-center justify-between mt-3">
                        <div className={`text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 cursor-pointer hover:opacity-80 text-indigo-500`} onClick={() => window.open(postUrl, '_blank')}>
                            <div className="icon-external-link"></div>
                            Ver original
                        </div>
                        <div 
                            className="p-1.5 rounded-full cursor-pointer hover:bg-black/10 transition-colors text-indigo-500"
                            onClick={(e) => {
                                e.stopPropagation();
                                if (navigator.share) {
                                    navigator.share({
                                        title: post.description || 'Post',
                                        text: `Veja este post de @${post.authorName || 'Usuário'} no Phantora!`,
                                        url: postUrl
                                    }).catch(() => {});
                                } else {
                                    navigator.clipboard.writeText(postUrl);
                                    showToastMessage("Link copiado para compartilhar!", "success");
                                }
                            }}
                            title="Compartilhar"
                        >
                            <div className="icon-share-2 text-lg"></div>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    React.useEffect(() => {
        if (emojiPickerRef.current) {
            const handleEmoji = (e) => {
                setMessageInput(prev => prev + e.detail.unicode);
            };
            emojiPickerRef.current.addEventListener('emoji-click', handleEmoji);
            return () => emojiPickerRef.current?.removeEventListener('emoji-click', handleEmoji);
        }
    }, [showEmojiPicker]);

    React.useEffect(() => {
        const handleSettingsChange = (e) => setAppSettings(e.detail);
        window.addEventListener('settingsChanged', handleSettingsChange);
        return () => window.removeEventListener('settingsChanged', handleSettingsChange);
    }, []);
    const [isPulling, setIsPulling] = React.useState(false);

    const SharedVideoMessage = ({ msg }) => {
        const [postExists, setPostExists] = React.useState(true);
        const [loading, setLoading] = React.useState(true);

        React.useEffect(() => {
            if (!db) return;
            try {
                const urlObj = new URL(msg.postUrl);
                const postId = urlObj.searchParams.get('v');
                if (postId) {
                    db.ref(`beta_posts/${postId}`).once('value').then(snap => {
                        if (!snap.exists()) {
                            setPostExists(false);
                        }
                        setLoading(false);
                    }).catch(() => setLoading(false));
                } else {
                    setLoading(false);
                }
            } catch (e) {
                setLoading(false);
            }
        }, [msg.postUrl]);

        if (loading) {
            return <div className="text-gray-500 text-xs p-3">Carregando post...</div>;
        }

        if (!postExists) {
            return (
                <div className="mt-2 mb-1 w-64 sm:w-72 rounded-xl overflow-hidden shadow-md border bg-gray-100 flex flex-col p-6 items-center justify-center text-gray-500">
                    <div className="icon-trash-2 text-3xl mb-2 opacity-70"></div>
                    <span className="font-bold text-sm">Post apagado</span>
                </div>
            );
        }

        return (
            <div 
                className="mt-2 mb-1 w-64 sm:w-72 rounded-xl overflow-hidden shadow-md border bg-black flex flex-col"
                style={{ borderColor: msg.senderId === user.id ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.1)' }}
            >
                {msg.mediaUrl && (
                    <div className="w-full bg-black flex justify-center items-center min-h-[150px] relative pointer-events-auto">
                        {msg.mediaUrl.match(/\.(jpeg|jpg|gif|png|webp)$/i) || msg.mediaUrl.includes('-jpg') || msg.mediaUrl.includes('-png') || msg.mediaUrl.includes('-gif') ? (
                            <img src={msg.mediaUrl} className="w-full h-auto max-h-64 object-contain" alt="Post" />
                        ) : (
                            window.UniversalVideoPlayer ? <window.UniversalVideoPlayer src={msg.mediaUrl} /> : <video src={msg.mediaUrl} controls playsInline preload="metadata" className="w-full max-h-64 object-contain"></video>
                        )}
                    </div>
                )}
                <div className={`p-3 cursor-pointer transition-colors ${msg.senderId === user.id ? 'bg-indigo-600 hover:bg-indigo-700' : (ephemeralMode || document.documentElement.classList.contains('dark') ? 'bg-gray-800 hover:bg-gray-700' : 'bg-white hover:bg-gray-50')}`} onClick={() => window.open(msg.postUrl, '_blank')}>
                    <p className={`text-sm font-bold truncate ${msg.senderId === user.id ? 'text-white' : (ephemeralMode || document.documentElement.classList.contains('dark') ? 'text-white' : 'text-gray-900')}`}>@{msg.postAuthor}</p>
                    <p className={`text-xs truncate mt-0.5 ${msg.senderId === user.id ? 'text-indigo-100' : (ephemeralMode || document.documentElement.classList.contains('dark') ? 'text-gray-300' : 'text-gray-600')}`}>{msg.postTitle}</p>
                    <div className={`mt-2 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 ${msg.senderId === user.id ? 'text-white' : 'text-indigo-500'}`}>
                        <div className="icon-external-link"></div>
                        Ver post original
                    </div>
                </div>
            </div>
        );
    };
    const [pullProgress, setPullProgress] = React.useState(0);
    
    const mediaRecorder = React.useRef(null);
    const audioChunks = React.useRef([]);
    const fileInputRef = React.useRef(null);
    const pressTimer = React.useRef(null);
    const secretTimer = React.useRef(null);
    const touchStartY = React.useRef(0);
    const typingTimer = React.useRef(null);

    // Novo sistema de ID aleatório, sem expor user IDs na rota do banco
    const refPath = chat.type === 'group' ? `groups/${chat.id}/messages` : `chats/${chat.id}/messages`;

    // Load local deleted messages
    React.useEffect(() => {
        const deleted = localStorage.getItem(`deleted_${chat.id}`);
        if (deleted) setLocalDeletedIds(JSON.parse(deleted));
        
        const eph = localStorage.getItem(`ephemeral_${chat.id}`);
        if (eph === 'true') setEphemeralMode(true);

        // Check if admin in group
        if (chat.type === 'group' && db) {
            db.ref(`groups/${chat.id}/members/${user.id}`).once('value').then(snap => {
                const role = snap.val()?.role || snap.val();
                setIsAdmin(role === 'admin' || role === 'owner');
            });

            // Load group members & check community
            db.ref(`groups/${chat.id}`).on('value', snap => {
                const gData = snap.val();
                if (gData) {
                    setGroupMembers(gData.members || {});
                    
                    const fetchCargosPath = gData.communityId ? `communities/${gData.communityId}/cargos` : `groups/${chat.id}/cargos`;
                    
                    db.ref(fetchCargosPath).on('value', cSnap => {
                        const data = cSnap.val();
                        if (data) {
                            setCargosData(data);
                            let role = 'membro';
                            if (data.dono === user.id) role = 'dono';
                            else if (data.admins && data.admins.includes(user.id)) role = 'admin';
                            else if (data.moderadores && data.moderadores.includes(user.id)) role = 'moderador';
                            else if (data.mutados && data.mutados.includes(user.id)) role = 'mutado';
                            else if (data.cargos_personalizados) {
                                for (const [cName, cData] of Object.entries(data.cargos_personalizados)) {
                                    if (cData.membros && cData.membros.includes(user.id)) { role = cName; break; }
                                }
                            }
                            
                            // Check the specific member role if nothing else is found
                            if (role === 'membro' && gData.members && gData.members[user.id]) {
                                const mRole = gData.members[user.id].role || gData.members[user.id];
                                if (mRole === 'admin' || mRole === 'owner') {
                                    role = mRole === 'owner' ? 'dono' : 'admin';
                                }
                            }
                            
                            setMyRoleName(role);
                            setIsAdmin(role === 'dono' || role === 'admin');
                        } else {
                            const memberInfo = gData.members[user.id];
                            const mRole = memberInfo?.role || (typeof memberInfo === 'string' ? memberInfo : 'membro');
                            const fallbackRole = mRole === 'owner' ? 'dono' : (mRole === 'admin' ? 'admin' : 'membro');
                            setMyRoleName(fallbackRole);
                            setIsAdmin(fallbackRole === 'dono' || fallbackRole === 'admin');
                        }
                    });
                }
            });
        }
    }, [chat.id, db, user.id]);

    const cleanupOldFiles = async (msgs, path) => {
        const now = Date.now();
        const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;
        const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;
        
        for (const msg of msgs) {
            // Regra de 7 dias para QUALQUER tipo de mensagem
            if (now - msg.timestamp > SEVEN_DAYS) {
                await db.ref(`${path}/${msg.key}`).remove();
                continue;
            }

            // Delete if ephemeral mode is on for this chat (24h rule applies to text too)
            const isEphemeral = msg.ephemeral || ephemeralMode;
            
            if (isEphemeral && now - msg.timestamp > TWENTY_FOUR_HOURS) {
                await db.ref(`${path}/${msg.key}`).remove();
                continue;
            }

            if ((msg.type === 'image' || msg.type === 'audio' || msg.type === 'file') && msg.fileData) {
                if (now - msg.timestamp > TWENTY_FOUR_HOURS) {
                    await db.ref(`${path}/${msg.key}/fileData`).remove();
                    await db.ref(`${path}/${msg.key}/text`).set('Arquivo expirado (24h)');
                    await db.ref(`${path}/${msg.key}/type`).set('text');
                }
            }
        }
    };

    const getFirestorePath = () => {
        return chat.type === 'group' ? `groups/${chat.id}/messages` : `chats/${chat.id}/messages`;
    };

    React.useEffect(() => {
        if (!db) return;
        
        // Auto mark as read for incoming messages
        const unreadMessages = messages.filter(m => m.senderId !== user.id && !m.read && !m.deletedByAdmin);
        if (unreadMessages.length > 0) {
            unreadMessages.forEach(msg => {
                db.ref(`${refPath}/${msg.key}`).update({ read: true });
                // Atualiza localmente
                const localKey = `local_history_${chat.id}`;
                let localHistory = JSON.parse(localStorage.getItem(localKey)) || [];
                const idx = localHistory.findIndex(m => m.key === msg.key);
                if (idx !== -1) {
                    localHistory[idx].read = true;
                    localStorage.setItem(localKey, JSON.stringify(localHistory));
                }
            });
        }

        // Apagar as mensagens do servidor apenas se já foram lidas para economizar espaço
        messages.forEach(msg => {
            if (msg.read) {
                setTimeout(() => {
                    db.ref(`${refPath}/${msg.key}`).remove().catch(()=>{});
                }, 4000);
            }
        });

    }, [messages, db, user.id, refPath, ephemeralMode]);

    React.useEffect(() => {
        if (!db) return;
        
        const messagesRef = db.ref(refPath);
        
        const handleData = (snapshot) => {
            const msgList = [];
            snapshot.forEach((child) => {
                msgList.push({ ...child.val(), key: child.key });
            });
            
            // Lógica de expiração e auto-exclusão
            cleanupOldFiles(msgList, refPath);
            
            // Lógica de salvar no dispositivo e apagar do servidor
            const localKey = `local_history_${chat.id}`;
            let localHistory = [];
            try {
                localHistory = JSON.parse(localStorage.getItem(localKey)) || [];
            } catch (e) {}

            const merged = [...localHistory];
            let hasNew = false;

            msgList.forEach(msg => {
                const exists = merged.find(m => m.key === msg.key);
                if (!exists) {
                    merged.push(msg);
                    hasNew = true;
                } else if (msg.edited || msg.deletedByAdmin) {
                    const idx = merged.findIndex(m => m.key === msg.key);
                    merged[idx] = { ...merged[idx], ...msg };
                    hasNew = true;
                }
            });

            if (hasNew) {
                if (merged.length > 2000) merged.splice(0, merged.length - 2000);
                localStorage.setItem(localKey, JSON.stringify(merged));
            }
            
            setMessages(merged);
            
            const el = scrollContainerRef.current;
            const isAtBottom = el ? (el.scrollHeight - el.scrollTop - el.clientHeight <= 150) : true;
            const hasMyNewMessage = msgList.length > 0 && msgList[msgList.length - 1].senderId === user.id;

            if ((isAtBottom || hasMyNewMessage) && !isPulling && !selectionMode) {
                setTimeout(() => {
                    if (messagesEndRef.current) {
                        messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
                    }
                }, 50);
            }
        };

        messagesRef.on('value', handleData);

        return () => {
            messagesRef.off('value', handleData);
        };
    }, [chat.id, db, user.id, isPulling, ephemeralMode, selectionMode]);

    const showToastMessage = (message, type = "info") => {
        setToastMessage({ message, type });
        setTimeout(() => setToastMessage(null), 3000);
    };

    // Selection Logic
    const handleLongPress = (msg) => {
        setSelectionMode(true);
        setSelectedMessages([msg.key]);
        if ('vibrate' in navigator) navigator.vibrate(50);
    };

    const handleMessagePressStart = (msg) => {
        pressTimer.current = setTimeout(() => handleLongPress(msg), 600);
    };

    const handleMessagePressEnd = () => {
        if (pressTimer.current) clearTimeout(pressTimer.current);
    };

    const toggleMessageSelection = (msg) => {
        if (!selectionMode) return;
        if (selectedMessages.includes(msg.key)) {
            const newSelection = selectedMessages.filter(id => id !== msg.key);
            setSelectedMessages(newSelection);
            if (newSelection.length === 0) setSelectionMode(false);
        } else {
            setSelectedMessages([...selectedMessages, msg.key]);
        }
    };

    const selectAll = () => {
        const visibleMsgs = messages.filter(m => !localDeletedIds.includes(m.key));
        setSelectedMessages(visibleMsgs.map(m => m.key));
    };

    const handleCopySelected = () => {
        const textToCopy = messages
            .filter(m => selectedMessages.includes(m.key) && m.type === 'text')
            .map(m => window.CryptoUtils ? window.CryptoUtils.decrypt(m.text, encryptionKey) : m.text)
            .join('\n\n');
        
        if (textToCopy) {
            navigator.clipboard.writeText(textToCopy).then(() => {
                showToastMessage("Mensagens copiadas", "success");
                setSelectionMode(false);
                setSelectedMessages([]);
            }).catch(() => {
                showToastMessage("Erro ao copiar", "error");
            });
        } else {
            showToastMessage("Nenhum texto para copiar", "error");
        }
    };

    const executeDelete = async (type, ids) => {
        setPendingDelete(null);
        if (type === 'local') {
            const newLocalDeleted = [...localDeletedIds, ...ids];
            setLocalDeletedIds(newLocalDeleted);
            localStorage.setItem(`deleted_${chat.id}`, JSON.stringify(newLocalDeleted));
        } else if (type === 'admin_everyone') {
            for (const msgId of ids) {
                await db.ref(`${refPath}/${msgId}`).update({
                    text: '🚫 Mensagem apagada pelo admin',
                    type: 'text',
                    fileData: null,
                    deletedByAdmin: true
                });
            }
        }
    };

    const handleDeleteSelected = (type) => {
        const idsToDelete = [...selectedMessages];
        setSelectionMode(false);
        setSelectedMessages([]);
        
        setPendingDelete({ type, ids: idsToDelete });
        
        deleteTimerRef.current = setTimeout(() => {
            executeDelete(type, idsToDelete);
        }, 2000);
    };

    const undoDelete = () => {
        if (deleteTimerRef.current) {
            clearTimeout(deleteTimerRef.current);
            deleteTimerRef.current = null;
        }
        setPendingDelete(null);
        showToastMessage("Ação desfeita", "info");
    };

    // Lógica refinada de Pull UP (efeito elástico nativo)
    const handleTouchStart = (e) => {
        const el = scrollContainerRef.current;
        if (!el) return;
        // Permite um pouco mais de tolerância para ativar
        const isAtBottom = el.scrollHeight - el.scrollTop - el.clientHeight <= 50;
        if (isAtBottom) {
            touchStartY.current = e.touches[0].clientY;
            setIsPulling(true);
        }
    };

    const handleTouchMove = (e) => {
        if (isPulling) {
            const currentY = e.touches[0].clientY;
            const diff = touchStartY.current - currentY; // Positivo quando puxa para CIMA
            
            if (diff > 0) {
                // Aplicar fricção/resistência para parecer nativo (curva elástica)
                const resist = diff * 0.4;
                setPullY(resist);
                
                if (resist > 40 && !secretTimer.current) {
                    let progress = 0;
                    secretTimer.current = setInterval(() => {
                        progress += 2;
                        setPullProgress(progress);
                        if (progress >= 30) {
                            clearInterval(secretTimer.current);
                            toggleEphemeralMode();
                            setIsPulling(false);
                            setPullY(0);
                            setPullProgress(0);
                            secretTimer.current = null;
                        }
                    }, 50); // Mais rápido e fluido
                } else if (resist <= 40 && secretTimer.current) {
                    clearInterval(secretTimer.current);
                    secretTimer.current = null;
                    setPullProgress(0);
                }
            } else {
                setPullY(0);
                setPullProgress(0);
            }
        }
    };

    const handleTouchEnd = () => {
        setIsPulling(false);
        setPullY(0);
        setPullProgress(0);
        if (secretTimer.current) {
            clearInterval(secretTimer.current);
            secretTimer.current = null;
        }
    };

    const handleScroll = () => {
        const el = scrollContainerRef.current;
        if (!el) return;
        const isAtBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 150;
        setShowScrollBottom(!isAtBottom);
    };

    const toggleEphemeralMode = () => {
        const newState = !ephemeralMode;
        setEphemeralMode(newState);
        localStorage.setItem(`ephemeral_${chat.id}`, newState.toString());
        showToastMessage(newState ? "Modo secreto ativado! (24h)" : "Modo secreto desativado", "success");
        if ('vibrate' in navigator) navigator.vibrate([100, 50, 100]);
    };

    const verificarPermissao = (acao) => {
        if (chat.type !== 'group') return true; // DM allowed

        if (myRoleName === 'dono') return true;
        
        if (myRoleName === 'mutado') return false;

        if (myRoleName === 'admin') {
            const forbiddenAdmin = []; // Admin has everything except transfer owner/delete group which isn't checked here
            return !forbiddenAdmin.includes(acao);
        }

        if (myRoleName === 'moderador') {
            const modPerms = ['enviar_mensagem', 'enviar_foto', 'enviar_video', 'enviar_audio', 'enviar_localizacao', 'enviar_documento', 'enviar_link', 'responder_mensagem', 'reagir_mensagem', 'apagar_propria_mensagem', 'fixar_mensagem', 'mutar_membro', 'desmutar_membro', 'criar_enquete', 'votar_enquete'];
            return modPerms.includes(acao);
        }

        if (myRoleName === 'membro') {
            const memberPerms = ['enviar_mensagem', 'enviar_foto', 'enviar_video', 'enviar_audio', 'enviar_localizacao', 'enviar_documento', 'enviar_link', 'responder_mensagem', 'reagir_mensagem', 'apagar_propria_mensagem', 'criar_enquete', 'votar_enquete'];
            return memberPerms.includes(acao);
        }

        // Custom Role
        if (cargosData && cargosData.cargos_personalizados && cargosData.cargos_personalizados[myRoleName]) {
            const customPerms = cargosData.cargos_personalizados[myRoleName].permissoes || [];
            return customPerms.includes(acao);
        }

        return false;
    };

    // Standard Messaging functions
    const startCall = async (video = false) => {
        const callWin = window.open('', '_blank');
        const callId = `call_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
        const callUrl = `${window.location.origin}${window.location.pathname.replace('chat.html', '')}call.html?callId=${callId}`;
        
        await db.ref(`calls/${callId}`).set({
            callerId: user.id,
            receiverId: chat.id,
            isVideo: video,
            status: 'initiated',
            timestamp: Date.now()
        });

        await db.ref(refPath).push({
            senderId: user.id,
            senderName: user.name,
            type: 'call_link',
            callId: callId,
            text: video ? 'Chamada de Vídeo' : 'Chamada de Voz',
            timestamp: Date.now()
        });

        let targetIds = [];
        if (chat.type === 'group') {
            const groupSnap = await db.ref(`groups/${chat.id}/members`).once('value');
            const members = groupSnap.val() || {};
            targetIds = Object.keys(members).filter(uid => uid !== user.id);
        } else {
            targetIds = [chat.id];
        }

        let pushIds = [];
        for (const uid of targetIds) {
            const snap = await db.ref(`users/${uid}/oneSignalId`).once('value');
            const pushId = snap.val();
            if (pushId) pushIds.push(pushId);
        }

        if (pushIds.length > 0) {
            let isCallActive = true;
            
            const callStatusRef = db.ref(`calls/${callId}/status`);
            callStatusRef.on('value', (snap) => {
                if (snap.val() !== 'initiated') {
                    isCallActive = false;
                    callStatusRef.off();
                }
            });

            const sendLoop = () => {
                if (!isCallActive) return;
                console.log("Disparando notificação de chamada para", pushIds.length, "dispositivos...");
                api.sendCallNotificationDirect(pushIds, callUrl);
                setTimeout(sendLoop, 2000);
            };
            sendLoop();
        }

        if (callWin) callWin.location.href = callUrl;
        else window.open(callUrl, '_blank');
    };

    const sendMessage = async () => {
        if (!messageInput.trim() || !db) return;
        
        // Moderação Automática
        if (window.ModerationSystem) {
            try {
                const modResult = await window.ModerationSystem.checkMessage(messageInput.trim(), user.id);
                if (modResult && modResult.bloqueado) {
                    console.log('Mensagem retida para moderação:', modResult.palavraDetectada);
                    showToastMessage("Mensagem bloqueada pela moderação.", "error");
                    return;
                }
            } catch (e) {
                console.error('Erro na moderação:', e);
            }
        }

        if (!verificarPermissao('enviar_mensagem')) {
            showToastMessage("Você não tem permissão para enviar mensagens.", "error");
            return;
        }

        const hasLink = /(https?:\/\/[^\s]+)/g.test(messageInput);
        if (hasLink && !verificarPermissao('enviar_link')) {
            showToastMessage("Você não tem permissão para enviar links.", "error");
            return;
        }

        const spamCheck = window.spamController.checkSpam('text');
        if (spamCheck.blocked) {
            showToastMessage(spamCheck.message, "error");
            return;
        }
        
        const rawText = messageInput.trim();
        // Verifica se é um comando para bot (! ou /) para não criptografar
        const isBotCommand = rawText.startsWith('!') || rawText.startsWith('/');
        const encryptedText = (window.CryptoUtils && !isBotCommand) ? window.CryptoUtils.encrypt(rawText, encryptionKey) : rawText;

        if (editingMessage) {
            await db.ref(`${refPath}/${editingMessage.key}`).update({
                text: encryptedText,
                edited: true
            });
            setEditingMessage(null);
            setMessageInput("");
            return;
        }

        const basePath = refPath.split('/messages')[0];
        if (db) {
            db.ref(`${basePath}/typing/${user.id}`).remove();
        }
        if (typingTimer.current) clearTimeout(typingTimer.current);

        const msgData = {
            senderId: user.id,
            senderName: user.name,
            type: 'text',
            text: encryptedText,
            timestamp: Date.now(),
            ephemeral: ephemeralMode,
            replyTo: replyingTo ? {
                id: replyingTo.key,
                text: replyingTo.type === 'text' ? replyingTo.text : (replyingTo.fileName || 'Mídia'),
                senderName: replyingTo.senderName
            } : null
        };
        
        setReplyingTo(null);
        setShowEmojiPicker(false);
        
        await db.ref(refPath).push(msgData);
        
        window.SettingsManager.playNotificationSound();
        window.SettingsManager.vibrate('send');

        const chatUpdate = { lastMessage: messageInput.trim(), timestamp: Date.now() };
        if (chat.type === 'group') {
            const groupSnap = await db.ref(`groups/${chat.id}/members`).once('value');
            const members = groupSnap.val() || {};
            for (const uid of Object.keys(members)) {
                await db.ref(`users/${uid}/chats/${chat.id}`).update(chatUpdate);
            }
        } else {
            const target = chat.targetId || chat.id; // Fallback para chats antigos
            await db.ref(`users/${user.id}/chats/${chat.id}`).update(chatUpdate);
            if (target !== user.id) {
                await db.ref(`users/${target}/chats/${chat.id}`).update(chatUpdate);
                api.sendNotification(target, user.name, messageInput.trim());
            }
        }
        
        setLastMessageSentTime(Date.now());
        setMessageInput("");
    };

    const sendGif = async (url) => {
        if (!db) return;
        if (!verificarPermissao('enviar_foto')) {
            showToastMessage("Sem permissão para mídia.", "error");
            return;
        }
        const msgData = {
            senderId: user.id,
            senderName: user.name,
            type: 'image',
            fileData: url,
            fileName: 'gif',
            timestamp: Date.now(),
            ephemeral: ephemeralMode,
            replyTo: replyingTo ? {
                id: replyingTo.key,
                text: replyingTo.type === 'text' ? replyingTo.text : (replyingTo.fileName || 'Mídia'),
                senderName: replyingTo.senderName
            } : null
        };
        
        setReplyingTo(null);
        setShowGifPicker(false);
        
        await db.ref(refPath).push(msgData);
        
        window.SettingsManager.playNotificationSound();
        window.SettingsManager.vibrate('send');

        const chatUpdate = { lastMessage: 'GIF', timestamp: Date.now() };
        if (chat.type === 'group') {
            const groupSnap = await db.ref(`groups/${chat.id}/members`).once('value');
            const members = groupSnap.val() || {};
            for (const uid of Object.keys(members)) {
                await db.ref(`users/${uid}/chats/${chat.id}`).update(chatUpdate);
            }
        } else {
            const target = chat.targetId || chat.id;
            await db.ref(`users/${user.id}/chats/${chat.id}`).update(chatUpdate);
            if (target !== user.id) {
                await db.ref(`users/${target}/chats/${chat.id}`).update(chatUpdate);
                api.sendNotification(target, user.name, 'Enviou um GIF');
            }
        }
        setLastMessageSentTime(Date.now());
    };

    const sendMediaFile = async (file, type) => {
        if (type === 'image' && !verificarPermissao('enviar_foto')) {
            showToastMessage("Sem permissão para imagens.", "error"); return;
        }
        if (type === 'video' && !verificarPermissao('enviar_video')) {
            showToastMessage("Sem permissão para vídeos.", "error"); return;
        }
        if (type === 'file' && !verificarPermissao('enviar_documento')) {
            showToastMessage("Sem permissão para documentos.", "error"); return;
        }
        if (file.size > 15 * 1024 * 1024) { 
            showToastMessage("Arquivo muito grande! Máximo 15MB antes da compressão", "error"); 
            return; 
        }

        try {
            let base64Data;
            if (type === 'image') {
                base64Data = await api.compressImage(file, 800, 0.6); // Compress to max 800px width, 60% quality
            } else {
                base64Data = await api.fileToBase64(file);
            }
            
            // Check size after compression (approximate base64 size)
            if (base64Data.length > 5 * 1024 * 1024) {
                showToastMessage("Arquivo resultante excede 5MB. Tente um menor.", "error");
                return;
            }

            const msgData = {
                senderId: user.id,
                senderName: user.name,
                type: type,
                fileData: base64Data,
                fileName: file.name,
                timestamp: Date.now(),
                ephemeral: ephemeralMode
            };
            await db.ref(refPath).push(msgData);
            setLastMessageSentTime(Date.now());
        } catch (e) {
            showToastMessage("Erro ao processar/enviar arquivo", "error");
        }
    };

    const isRecordingRef = React.useRef(false);

    const startRecording = async (e) => {
        if(e) e.preventDefault();
        if (isRecordingRef.current) return;
        if (!verificarPermissao('enviar_audio')) {
            showToastMessage("Sem permissão para enviar áudio.", "error");
            return;
        }
        try {
            isRecordingRef.current = true;
            setRecording(true);
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorder.current = new MediaRecorder(stream, { audioBitsPerSecond: 16000 });
            audioChunks.current = [];
            
            mediaRecorder.current.ondataavailable = e => {
                if (e.data.size > 0) audioChunks.current.push(e.data);
            };
            mediaRecorder.current.onstop = async () => {
                stream.getTracks().forEach(track => track.stop()); // Clean up tracks!
                
                if (audioChunks.current.length > 0) {
                    const blob = new Blob(audioChunks.current, { type: 'audio/webm' });
                    const reader = new FileReader();
                    reader.readAsDataURL(blob);
                    reader.onload = async () => {
                        await db.ref(refPath).push({
                            senderId: user.id,
                            senderName: user.name,
                            type: 'audio',
                            fileData: reader.result,
                            timestamp: Date.now(),
                            ephemeral: ephemeralMode
                        });
                    };
                }
                audioChunks.current = [];
            };
            mediaRecorder.current.startTime = Date.now();
            mediaRecorder.current.start();
        } catch (e) {
            isRecordingRef.current = false;
            setRecording(false);
            showToastMessage("Erro ao acessar microfone", "error");
        }
    };

    const stopRecording = (e) => {
        if(e) e.preventDefault();
        if (mediaRecorder.current && isRecordingRef.current) {
            const duration = Date.now() - mediaRecorder.current.startTime;
            if (duration < 1000) {
                audioChunks.current = []; // Prevent sending
                mediaRecorder.current.stop();
                isRecordingRef.current = false;
                setRecording(false);
                showToastMessage("Áudio muito curto", "error");
                return;
            }

            const spamCheck = window.spamController.checkSpam('audio');
            if (spamCheck.blocked) {
                audioChunks.current = []; // Prevent sending
                mediaRecorder.current.stop();
                isRecordingRef.current = false;
                setRecording(false);
                showToastMessage(spamCheck.message, "error");
                return;
            }
            mediaRecorder.current.stop();
            isRecordingRef.current = false;
            setRecording(false);
            setLastMessageSentTime(Date.now());
        }
    };

    const [showAttachMenu, setShowAttachMenu] = React.useState(false);
    
    const visibleMessages = messages.filter(m => !localDeletedIds.includes(m.key));

    return (
        <div className={`flex flex-col h-[100dvh] max-h-[100dvh] w-full relative transition-colors duration-500 overflow-hidden ${ephemeralMode ? 'bg-gray-950' : (appSettings.theme === 'escuro' || (appSettings.theme==='sistema' && document.documentElement.classList.contains('dark')) ? 'bg-gray-900' : 'bg-slate-50')}`} style={{ width: '100vw', maxWidth: '100%' }} data-name="chat-room" data-file="components/ChatRoom.js">
            {appSettings.wallpaper === 'padrao' ? (
                <div className="absolute inset-0 opacity-[0.03] pointer-events-none z-0" style={{ backgroundImage: 'radial-gradient(#000 1px, transparent 1px)', backgroundSize: '24px 24px' }}></div>
            ) : (
                <div className="absolute inset-0 bg-cover bg-center opacity-10 pointer-events-none z-0" style={{ backgroundImage: `url(https://images.unsplash.com/photo-1557682250-33bd709cbe85?w=1000&q=80)` }}></div>
            )}

            {/* Selection Header */}
            {selectionMode ? (
                <div className="flex-none px-4 py-3 bg-indigo-600 shadow-md z-50 flex justify-between items-center text-white">
                    <div className="flex items-center gap-4">
                        <button onClick={() => { setSelectionMode(false); setSelectedMessages([]); }} className="p-2 hover:bg-indigo-700 rounded-full">
                            <div className="icon-arrow-left text-xl"></div>
                        </button>
                        <span className="font-bold text-lg">{selectedMessages.length} selecionadas</span>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={selectAll} className="p-2 hover:bg-indigo-700 rounded-full text-sm font-medium">
                            Tudo
                        </button>
                        <button onClick={handleCopySelected} className="p-2 hover:bg-indigo-700 rounded-full" title="Copiar Textos">
                            <div className="icon-copy text-xl"></div>
                        </button>
                        <button onClick={() => handleDeleteSelected('local')} className="p-2 hover:bg-indigo-700 rounded-full" title="Apagar localmente">
                            <div className="icon-trash-2 text-xl"></div>
                        </button>
                        {selectedMessages.length === 1 && verificarPermissao('responder_mensagem') && (
                            <button onClick={() => {
                                const msg = visibleMessages.find(m => m.key === selectedMessages[0]);
                                setReplyingTo(msg);
                                setSelectionMode(false);
                                setSelectedMessages([]);
                            }} className="p-2 hover:bg-indigo-700 rounded-full" title="Responder">
                                <div className="icon-corner-up-left text-xl"></div>
                            </button>
                        )}

                        {(isAdmin || (verificarPermissao('apagar_propria_mensagem') && selectedMessages.every(id => {
                            const m = visibleMessages.find(msg => msg.key === id);
                            return m && m.senderId === user.id;
                        }))) && (
                            <button onClick={() => handleDeleteSelected('admin_everyone')} className="p-2 hover:bg-red-600 rounded-full bg-red-500" title="Apagar selecionadas (Para Todos)">
                                <div className="icon-trash text-xl"></div>
                            </button>
                        )}
                    </div>
                </div>
            ) : (
                <div className={`flex-none px-3 sm:px-4 py-3 shadow-sm z-50 flex justify-between items-center border-b ${ephemeralMode ? 'bg-gray-900 border-gray-800 text-white' : 'bg-white border-gray-200 text-gray-800'}`}>
                    <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0 mr-2">
                        <button onClick={() => window.location.href = 'index.html'} className={`p-1.5 sm:p-2 -ml-1 sm:-ml-2 rounded-full transition-colors flex-shrink-0 ${ephemeralMode ? 'text-gray-300 hover:bg-gray-800' : 'text-gray-500 hover:bg-gray-100'}`}>
                            <div className="icon-arrow-left text-xl"></div>
                        </button>
                        <div className="relative flex-shrink-0 cursor-pointer" onClick={() => window.location.href = `info.html?chatId=${chat.id}`}>
                            <div className={`w-10 h-10 sm:w-11 sm:h-11 rounded-full flex items-center justify-center text-white font-bold shadow-sm ${ephemeralMode ? 'bg-purple-600' : 'bg-gradient-to-br from-indigo-500 to-purple-600'}`}>
                                {chat.name.charAt(0).toUpperCase()}
                            </div>
                            {chat.type === 'direct' && <div className={`absolute bottom-0 right-0 w-3 h-3 sm:w-3.5 sm:h-3.5 bg-green-500 border-2 rounded-full ${ephemeralMode ? 'border-gray-900' : 'border-white'}`}></div>}
                        </div>
                        <div className="cursor-pointer flex flex-col flex-1 min-w-0" onClick={() => window.location.href = `info.html?chatId=${chat.id}`}>
                            <h3 className="font-bold text-base sm:text-lg leading-tight hover:underline truncate">{window.CensorUtils ? window.CensorUtils.censor(chat.name) : chat.name}</h3>
                            <p className={`text-xs font-medium truncate ${ephemeralMode ? 'text-purple-400' : 'text-indigo-500'}`}>
                                {ephemeralMode ? 'Modo Secreto (24h)' : 'Toque para ver info'}
                            </p>
                        </div>
                    </div>
                    <div className="flex gap-0 sm:gap-1 flex-shrink-0">
                        {(() => {
                            let canMakeCalls = true;
                            if (chat.type === 'group') {
                                // Calls might be considered 'enviar_link' or basic messages unless strict perms exist
                                canMakeCalls = isAdmin || verificarPermissao('enviar_mensagem');
                            }
                            
                            if (!canMakeCalls) return null;

                            return (
                                <>
                                    <button onClick={() => startCall(false)} className={`p-2.5 rounded-full transition-colors ${ephemeralMode ? 'text-gray-300 hover:bg-gray-700' : 'text-indigo-600 hover:bg-indigo-50'}`}>
                                        <div className="icon-phone text-xl"></div>
                                    </button>
                                    <button onClick={() => startCall(true)} className={`p-2.5 rounded-full transition-colors ${ephemeralMode ? 'text-gray-300 hover:bg-gray-700' : 'text-indigo-600 hover:bg-indigo-50'}`}>
                                        <div className="icon-video text-xl"></div>
                                    </button>
                                </>
                            );
                        })()}
                    </div>
                </div>
            )}
            
            <div 
                ref={scrollContainerRef}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                onScroll={handleScroll}
                className="flex-1 overflow-y-auto p-4 space-y-4 z-10 relative" 
                onClick={() => { setShowAttachMenu(false); setShowEmojiPicker(false); setShowGifPicker(false); setContextMenu(null); }}
                style={{ 
                    transform: `translateY(-${pullY}px)`, 
                    transition: isPulling ? 'none' : 'transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)' 
                }}
            >
                {visibleMessages.map((msg) => {
                    const isSelected = selectedMessages.includes(msg.key);
                    const decryptedText = (msg.type === 'text' && window.CryptoUtils) ? window.CryptoUtils.decrypt(msg.text, encryptionKey) : msg.text;
                    const decryptedReplyText = (msg.replyTo && msg.replyTo.type === 'text' && window.CryptoUtils) ? window.CryptoUtils.decrypt(msg.replyTo.text, encryptionKey) : (msg.replyTo?.text || '');
                    
                    return (
                        <div key={msg.key} 
                             className={`flex ${msg.senderId === user.id ? 'justify-end' : 'justify-start'} cursor-pointer`}
                             onMouseDown={() => handleMessagePressStart(msg)}
                             onMouseUp={handleMessagePressEnd}
                             onMouseLeave={handleMessagePressEnd}
                             onTouchStart={() => handleMessagePressStart(msg)}
                             onTouchEnd={handleMessagePressEnd}
                             onClick={() => toggleMessageSelection(msg)}
                             onContextMenu={(e) => {
                                 e.preventDefault();
                                 if (selectionMode) return;
                                 setContextMenu({ x: e.clientX, y: e.clientY, msg });
                             }}
                        >
                            {selectionMode && (
                                <div className="mr-2 flex items-center">
                                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${isSelected ? 'bg-indigo-600 border-indigo-600' : 'border-gray-400'}`}>
                                        {isSelected && <div className="icon-check text-white text-sm"></div>}
                                    </div>
                                </div>
                            )}
                            <div className={`max-w-[85%] md:max-w-[70%] px-4 py-3 relative shadow-sm transition-all ${isSelected ? 'scale-95 opacity-90' : ''} 
                                ${appSettings.animations === 'deslizar' ? 'animate-fade-in-up' : appSettings.animations === 'bounce' ? 'animate-bounce' : ''}
                                ${appSettings.bubbleStyle === 'quadrado' ? 'rounded-none' : appSettings.bubbleStyle === 'bolha' ? 'rounded-full px-6' : 'rounded-2xl'}
                                ${msg.senderId === user.id ? `bg-gradient-to-br from-indigo-500 to-blue-600 text-white ${appSettings.bubbleStyle === 'quadrado' ? '' : 'rounded-br-none'}` : (ephemeralMode || document.documentElement.classList.contains('dark') ? `bg-gray-800 text-gray-100 border border-gray-700 ${appSettings.bubbleStyle === 'quadrado' ? '' : 'rounded-bl-none'}` : `bg-white text-slate-800 border border-slate-200 ${appSettings.bubbleStyle === 'quadrado' ? '' : 'rounded-bl-none'}`)}`}>
                                {msg.ephemeral && <div className="icon-timer text-xs absolute top-1 right-2 opacity-50"></div>}
                                
                                {msg.replyTo && (
                                    <div className={`mb-2 pl-2 border-l-4 border-indigo-400 rounded bg-black/5 p-2 text-sm ${msg.senderId === user.id ? 'text-indigo-100 border-white' : 'text-gray-600'}`}>
                                        <div className="font-bold text-xs opacity-70 mb-0.5">{window.CensorUtils ? window.CensorUtils.censor(msg.replyTo.senderName) : msg.replyTo.senderName}</div>
                                        <div className="truncate italic opacity-90">{window.CensorUtils ? window.CensorUtils.censor(decryptedReplyText) : decryptedReplyText}</div>
                                    </div>
                                )}

                                {msg.type === 'text' && (
                                    <div className={`break-words mt-1 ${msg.deletedByAdmin ? 'italic opacity-80' : ''}`}>
                                        {msg.deletedByAdmin ? decryptedText : renderTextWithLinks(decryptedText)}
                                        {msg.edited && !msg.deletedByAdmin && <span className="text-[10px] ml-2 opacity-70">(editado)</span>}
                                    </div>
                                )}
                                {msg.type === 'call_link' && (
                                    <div className="flex flex-col items-center p-2 mt-1">
                                        <div className={`icon-${msg.text.includes('Vídeo') ? 'video' : 'phone'} text-3xl mb-2 opacity-80`}></div>
                                        <div className="font-medium mb-3">{msg.text}</div>
                                        <a href={`call.html?callId=${msg.callId}`} target="_blank" className="bg-white text-indigo-600 px-4 py-1.5 rounded-full text-sm font-bold shadow hover:bg-gray-50 transition-colors">
                                            Entrar na Chamada
                                        </a>
                                    </div>
                                )}
                                {msg.type === 'image' && msg.fileData && <img src={msg.fileData} alt="Shared" className="max-w-full rounded mt-2 mb-1" />}
                                {msg.type === 'video' && msg.fileData && (
                                    <div className="max-w-full overflow-hidden rounded-lg mt-2 mb-1 bg-black flex justify-center items-center">
                                        {window.UniversalVideoPlayer ? <window.UniversalVideoPlayer src={msg.fileData} /> : <window.CustomVideoPlayer src={msg.fileData} />}
                                    </div>
                                )}
                                {msg.type === 'shared_video' && (
                                    <div 
                                        className="mt-2 mb-1 w-64 sm:w-72 rounded-xl overflow-hidden shadow-md border bg-black flex flex-col"
                                        style={{ borderColor: msg.senderId === user.id ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.1)' }}
                                    >
                                        {msg.mediaUrl && (
                                            <div className="w-full bg-black flex justify-center items-center min-h-[150px] relative pointer-events-auto">
                                                {msg.mediaUrl.match(/\.(jpeg|jpg|gif|png|webp)$/i) || msg.mediaUrl.includes('-jpg') || msg.mediaUrl.includes('-png') || msg.mediaUrl.includes('-gif') ? (
                                                    <img src={msg.mediaUrl} className="w-full h-auto max-h-64 object-contain" alt="Post" />
                                                ) : (
                                                    window.UniversalVideoPlayer ? <window.UniversalVideoPlayer src={msg.mediaUrl} /> : <video src={msg.mediaUrl} controls playsInline preload="metadata" className="w-full max-h-64 object-contain"></video>
                                                )}
                                            </div>
                                        )}
                                        <div className={`p-3 transition-colors ${msg.senderId === user.id ? 'bg-indigo-600' : (ephemeralMode || document.documentElement.classList.contains('dark') ? 'bg-gray-800' : 'bg-white')}`}>
                                            <div className="cursor-pointer" onClick={() => window.open(msg.postUrl, '_blank')}>
                                                <p className={`text-sm font-bold truncate ${msg.senderId === user.id ? 'text-white' : (ephemeralMode || document.documentElement.classList.contains('dark') ? 'text-white' : 'text-gray-900')}`}>@{msg.postAuthor}</p>
                                                <p className={`text-xs truncate mt-0.5 ${msg.senderId === user.id ? 'text-indigo-100' : (ephemeralMode || document.documentElement.classList.contains('dark') ? 'text-gray-300' : 'text-gray-600')}`}>{msg.postTitle}</p>
                                            </div>
                                            <div className="flex items-center justify-between mt-3">
                                                <div className={`text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 cursor-pointer hover:opacity-80 ${msg.senderId === user.id ? 'text-white' : 'text-indigo-500'}`} onClick={() => window.open(msg.postUrl, '_blank')}>
                                                    <div className="icon-external-link"></div>
                                                    Ver original
                                                </div>
                                                <div 
                                                    className={`p-1.5 rounded-full cursor-pointer hover:bg-black/10 transition-colors ${msg.senderId === user.id ? 'text-white' : 'text-indigo-500'}`}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        // Fallback nativo de compartilhamento
                                                        if (navigator.share) {
                                                            navigator.share({
                                                                title: msg.postTitle,
                                                                text: `Veja este post de @${msg.postAuthor} no Phantora!`,
                                                                url: msg.postUrl
                                                            }).catch(() => {});
                                                        } else {
                                                            navigator.clipboard.writeText(msg.postUrl);
                                                            showToastMessage("Link copiado para compartilhar!", "success");
                                                        }
                                                    }}
                                                    title="Compartilhar"
                                                >
                                                    <div className="icon-share-2 text-lg"></div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                                {msg.type === 'audio' && msg.fileData && <window.CustomAudioPlayer src={msg.fileData} isOwn={msg.senderId === user.id} />}
                                
                                <div className={`text-[10px] mt-1 flex justify-between items-center w-full ${msg.senderId === user.id ? 'text-indigo-200' : (ephemeralMode ? 'text-gray-400' : 'text-gray-400')}`}>
                                    <div className="flex gap-2 items-center">
                                        {msg.senderId === user.id && msg.read && (
                                            <div className="icon-check-check text-[14px] text-blue-300" title="Lida"></div>
                                        )}
                                        {msg.senderId === user.id && !msg.read && (
                                            <div className="icon-check text-[14px] opacity-70" title="Enviada"></div>
                                        )}
                                    </div>
                                    <div className="flex gap-1 items-center">
                                        {chat.type === 'group' && msg.senderId !== user.id && (() => {
                                            let rColor = '#9ca3af';
                                            let rIcon = '';
                                            let rName = '';
                                            
                                            if (cargosData) {
                                                if (cargosData.dono === msg.senderId) { rColor = '#FFD700'; rIcon = '👑'; }
                                                else if (cargosData.admins?.includes(msg.senderId)) { rColor = '#FF4444'; rIcon = '🛡️'; }
                                                else if (cargosData.moderadores?.includes(msg.senderId)) { rColor = '#44FF44'; rIcon = '⭐'; }
                                                else if (cargosData.mutados?.includes(msg.senderId)) { rColor = '#FF8800'; rIcon = '🔇'; }
                                                else if (cargosData.cargos_personalizados) {
                                                    for (const [cName, cData] of Object.entries(cargosData.cargos_personalizados)) {
                                                        if (cData.membros?.includes(msg.senderId)) {
                                                            rColor = cData.cor || '#FF0066';
                                                            rName = cName.toUpperCase();
                                                            rIcon = '🔴';
                                                            break;
                                                        }
                                                    }
                                                }
                                            }
                                            
                                            return (
                                                <span className="mr-1 font-bold flex items-center gap-1" style={{color: rColor}}>
                                                    {rIcon && <span className="text-[10px]">{rIcon}</span>}
                                                    {rName && <span className="text-[8px] px-1 bg-white/20 rounded mr-0.5">{rName}</span>}
                                                    {window.CensorUtils ? window.CensorUtils.censor(msg.senderName) : msg.senderName} • 
                                                </span>
                                            );
                                        })()}
                                        {new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })}
                
                {/* Secret Pull Indicator (Bottom) */}
                <div className="flex justify-center mt-8 transition-opacity duration-200" style={{ opacity: pullY > 50 ? 1 : 0 }}>
                    <div className="flex flex-col items-center bg-gray-900 bg-opacity-80 text-white px-6 py-4 rounded-2xl shadow-xl backdrop-blur-sm">
                        <div className={`icon-loader text-4xl mb-2 ${pullProgress > 0 ? 'animate-spin text-purple-400' : 'text-gray-400'}`}></div>
                        <p className="text-sm font-bold">{ephemeralMode ? 'Desativar' : 'Ativar'} Modo Secreto</p>
                        {pullProgress > 0 && (
                            <div className="w-24 h-1.5 bg-gray-700 rounded-full mt-3 overflow-hidden">
                                <div className="h-full bg-purple-500 transition-all duration-100" style={{ width: `${(pullProgress / 30) * 100}%` }}></div>
                            </div>
                        )}
                    </div>
                </div>

                <div ref={messagesEndRef} className="h-4" />
            </div>

            {showScrollBottom && (
                <button 
                    onClick={() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })}
                    className="absolute bottom-[90px] right-4 w-10 h-10 bg-white text-indigo-600 rounded-full shadow-lg flex items-center justify-center z-[60] border border-gray-200 hover:bg-gray-50 transition-transform animate-fade-in-up"
                >
                    <div className="icon-chevron-down text-xl mt-0.5"></div>
                </button>
            )}
            
            <div className={`flex-none p-2 sm:p-3 border-t flex flex-col z-50 w-full box-border max-w-full overflow-hidden ${ephemeralMode ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200'}`}>
                {replyingTo && (
                    <div className={`flex items-center justify-between p-2 px-4 rounded-t-xl border-l-4 -mt-3 mb-2 animate-fade-in-up flex-shrink-0 ${ephemeralMode ? 'bg-gray-800 border-purple-500' : 'bg-indigo-50 border-indigo-500'}`}>
                        <div className="overflow-hidden min-w-0">
                            <span className="text-xs font-bold text-indigo-600 block">Respondendo a {window.CensorUtils ? window.CensorUtils.censor(replyingTo.senderName) : replyingTo.senderName}</span>
                            <span className="text-sm text-gray-600 truncate block">{replyingTo.type === 'text' ? (window.CensorUtils ? window.CensorUtils.censor(window.CryptoUtils ? window.CryptoUtils.decrypt(replyingTo.text, encryptionKey) : replyingTo.text) : (window.CryptoUtils ? window.CryptoUtils.decrypt(replyingTo.text, encryptionKey) : replyingTo.text)) : replyingTo.fileName || 'Mídia'}</span>
                        </div>
                        <button onClick={() => setReplyingTo(null)} className="text-gray-400 hover:text-gray-600">
                            <div className="icon-x text-lg"></div>
                        </button>
                    </div>
                )}
                
                {showEmojiPicker && (
                    <div className="absolute bottom-20 left-4 z-50 shadow-2xl rounded-xl overflow-hidden animate-fade-in-up border border-gray-200">
                        <emoji-picker ref={emojiPickerRef} class={ephemeralMode ? 'dark' : 'light'}></emoji-picker>
                    </div>
                )}

                {showGifPicker && (
                    <div className="absolute bottom-20 left-4 z-50 animate-fade-in-up">
                        <GifPicker isDark={ephemeralMode} onSelect={sendGif} />
                    </div>
                )}

                {(() => {
                    if (chat.type === 'group' && myRoleName === 'mutado') {
                        return (
                            <div className="flex items-center justify-center p-3 bg-orange-50 text-orange-600 rounded-xl font-bold text-sm text-center border border-orange-200">
                                🔇 Você foi mutado neste grupo.
                            </div>
                        );
                    }
                    if (chat.type === 'group' && !verificarPermissao('enviar_mensagem')) {
                        return (
                            <div className="flex items-center justify-center p-3 bg-gray-100 rounded-xl text-gray-500 font-medium text-sm text-center">
                                Seu cargo não permite enviar mensagens.
                            </div>
                        );
                    }

                    return (
                <div className="flex gap-1.5 sm:gap-2 items-end w-full max-w-full">
                {showAttachMenu && (
                    <div className={`absolute bottom-16 left-2 right-2 sm:left-4 sm:right-auto rounded-2xl shadow-xl border p-4 flex gap-4 justify-around sm:justify-start animate-fade-in-up ${ephemeralMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-100'}`}>
                        {verificarPermissao('enviar_foto') && (
                            <button onClick={() => { fileInputRef.current?.click(); setShowAttachMenu(false); }} className="flex flex-col items-center gap-2 group">
                                <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                                    <div className="icon-image text-2xl"></div>
                                </div>
                                <span className={`text-xs font-medium ${ephemeralMode ? 'text-gray-300' : 'text-gray-600'}`}>Mídia</span>
                            </button>
                        )}
                        {verificarPermissao('enviar_foto') && (
                            <button onClick={() => { setShowCamera(true); setShowAttachMenu(false); }} className="flex flex-col items-center gap-2 group">
                                <div className="w-12 h-12 rounded-full bg-pink-100 text-pink-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                                    <div className="icon-camera text-2xl"></div>
                                </div>
                                <span className={`text-xs font-medium ${ephemeralMode ? 'text-gray-300' : 'text-gray-600'}`}>Câmera</span>
                            </button>
                        )}
                        {verificarPermissao('enviar_documento') && (
                            <button onClick={() => { fileInputRef.current?.click(); setShowAttachMenu(false); }} className="flex flex-col items-center gap-2 group">
                                <div className="w-12 h-12 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                                    <div className="icon-file-text text-2xl"></div>
                                </div>
                                <span className={`text-xs font-medium ${ephemeralMode ? 'text-gray-300' : 'text-gray-600'}`}>Documento</span>
                            </button>
                        )}
                    </div>
                )}
                
                <input type="file" ref={fileInputRef} className="hidden" accept="image/*, audio/*, video/*, application/pdf" onChange={(e) => {
                    if (e.target.files[0]) sendMediaFile(e.target.files[0], e.target.files[0].type.startsWith('image/') ? 'image' : 'file');
                }} />
                
                <div className={`flex-1 min-w-0 rounded-3xl flex items-center px-1 sm:px-2 min-h-[50px] ${ephemeralMode ? 'bg-gray-700' : 'bg-gray-100'}`}>
                    <button onClick={() => { setShowEmojiPicker(!showEmojiPicker); setShowGifPicker(false); setShowAttachMenu(false); }} className={`p-1.5 sm:p-2.5 rounded-full flex-shrink-0 transition-colors ${ephemeralMode ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-indigo-600'}`}>
                        <div className="icon-smile text-xl"></div>
                    </button>

                    <button onClick={() => { setShowGifPicker(!showGifPicker); setShowEmojiPicker(false); setShowAttachMenu(false); }} className={`p-1.5 sm:p-2.5 rounded-full flex-shrink-0 transition-colors ${ephemeralMode ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-indigo-600'}`}>
                        <div className="icon-sticker text-xl"></div>
                    </button>
                    
                    <button onClick={() => { setShowAttachMenu(!showAttachMenu); setShowEmojiPicker(false); setShowGifPicker(false); }} className={`p-1.5 sm:p-2.5 rounded-full flex-shrink-0 transition-colors ${ephemeralMode ? 'text-gray-400 hover:text-white hover:bg-gray-600' : 'text-gray-500 hover:text-indigo-600 hover:bg-gray-200'}`}>
                        <div className="icon-paperclip text-xl"></div>
                    </button>
                    
                    <input 
                        type="text" 
                        value={messageInput}
                        onChange={(e) => {
                            setMessageInput(e.target.value);
                            if (db) {
                                const basePath = refPath.split('/messages')[0];
                                db.ref(`${basePath}/typing/${user.id}`).set(true);
                                if (typingTimer.current) clearTimeout(typingTimer.current);
                                typingTimer.current = setTimeout(() => {
                                    db.ref(`${basePath}/typing/${user.id}`).remove();
                                }, 2000);
                            }
                        }}
                        onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                        placeholder={ephemeralMode ? "Secreta..." : "Mensagem"} 
                        className={`flex-1 min-w-0 w-full bg-transparent border-none px-1 sm:px-2 py-3 outline-none text-sm sm:text-base ${ephemeralMode ? 'text-white placeholder-gray-400' : 'text-gray-800 placeholder-gray-500'}`}
                    />
                </div>
                
                {messageInput.trim().length > 0 ? (
                    <button onClick={sendMessage} className={`w-12 h-12 shrink-0 text-white rounded-full flex items-center justify-center transition-transform hover:scale-105 shadow-md ${ephemeralMode ? 'bg-purple-600 hover:bg-purple-700' : 'bg-indigo-600 hover:bg-indigo-700'}`}>
                        <div className="icon-send text-xl ml-1"></div>
                    </button>
                ) : (
                    <button 
                        onMouseDown={startRecording} onMouseUp={stopRecording} onMouseLeave={stopRecording} onTouchStart={startRecording} onTouchEnd={stopRecording}
                        className={`w-12 h-12 shrink-0 rounded-full flex items-center justify-center transition-transform hover:scale-105 shadow-md ${recording ? 'bg-red-500 text-white animate-pulse' : (ephemeralMode ? 'bg-purple-600 text-white hover:bg-purple-700' : 'bg-indigo-600 text-white hover:bg-indigo-700')}`}
                    >
                        <div className="icon-mic text-xl"></div>
                    </button>
                )}
                </div>
                );
                })()}
            </div>

            {contextMenu && (
                <div 
                    className={`fixed z-[100] rounded-xl shadow-2xl border w-48 overflow-hidden animate-fade-in-up ${ephemeralMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}
                    style={{ 
                        top: Math.min(contextMenu.y, window.innerHeight - 150), 
                        left: Math.min(contextMenu.x, window.innerWidth - 200) 
                    }}
                >
                    <button 
                        className={`w-full text-left px-4 py-3 text-sm font-bold flex items-center gap-3 transition-colors ${ephemeralMode ? 'text-gray-200 hover:bg-gray-700' : 'text-gray-700 hover:bg-gray-50'}`}
                        onClick={(e) => {
                            e.stopPropagation();
                            setSelectionMode(true);
                            setSelectedMessages([contextMenu.msg.key]);
                            setContextMenu(null);
                        }}
                    >
                        <div className="icon-check-square text-lg text-indigo-500"></div>
                        Selecionar
                    </button>
                    {contextMenu.msg.type === 'text' && (
                        <button 
                            className={`w-full text-left px-4 py-3 text-sm font-bold flex items-center gap-3 transition-colors border-t ${ephemeralMode ? 'border-gray-700 text-gray-200 hover:bg-gray-700' : 'border-gray-100 text-gray-700 hover:bg-gray-50'}`}
                            onClick={(e) => {
                                e.stopPropagation();
                                const decrypted = window.CryptoUtils ? window.CryptoUtils.decrypt(contextMenu.msg.text, encryptionKey) : contextMenu.msg.text;
                                navigator.clipboard.writeText(decrypted);
                                showToastMessage("Copiado", "success");
                                setContextMenu(null);
                            }}
                        >
                            <div className="icon-copy text-lg text-indigo-500"></div>
                            Copiar
                        </button>
                    )}
                </div>
            )}

            {toastMessage && (
                <div className={`fixed bottom-20 right-4 p-4 rounded-xl shadow-2xl text-white font-medium z-50 flex items-center gap-2 transform transition-all ${toastMessage.type === 'error' ? 'bg-red-500' : 'bg-gray-800'}`}>
                    <div className={`icon-${toastMessage.type === 'error' ? 'alert-circle' : 'check-circle'} text-xl`}></div>
                    {toastMessage.message}
                </div>
            )}

            {pendingDelete && (
                <div className="fixed bottom-24 left-1/2 -translate-x-1/2 bg-gray-800 text-white px-5 py-3 rounded-xl shadow-2xl flex items-center gap-6 z-50 animate-fade-in-up border border-gray-700">
                    <span className="font-medium text-sm">Apagando mensagens...</span>
                    <button onClick={undoDelete} className="text-indigo-400 font-bold text-sm hover:text-indigo-300 uppercase tracking-wider">
                        Desfazer
                    </button>
                </div>
            )}

            {showCamera && (
                <CameraCapture 
                    onClose={() => setShowCamera(false)} 
                    onCapture={(file, type) => {
                        sendMediaFile(file, type);
                        setShowCamera(false);
                    }} 
                />
            )}

        </div>
    );
}
window.ChatRoom = ChatRoom;
