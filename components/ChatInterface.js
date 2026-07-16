function ChatInterface({ user, onLogout }) {
    const db = window.firebaseDB;
    const messagesEndRef = React.useRef(null);
    const [activeChat, setActiveChat] = React.useState(null);
    const [messageInput, setMessageInput] = React.useState("");
    const [chats, setChats] = React.useState([]);
    const [communitiesList, setCommunitiesList] = React.useState([]);
    const [messages, setMessages] = React.useState([]);
    const [activeTab, setActiveTab] = React.useState('chats');
    const [suggestions, setSuggestions] = React.useState([]);
    const [allUsersData, setAllUsersData] = React.useState({});
    const [showUserProfileCard, setShowUserProfileCard] = React.useState(false);
    const [editUsername, setEditUsername] = React.useState("");
    const [quickActionChat, setQuickActionChat] = React.useState(null);
    const webrtcManager = React.useRef(null);
    const mediaRecorder = React.useRef(null);
    const audioChunks = React.useRef([]);
    const [recording, setRecording] = React.useState(false);
    const fileInputRef = React.useRef(null);

    // Calling States
    const [callState, setCallState] = React.useState(null);
    const [localStream, setLocalStream] = React.useState(null);
    const [remoteStream, setRemoteStream] = React.useState(null);
    const localVideoRef = React.useRef(null);
    const remoteVideoRef = React.useRef(null);
    const currentCallRef = React.useRef(null);

    // Group & Contacts States
    const [showAddContact, setShowAddContact] = React.useState(false);
    const [searchUsername, setSearchUsername] = React.useState("");
    const [showCreateGroup, setShowCreateGroup] = React.useState(false);
    const [newGroupName, setNewGroupName] = React.useState("");
    const [selectedUsersForGroup, setSelectedUsersForGroup] = React.useState([]);
    
    const [showUserInfo, setShowUserInfo] = React.useState(false);
    const [showNotificationSettings, setShowNotificationSettings] = React.useState(false);
    const [showSettingsMenu, setShowSettingsMenu] = React.useState(false);
    const [isSubscribed, setIsSubscribed] = React.useState(false);
    const [toastMessage, setToastMessage] = React.useState(null);
    const [contextMenu, setContextMenu] = React.useState(null);
    const [editingMessage, setEditingMessage] = React.useState(null);
    const [featuredHours, setFeaturedHours] = React.useState(1);
    const [showFeaturedModal, setShowFeaturedModal] = React.useState(false);
    const [tvAuthRequests, setTvAuthRequests] = React.useState([]);
    const [forwardMsg, setForwardMsg] = React.useState(null);
    const [forwardSelected, setForwardSelected] = React.useState([]);

    React.useEffect(() => {
        const pendingFwd = localStorage.getItem("pending_forward_msg");
        if (pendingFwd) {
            setForwardMsg(pendingFwd);
            localStorage.removeItem("pending_forward_msg");
        }
        if (!db || !user) return;
        const localLocked = JSON.parse(localStorage.getItem('lockedChats') || '{}');
        db.ref(`users/${user.id}/lockedChats`).update(localLocked);

        const requestsRef = db.ref(`users/${user.id}/authRequests`);
        requestsRef.on('value', snap => {
            const val = snap.val();
            if (val) {
                const reqs = Object.keys(val).map(k => ({ id: k, ...val[k] })).filter(r => r.status === 'pending');
                setTvAuthRequests(reqs);
            } else {
                setTvAuthRequests([]);
            }
        });

        return () => requestsRef.off();
    }, [db, user]);

    const handleTvAuthRequest = async (req, approve) => {
        if (!approve) {
            await db.ref(`users/${user.id}/authRequests/${req.id}`).remove();
            return;
        }

        try {
            const locked = JSON.parse(localStorage.getItem('lockedChats') || '{}');
            const lockData = locked[req.chatId];

            if (window.PublicKeyCredential && lockData && lockData.credentialId) {
                const challenge = new Uint8Array(32);
                window.crypto.getRandomValues(challenge);
                await navigator.credentials.get({
                    publicKey: {
                        challenge: challenge,
                        allowCredentials: [{
                            type: "public-key",
                            id: new Uint8Array(lockData.credentialId),
                            transports: ["internal", "hybrid"]
                        }],
                        timeout: 60000,
                        userVerification: "required"
                    }
                });
            }

            if (req.alwaysAllow) {
                await db.ref(`users/${user.id}/devices/${req.id}/unlockedChats/${req.chatId}`).set(true);
            }

            await db.ref(`users/${user.id}/authRequests/${req.id}`).update({ status: 'approved' });
            showToastMessage("Permissão concedida à TV!", "success");
        } catch (err) {
            showToastMessage("Falha ao autenticar biometria.", "error");
            await db.ref(`users/${user.id}/authRequests/${req.id}`).remove();
        }
    };

    const cleanupOldFiles = async (msgs, refPath) => {
        const now = Date.now();
        const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;
        let cleaned = false;
        
        for (const msg of msgs) {
            if ((msg.type === 'image' || msg.type === 'audio' || msg.type === 'file') && msg.fileData) {
                if (now - msg.timestamp > TWENTY_FOUR_HOURS) {
                    await db.ref(`${refPath}/${msg.key}/fileData`).remove();
                    await db.ref(`${refPath}/${msg.key}/text`).set('Arquivo expirado (24h)');
                    await db.ref(`${refPath}/${msg.key}/type`).set('text');
                    cleaned = true;
                }
            }
        }
    };

    React.useEffect(() => {
        if (!db || !user) return;

        // Carregar Chats e Comunidades
        const chatsRef = db.ref(`users/${user.id}/chats`);
        const commsRef = db.ref(`users/${user.id}/communities`);
        
        let localChats = [];
        let localComms = [];

        const updateMergedList = () => {
            const merged = [...localChats, ...localComms];
            merged.sort((a, b) => (b.timestamp || b.joinedAt || 0) - (a.timestamp || a.joinedAt || 0));
            setChats(merged);
        };

        chatsRef.on('value', snap => {
            const val = snap.val();
            // Filter out groups that belong to a community
            localChats = val ? Object.keys(val)
                .map(k => ({...val[k], id: k}))
                .filter(chat => !chat.communityId) // RULE 1: Hide if it has communityId
                : [];
            updateMergedList();
        });

        commsRef.on('value', snap => {
            const val = snap.val();
            localComms = val ? Object.keys(val).map(k => ({...val[k], id: k, type: 'community', lastMessage: 'Comunidade'})) : [];
            const commList = [...localComms].sort((a, b) => (b.joinedAt || 0) - (a.joinedAt || 0));
            setCommunitiesList(commList);
            updateMergedList();
        });

        // Carregar Sugestões e Usuários
        db.ref('users').on('value', snap => {
            const val = snap.val();
            if(val) {
                const blockedUsers = JSON.parse(localStorage.getItem('blockedUsers') || '[]');
                setAllUsersData(val);
                const now = Date.now();
                const usersList = Object.keys(val).map(k => ({...val[k], id: k})).filter(u => u.id !== user.id && u.isFeatured && u.featuredUntil > now && !blockedUsers.includes(u.id));
                setSuggestions(usersList);
            }
        });

        // Ver transferências de posse
        db.ref(`ownership_transfers/${user.id}`).on('value', snap => {
            const transfer = snap.val();
            if (transfer && confirm(`Você foi convidado para ser o DONO do grupo ${transfer.groupId}. Aceitar?`)) {
                db.ref(`groups/${transfer.groupId}/cargos/dono`).set(user.id);
                db.ref(`groups/${transfer.groupId}/members/${transfer.fromId}`).remove();
                db.ref(`users/${transfer.fromId}/chats/${transfer.groupId}`).remove();
                db.ref(`ownership_transfers/${user.id}`).remove();
            } else if (transfer) {
                db.ref(`ownership_transfers/${user.id}`).remove();
            }
        });

        // WebRTC calls listener is handled globally now.

        // Initial check for OneSignal subscription
        if (window.OneSignalDeferred) {
            window.OneSignalDeferred.push(async function(OneSignal) {
                const sub = OneSignal.User.PushSubscription.optedIn;
                setIsSubscribed(sub);
            });
        }

        // TV Sync Queue listener
        const syncRef = db.ref(`tv_sync_queue/${user.id}`);
        syncRef.on('child_added', async (snap) => {
            const msg = snap.val();
            if (msg) {
                const directId = (msg.chatId && msg.chatId.startsWith('chat_')) ? msg.chatId : [user.id, msg.targetId || msg.chatId].sort().join('_');
                const refPath = msg.chatType === 'group' ? `groups/${msg.chatId}/messages` : `chats/${directId}/messages`;
                const { chatType, chatId, targetId, ...realMsg } = msg;
                
                await db.ref(refPath).push(realMsg);
                
                const chatUpdate = { lastMessage: realMsg.type === 'text' ? realMsg.text : 'Áudio', timestamp: realMsg.timestamp };
                if (msg.chatType === 'group') {
                    const groupSnap = await db.ref(`groups/${msg.chatId}/members`).once('value');
                    const members = groupSnap.val() || {};
                    for (const uid of Object.keys(members)) {
                        await db.ref(`users/${uid}/chats/${msg.chatId}`).update(chatUpdate);
                    }
                } else {
                    await db.ref(`users/${user.id}/chats/${msg.targetId}`).update(chatUpdate);
                    if (msg.targetId !== user.id) {
                        await db.ref(`users/${msg.targetId}/chats/${user.id}`).update(chatUpdate);
                    }
                }
                
                await syncRef.child(snap.key).remove();
            }
        });

        return () => {
            chatsRef.off();
            syncRef.off();
        };
    }, [db, user]);

    React.useEffect(() => {
        if (!activeChat || !db) return;
        
        const sharedId = (activeChat.id && activeChat.id.startsWith('chat_')) ? activeChat.id : [user.id, activeChat.targetId || activeChat.id].sort().join('_');
        const refPath = activeChat.type === 'group' ? `groups/${activeChat.id}/messages` : `chats/${sharedId}/messages`;
        const messagesRef = db.ref(refPath);
        
        messagesRef.on('value', (snapshot) => {
            const data = snapshot.val();
            if (data) {
                const msgList = Object.keys(data).map(key => ({ ...data[key], key }));
                cleanupOldFiles(msgList, refPath); // Run 24h cleanup
                setMessages(msgList);
                setTimeout(() => {
                    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
                }, 100);
            } else {
                setMessages([]);
            }
        });

        return () => messagesRef.off();
    }, [activeChat, db, user.id]);

    const showToastMessage = (message, type = "info") => {
        setToastMessage({ message, type });
        setTimeout(() => setToastMessage(null), 3000);
    };

    const startCallForChat = async (targetChat, video = false) => {
        if (!targetChat) return;
        const callWin = window.open('', '_blank');
        const callId = `call_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
        const callUrl = `${window.location.origin}${window.location.pathname.replace('index.html', '')}call.html?callId=${callId}`;
        
        await db.ref(`calls/${callId}`).set({
            callerId: user.id,
            receiverId: targetChat.id,
            isVideo: video,
            status: 'initiated',
            timestamp: Date.now()
        });

        const sharedId = (targetChat.id && targetChat.id.startsWith('chat_')) ? targetChat.id : [user.id, targetChat.targetId || targetChat.id].sort().join('_');
        const refPath = targetChat.type === 'group' ? `groups/${targetChat.id}/messages` : `chats/${sharedId}/messages`;
        await db.ref(refPath).push({
            senderId: user.id,
            senderName: user.name,
            type: 'call_link',
            callId: callId,
            text: video ? 'Chamada de Vídeo' : 'Chamada de Voz',
            timestamp: Date.now()
        });

        let targetIds = [];
        if (targetChat.type === 'group') {
            const groupSnap = await db.ref(`groups/${targetChat.id}/members`).once('value');
            const members = groupSnap.val() || {};
            targetIds = Object.keys(members).filter(uid => uid !== user.id);
        } else {
            targetIds = [targetChat.id];
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

        if (callWin) {
            callWin.location.href = callUrl;
        } else {
            window.open(callUrl, '_blank');
        }
        setQuickActionChat(null);
    };

    const searchAndAddUser = async () => {
        if (!searchUsername.trim()) return;
        const sUser = searchUsername.trim().toLowerCase();
        
        try {
            const usersRef = await db.ref('users').orderByChild('username').equalTo(sUser).once('value');
            const data = usersRef.val();
            if (data) {
                const targetId = Object.keys(data)[0];
                if (targetId === user.id) {
                    showToastMessage("Você não pode adicionar a si mesmo!", "error");
                    return;
                }
                const targetData = data[targetId];
                
                // Check if chat already exists
                let existingChatId = null;
                const myChatsSnap = await db.ref(`users/${user.id}/chats`).once('value');
                if (myChatsSnap.exists()) {
                    const myChats = myChatsSnap.val();
                    for (const [key, chatData] of Object.entries(myChats)) {
                        if (chatData.type === 'direct' && chatData.targetId === targetId) {
                            existingChatId = key;
                            break;
                        }
                    }
                }

                const chatId = existingChatId || `chat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

                await db.ref(`users/${user.id}/chats/${chatId}`).set({
                    name: targetData.name || targetData.username || 'Usuário',
                    type: 'direct',
                    timestamp: Date.now(),
                    targetId: targetId,
                    avatar: targetData.profilePicture || null
                });
                
                await db.ref(`users/${targetId}/chats/${chatId}`).set({
                    name: user.name || allUsersData[user.id]?.username || 'Usuário',
                    type: 'direct',
                    timestamp: Date.now(),
                    targetId: user.id,
                    avatar: user.avatar || allUsersData[user.id]?.profilePicture || null
                });
                
                setShowAddContact(false);
                setSearchUsername("");
                showToastMessage("Contato adicionado!", "success");
            } else {
                showToastMessage("Usuário não encontrado.", "error");
            }
        } catch(e) {
            showToastMessage("Erro ao buscar.", "error");
        }
    };

    const getEncryptionKey = (chatId, type, targetId) => {
        if (type === 'group') return chatId;
        if (chatId && chatId.startsWith('chat_')) return chatId;
        return [user.id, targetId || chatId].sort().join('_');
    };

    const renderLastMessage = (chat) => {
        if (chat.type === 'community') return 'Comunidade';
        if (!chat.lastMessage) return 'Toque para conversar';
        if (chat.lastMessage.startsWith('U2FsdGVkX1')) {
            const key = getEncryptionKey(chat.id, chat.type, chat.targetId);
            const decrypted = window.CryptoUtils ? window.CryptoUtils.decrypt(chat.lastMessage, key) : chat.lastMessage;
            return decrypted || 'Mensagem criptografada';
        }
        return chat.lastMessage;
    };

    const createGroup = async () => {
        if (!newGroupName.trim() || selectedUsersForGroup.length === 0) {
            showToastMessage("Preencha o nome e selecione participantes.", "error");
            return;
        }
        
        const groupId = `group_${Date.now()}`;
        const members = { [user.id]: 'admin' };
        selectedUsersForGroup.forEach(id => members[id] = 'member');
        
        await db.ref(`groups/${groupId}`).set({
            name: newGroupName,
            createdAt: Date.now(),
            members: members
        });
        
        const groupInfo = { name: newGroupName, type: 'group', timestamp: Date.now() };
        await db.ref(`users/${user.id}/chats/${groupId}`).set(groupInfo);
        
        for (const uid of selectedUsersForGroup) {
            await db.ref(`users/${uid}/chats/${groupId}`).set(groupInfo);
        }
        
        setShowCreateGroup(false);
        setNewGroupName("");
        setSelectedUsersForGroup([]);
        showToastMessage("Grupo criado!", "success");
    };

    const handleContextMenu = (e, msg) => {
        e.preventDefault();
        setContextMenu({
            x: e.pageX,
            y: e.pageY,
            msg: msg
        });
    };

    const handleCopy = () => {
        if (contextMenu?.msg?.text) {
            navigator.clipboard.writeText(contextMenu.msg.text);
            showToastMessage("Copiado!", "success");
        }
        setContextMenu(null);
    };

    const handleDelete = async () => {
        if (!contextMenu?.msg || !activeChat) return;
        const refPath = activeChat.type === 'group' ? `groups/${activeChat.id}/messages` : `chats/${[user.id, activeChat.id].sort().join('_')}/messages`;
        await db.ref(`${refPath}/${contextMenu.msg.key}`).remove();
        setContextMenu(null);
    };

    const [selectedMsgForDeletion, setSelectedMsgForDeletion] = React.useState(null);
    const [showRecordingPanel, setShowRecordingPanel] = React.useState(false);
    const [isRecordingSwipeCancelled, setIsRecordingSwipeCancelled] = React.useState(false);

    const sendMessage = async () => {
        if (!messageInput.trim() || !activeChat || !db) return;
        
        if (window.spamController) {
            const spamCheck = window.spamController.checkSpam('text');
            if (spamCheck.blocked) {
                showToastMessage(spamCheck.message, "error");
                return;
            }
        }
        
        const refPath = activeChat.type === 'group' ? `groups/${activeChat.id}/messages` : `chats/${[user.id, activeChat.id].sort().join('_')}/messages`;

        if (editingMessage) {
            await db.ref(`${refPath}/${editingMessage.key}`).update({
                text: messageInput.trim(),
                edited: true
            });
            setEditingMessage(null);
            setMessageInput("");
            return;
        }

        const msgData = {
            senderId: user.id,
            senderName: user.name,
            type: 'text',
            text: messageInput.trim(),
            timestamp: Date.now()
        };
        
        const uniqueKey = db.ref(refPath).push().key;
        const finalMsgData = { ...msgData, key: uniqueKey };
        await db.ref(`${refPath}/${uniqueKey}`).set(finalMsgData);
        
        if (window.appSyncManager) {
            window.appSyncManager.broadcastMessage(activeChat.id, finalMsgData);
        }
        
        // Update last message
        const chatUpdate = { lastMessage: messageInput.trim(), timestamp: Date.now() };
        if (activeChat.type === 'group') {
            const groupSnap = await db.ref(`groups/${activeChat.id}/members`).once('value');
            const members = groupSnap.val() || {};
            for (const uid of Object.keys(members)) {
                await db.ref(`users/${uid}/chats/${activeChat.id}`).update(chatUpdate);
            }
        } else {
            await db.ref(`users/${user.id}/chats/${activeChat.id}`).update(chatUpdate);
            
            const targetId = activeChat.targetId || activeChat.id;
            if (targetId !== user.id) {
                await db.ref(`users/${targetId}/chats/${activeChat.id}`).update(chatUpdate);
            }
        }
        
        setMessageInput("");
    };

    const sendMediaFile = async (file, type) => {
        if (!activeChat) return;
        if (file.size > 5 * 1024 * 1024) { 
            showToastMessage("Arquivo muito grande! Máximo 5MB", "error"); 
            return; 
        }

        try {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = async () => {
                const base64 = reader.result;
                const msgData = {
                    senderId: user.id,
                    senderName: user.name,
                    type: type,
                    fileData: base64,
                    fileName: file.name,
                    timestamp: Date.now()
                };

                const refPath = activeChat.type === 'group' ? `groups/${activeChat.id}/messages` : `chats/${[user.id, activeChat.id].sort().join('_')}/messages`;
                const uniqueKey = db.ref(refPath).push().key;
                const finalMsgData = { ...msgData, key: uniqueKey };
                await db.ref(`${refPath}/${uniqueKey}`).set(finalMsgData);

                if (window.appSyncManager) {
                    window.appSyncManager.broadcastMessage(activeChat.id, finalMsgData);
                }
            };
        } catch (e) {
            showToastMessage("Erro ao enviar arquivo", "error");
        }
    };

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorder.current = new MediaRecorder(stream);
            mediaRecorder.current.ondataavailable = e => {
                if (e.data.size > 0) audioChunks.current.push(e.data);
            };
            mediaRecorder.current.onstop = async () => {
                const blob = new Blob(audioChunks.current, { type: 'audio/webm' });
                const reader = new FileReader();
                reader.readAsDataURL(blob);
                reader.onload = async () => {
                    const base64 = reader.result;
                    const refPath = activeChat.type === 'group' ? `groups/${activeChat.id}/messages` : `chats/${[user.id, activeChat.id].sort().join('_')}/messages`;
                    
                    const msgData = {
                        senderId: user.id,
                        senderName: user.name,
                        type: 'audio',
                        fileData: base64,
                        timestamp: Date.now()
                    };
                    
                    const uniqueKey = db.ref(refPath).push().key;
                    const finalMsgData = { ...msgData, key: uniqueKey };
                    await db.ref(`${refPath}/${uniqueKey}`).set(finalMsgData);
                    
                    if (window.appSyncManager) {
                        window.appSyncManager.broadcastMessage(activeChat.id, finalMsgData);
                    }
                };
                audioChunks.current = [];
            };
            mediaRecorder.current.startTime = Date.now();
            mediaRecorder.current.start();
            setRecording(true);
        } catch (e) {
            showToastMessage("Erro ao acessar microfone", "error");
        }
    };

    const stopRecording = () => {
        if (mediaRecorder.current && recording) {
            const duration = Date.now() - mediaRecorder.current.startTime;
            if (duration < 1000) {
                mediaRecorder.current.stop();
                setRecording(false);
                audioChunks.current = [];
                showToastMessage("Áudio muito curto", "error");
                return;
            }

            if (window.spamController) {
                const spamCheck = window.spamController.checkSpam('audio');
                if (spamCheck.blocked) {
                    mediaRecorder.current.stop();
                    setRecording(false);
                    audioChunks.current = [];
                    showToastMessage(spamCheck.message, "error");
                    return;
                }
            }

            mediaRecorder.current.stop();
            setRecording(false);
        }
    };

    const handleForwardSend = async () => {
        if (!forwardMsg || forwardSelected.length === 0) return;
        
        for (const targetId of forwardSelected) {
            const chat = chats.find(c => c.id === targetId || c.targetId === targetId);
            if (chat) {
                const sharedId = (chat.id && chat.id.startsWith('chat_')) ? chat.id : [user.id, chat.targetId || chat.id].sort().join('_');
                const refPath = chat.type === 'group' ? `groups/${chat.id}/messages` : `chats/${sharedId}/messages`;
                
                const msgData = {
                    senderId: user.id,
                    senderName: user.name,
                    type: 'text',
                    text: forwardMsg,
                    timestamp: Date.now()
                };
                const uniqueKey = db.ref(refPath).push().key;
                await db.ref(`${refPath}/${uniqueKey}`).set({ ...msgData, key: uniqueKey });
                
                const chatUpdate = { lastMessage: forwardMsg, timestamp: Date.now() };
                if (chat.type === 'group') {
                    const groupSnap = await db.ref(`groups/${chat.id}/members`).once('value');
                    const members = groupSnap.val() || {};
                    for (const uid of Object.keys(members)) {
                        await db.ref(`users/${uid}/chats/${chat.id}`).update(chatUpdate);
                    }
                } else {
                    await db.ref(`users/${user.id}/chats/${chat.id}`).update(chatUpdate);
                    const tid = chat.targetId || chat.id;
                    if (tid !== user.id) {
                        await db.ref(`users/${tid}/chats/${chat.id}`).update(chatUpdate);
                    }
                }
            }
        }
        setForwardMsg(null);
        setForwardSelected([]);
        showToastMessage("Mensagem encaminhada!", "success");
    };

    return (
        <div className="flex h-full w-full overflow-hidden bg-white" data-name="chat-interface" data-file="components/ChatInterface.js">
            {forwardMsg && (
                <div className="fixed inset-0 bg-gray-900 bg-opacity-50 backdrop-blur-sm flex items-center justify-center z-[200] p-4">
                    <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm flex flex-col max-h-[80vh]">
                        <h3 className="text-xl font-bold mb-4">Encaminhar Mensagem</h3>
                        <div className="bg-gray-100 p-3 rounded-xl text-sm mb-4 text-gray-700 italic border-l-4 border-indigo-500">"{forwardMsg}"</div>
                        <p className="text-xs text-gray-500 mb-2">Selecione até 5 contatos:</p>
                        <div className="flex-1 overflow-y-auto space-y-2 mb-4">
                            {chats.filter(c => c.type !== 'community').map(c => (
                                <label key={c.id} className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded-lg cursor-pointer border border-gray-100">
                                    <input 
                                        type="checkbox" 
                                        className="w-5 h-5 text-indigo-600"
                                        checked={forwardSelected.includes(c.id)}
                                        onChange={(e) => {
                                            if (e.target.checked) {
                                                if (forwardSelected.length < 5) setForwardSelected([...forwardSelected, c.id]);
                                                else showToastMessage("Máximo de 5 contatos!", "error");
                                            } else {
                                                setForwardSelected(forwardSelected.filter(id => id !== c.id));
                                            }
                                        }}
                                    />
                                    <span className="font-medium truncate">{c.name}</span>
                                </label>
                            ))}
                        </div>
                        <div className="flex justify-between items-center mt-2 pt-4 border-t">
                            <button onClick={() => { setForwardMsg(null); setForwardSelected([]); }} className="text-gray-500 font-bold px-4 py-2">Cancelar</button>
                            <button 
                                onClick={handleForwardSend}
                                disabled={forwardSelected.length === 0}
                                className={`px-6 py-2 rounded-xl font-bold text-white transition-colors shadow-lg ${forwardSelected.length > 0 ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-gray-300'}`}
                            >
                                Enviar
                            </button>
                        </div>
                    </div>
                </div>
            )}
            <div className="w-full md:w-1/3 md:max-w-sm border-r flex flex-col bg-gray-50 h-full">
                <div className="p-4 flex justify-between items-center border-b bg-white">
                    <div className="flex items-center gap-3">
                        <div className="relative">
                            {user.avatar ? (
                                <img 
                                    src={user.avatar} 
                                    alt="Perfil" 
                                    onClick={() => { setEditUsername(allUsersData[user.id]?.username || ""); setShowUserProfileCard(true); }}
                                    className="w-10 h-10 rounded-full object-cover cursor-pointer border border-gray-200 shadow-sm hover:scale-105 transition-transform"
                                />
                            ) : (
                                <div onClick={() => { setEditUsername(allUsersData[user.id]?.username || ""); setShowUserProfileCard(true); }} className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center cursor-pointer border border-indigo-200 hover:scale-105 transition-transform">
                                    <div className="icon-user text-xl text-indigo-600"></div>
                                </div>
                            )}
                            <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></div>
                        </div>
                        <button data-tutorial="main-menu" onClick={() => setContextMenu({ x: 50, y: 50, type: 'mainMenu' })} className="p-1 hover:bg-gray-100 rounded">
                            <div className="icon-ellipsis-vertical text-xl text-gray-600"></div>
                        </button>
                        <h2 className="text-xl font-bold text-gray-800 hidden sm:block">Mensagens</h2>
                    </div>
                    <div className="flex gap-2 items-center">
                        {window.DeviceSyncStatus && <window.DeviceSyncStatus />}
                        <button onClick={() => {
                            if (window.OneSignalDeferred) {
                                window.OneSignalDeferred.push(function(OneSignal) {
                                    setIsSubscribed(OneSignal.User.PushSubscription.optedIn);
                                });
                            }
                            setShowNotificationSettings(true);
                        }} className={`p-1 rounded text-xs font-bold transition-colors ${isSubscribed ? 'text-green-500 hover:bg-green-50' : 'text-blue-500 hover:bg-blue-50'}`} title="Configurações de Notificação">
                            <div className={`icon-${isSubscribed ? 'bell-ring' : 'bell'} text-lg`}></div>
                        </button>
                        <button onClick={onLogout} className="text-sm text-red-500 hover:text-red-700 font-medium">Sair</button>
                    </div>
                </div>

                <div className="flex bg-white shadow-sm z-10 relative overflow-x-auto no-scrollbar">
                    <button data-tutorial="chats-tab" onClick={() => setActiveTab('chats')} className={`flex-none px-4 py-3 text-sm font-bold border-b-[3px] transition-colors flex items-center gap-2 ${activeTab === 'chats' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-400 hover:text-gray-600'}`}>
                        <div className="icon-message-circle"></div> Chats
                    </button>
                    <button data-tutorial="pulse-tab" onClick={() => window.location.href = 'updates.html'} className={`flex-none px-4 py-3 text-sm font-bold border-b-[3px] transition-colors flex items-center gap-2 border-transparent text-gray-400 hover:text-indigo-600 group`}>
                        <div className="relative">
                            <div className="icon-loader text-lg group-hover:rotate-180 transition-transform duration-500"></div>
                            <div className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full animate-ping"></div>
                        </div>
                        Pulse
                    </button>
                    <button onClick={() => setActiveTab('calls')} className={`flex-none px-4 py-3 text-sm font-bold border-b-[3px] transition-colors flex items-center gap-2 ${activeTab === 'calls' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-400 hover:text-gray-600'}`}>
                        <div className="icon-phone"></div> Ligações
                    </button>
                    <button onClick={() => setActiveTab('communities')} className={`flex-none px-4 py-3 text-sm font-bold border-b-[3px] transition-colors flex items-center gap-2 ${activeTab === 'communities' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-400 hover:text-gray-600'}`}>
                        <div className="icon-network"></div> Comunidades
                    </button>
                </div>

                {suggestions.length > 0 && (
                    <div className="bg-white border-b border-gray-100 shadow-sm z-0">
                        <div className="px-4 py-2 flex gap-4 overflow-x-auto no-scrollbar">
                            {suggestions.map(sug => (
                                <div key={sug.id} onClick={() => { setSearchUsername(sug.username); searchAndAddUser(); }} className="flex flex-col items-center min-w-[64px] cursor-pointer group shrink-0">
                                    <div className="relative p-[2px] rounded-full bg-gradient-to-tr from-amber-400 to-orange-500 mb-1">
                                        <div className="bg-white p-[2px] rounded-full">
                                            {allUsersData[sug.id]?.profilePicture ? (
                                                <img src={allUsersData[sug.id].profilePicture} className="w-12 h-12 rounded-full object-cover border border-gray-100" />
                                            ) : (
                                                <div className="w-12 h-12 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold text-lg">
                                                    {(sug.name || sug.username || '?').charAt(0).toUpperCase()}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <span className="text-[10px] text-gray-700 font-medium truncate w-full text-center group-hover:text-indigo-600 transition-colors">
                                        {sug.name ? sug.name.split(' ')[0] : (sug.username || 'User')}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                <div className="flex-1 overflow-y-auto bg-gray-50">
                    {activeTab === 'chats' && (
                        <div className="flex flex-col">
                            {chats.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-48 p-8 text-center text-gray-500">
                                    <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center mb-4">
                                        <div className="icon-message-circle text-2xl text-gray-400"></div>
                                    </div>
                                    <p className="font-medium text-gray-600">Nenhuma conversa encontrada</p>
                                </div>
                            ) : (
                                chats.map((chat) => {
                                    const blockedUsers = JSON.parse(localStorage.getItem('blockedUsers') || '[]');
                                    const isBlocked = blockedUsers.includes(chat.id);
                                    if(isBlocked) return null;

                                    return (
                                        <div key={chat.id} onClick={async () => {
                                            if (chat.type === 'community') {
                                                window.location.href = `community.html?commId=${chat.id}`;
                                            } else {
                                                // Create a deterministic aliasId based on user.id and chat.id
                                                let aliasId = window.CryptoJS 
                                                    ? window.CryptoJS.SHA256(user.id + "_" + chat.id).toString(window.CryptoJS.enc.Hex).substring(0, 16)
                                                    : btoa(user.id + "_" + chat.id).replace(/[^a-zA-Z0-9]/g, '').substring(0, 16);
                                                
                                                await db.ref(`users/${user.id}/chats/${chat.id}`).update({ aliasId });
                                                await db.ref(`chat_aliases/${aliasId}`).set({ realId: chat.id });
                                                
                                                window.location.href = `chat.html?c=${aliasId}`;
                                            }
                                        }} className="p-3 mx-2 my-1 bg-white rounded-xl border border-gray-100 cursor-pointer hover:bg-indigo-50 flex items-center gap-4 transition-all group shadow-sm relative">
                                            {JSON.parse(localStorage.getItem('lockedChats') || '{}')[chat.id] && <div className="absolute right-4 top-1/2 -translate-y-1/2 icon-lock text-gray-400"></div>}
                                            <div className="relative cursor-pointer hover:scale-105 transition-transform" onClick={(e) => { e.stopPropagation(); setQuickActionChat(chat); }}>
                                                {chat.type === 'community' ? (
                                                    <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-800 flex items-center justify-center text-white shadow-sm flex-shrink-0">
                                                        <div className="icon-network text-2xl"></div>
                                                    </div>
                                                ) : chat.type === 'direct' && (chat.avatar || allUsersData[chat.targetId || chat.id]?.profilePicture) ? (
                                                    <img src={chat.avatar || allUsersData[chat.targetId || chat.id].profilePicture} className="w-12 h-12 rounded-full object-cover shadow-sm flex-shrink-0 border border-gray-100" />
                                                ) : (
                                                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white font-bold text-lg shadow-sm flex-shrink-0">
                                                        {(chat.name || 'Chat').charAt(0).toUpperCase()}
                                                    </div>
                                                )}
                                                {chat.type === 'direct' && (
                                                    <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 border-2 border-white rounded-full pointer-events-none"></div>
                                                )}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex justify-between items-center mb-1">
                                                    <h3 className="font-bold text-gray-800 truncate group-hover:text-indigo-700 transition-colors">{chat.name}</h3>
                                                </div>
                                                <p className={`text-sm truncate ${chat.type === 'community' ? 'text-indigo-600 font-medium' : 'text-gray-500'}`}>
                                                    {renderLastMessage(chat)}
                                                </p>
                                            </div>
                                        </div>
                                    )
                                })
                            )}
                        </div>
                    )}

                    {activeTab === 'calls' && (
                        <div className="p-4 text-center">
                            <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-4">
                                <div className="icon-phone text-2xl text-gray-400"></div>
                            </div>
                            <p className="text-gray-500">O histórico de ligações aparecerá aqui.</p>
                        </div>
                    )}

                    {activeTab === 'communities' && (
                        <div className="flex flex-col">
                            <div className="p-4 bg-indigo-50 border-b border-indigo-100 mb-2">
                                <button onClick={() => window.location.href='community.html'} className="w-full p-3 bg-indigo-600 text-white rounded-xl font-bold flex items-center justify-center gap-2 shadow-md hover:bg-indigo-700">
                                    <div className="icon-network"></div> Acessar Painel de Comunidades
                                </button>
                                <p className="text-xs text-center text-indigo-600 mt-2 font-medium">Crie ou acesse suas comunidades aqui</p>
                            </div>
                            
                            {communitiesList.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-48 p-8 text-center text-gray-500">
                                    <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center mb-4">
                                        <div className="icon-network text-2xl text-gray-400"></div>
                                    </div>
                                    <p className="font-medium text-gray-600">Nenhuma comunidade</p>
                                </div>
                            ) : (
                                communitiesList.map((comm) => (
                                    <div key={comm.id} onClick={() => window.location.href = `community.html?commId=${comm.id}`} className="p-3 mx-2 my-1 bg-white rounded-xl border border-gray-100 cursor-pointer hover:bg-indigo-50 flex items-center gap-4 transition-all group shadow-sm">
                                        <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-800 flex items-center justify-center text-white shadow-sm flex-shrink-0">
                                            <div className="icon-network text-2xl"></div>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h3 className="font-bold text-gray-800 truncate group-hover:text-indigo-700 transition-colors">{comm.name}</h3>
                                            <p className="text-sm text-indigo-600 font-medium">Comunidade</p>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    )}


                </div>
            </div>
            
            <div className="flex-1 flex flex-col items-center justify-center text-gray-400 bg-gray-50 hidden md:flex">
                <div className="w-24 h-24 bg-gray-200 rounded-full flex items-center justify-center mb-6 shadow-inner">
                    <div className="icon-messages-square text-5xl text-gray-400"></div>
                </div>
                <h2 className="text-2xl font-bold text-gray-600 mb-2">Bem-vindo ao CodeHUB App</h2>
                <p className="text-center max-w-md">Selecione uma conversa ao lado para abrir a tela de chat.</p>
            </div>

            {/* Call State UI is now moved to call.html */}

            {showAddContact && (
                <div className="fixed inset-0 bg-gray-900 bg-opacity-50 backdrop-blur-sm flex items-center justify-center z-40 p-4">
                    <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm transform transition-all">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold text-gray-800">Adicionar Contato</h3>
                            <button onClick={() => setShowAddContact(false)} className="text-gray-400 hover:text-gray-600">
                                <div className="icon-x text-xl"></div>
                            </button>
                        </div>
                        <div className="relative mb-6">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">@</span>
                            <input 
                                type="text" 
                                placeholder="username" 
                                value={searchUsername}
                                onChange={e => setSearchUsername(e.target.value)}
                                className="w-full pl-8 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                            />
                        </div>
                        <button onClick={searchAndAddUser} className="w-full py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 font-semibold transition-colors">
                            Buscar e Adicionar
                        </button>
                    </div>
                </div>
            )}

            {showNotificationSettings && (
                <div className="fixed inset-0 bg-gray-900 bg-opacity-50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm transform transition-all">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                                <div className="icon-bell text-indigo-600"></div> Notificações
                            </h3>
                            <button onClick={() => setShowNotificationSettings(false)} className="text-gray-400 hover:text-gray-600">
                                <div className="icon-x text-xl"></div>
                            </button>
                        </div>
                        
                        <div className="text-center mb-6">
                            <div className={`w-16 h-16 rounded-full mx-auto flex items-center justify-center mb-4 ${isSubscribed ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-500'}`}>
                                <div className={`icon-${isSubscribed ? 'bell-ring' : 'bell-off'} text-3xl`}></div>
                            </div>
                            <p className="text-gray-600">
                                Status: <span className={`font-bold ${isSubscribed ? 'text-green-600' : 'text-gray-500'}`}>{isSubscribed ? 'Ativado' : 'Desativado'}</span>
                            </p>
                        </div>

                        <div className="space-y-3">
                            <button 
                                onClick={() => {
                                    if (window.OneSignalDeferred) {
                                        window.OneSignalDeferred.push(async function(OneSignal) {
                                            try {
                                                await OneSignal.Slidedown.promptPush();
                                                await OneSignal.User.PushSubscription.optIn();
                                                setIsSubscribed(OneSignal.User.PushSubscription.optedIn);
                                                showToastMessage("Solicitação enviada!", "success");
                                            } catch(e) {
                                                showToastMessage("Erro ao ativar.", "error");
                                            }
                                        });
                                    } else {
                                        showToastMessage("OneSignal não carregado", "error");
                                    }
                                }} 
                                disabled={isSubscribed}
                                className={`w-full py-3 rounded-xl font-semibold transition-colors flex items-center justify-center gap-2 ${isSubscribed ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'bg-indigo-600 text-white hover:bg-indigo-700'}`}
                            >
                                <div className="icon-check"></div> Permitir
                            </button>
                            
                            <button 
                                onClick={() => {
                                    if (window.OneSignalDeferred) {
                                        window.OneSignalDeferred.push(async function(OneSignal) {
                                            try {
                                                await OneSignal.User.PushSubscription.optOut();
                                                setIsSubscribed(false);
                                                showToastMessage("Notificações desativadas", "info");
                                            } catch(e) {
                                                showToastMessage("Erro ao desativar", "error");
                                            }
                                        });
                                    }
                                }} 
                                disabled={!isSubscribed}
                                className={`w-full py-3 rounded-xl font-semibold transition-colors flex items-center justify-center gap-2 ${!isSubscribed ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'bg-red-100 text-red-600 hover:bg-red-200'}`}
                            >
                                <div className="icon-x"></div> Desativar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showCreateGroup && (
                <div className="fixed inset-0 bg-gray-900 bg-opacity-50 backdrop-blur-sm flex items-center justify-center z-40 p-4">
                    <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md transform transition-all">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold text-gray-800">Novo Grupo</h3>
                            <button onClick={() => setShowCreateGroup(false)} className="text-gray-400 hover:text-gray-600">
                                <div className="icon-x text-xl"></div>
                            </button>
                        </div>
                        
                        <div className="space-y-4 mb-6">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Nome do Grupo</label>
                                <input 
                                    type="text" 
                                    placeholder="Ex: Amigos, Trabalho..." 
                                    value={newGroupName}
                                    onChange={e => setNewGroupName(e.target.value)}
                                    className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                                />
                            </div>
                            
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Participantes</label>
                                <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-xl p-2 bg-gray-50 space-y-1">
                                    {chats.filter(c => c.type === 'direct').length === 0 ? (
                                        <p className="text-sm text-gray-500 text-center py-4">Adicione contatos primeiro</p>
                                    ) : (
                                        chats.filter(c => c.type === 'direct').map(c => (
                                            <label key={c.id} className="flex items-center gap-3 p-3 hover:bg-white rounded-lg cursor-pointer transition-colors border border-transparent hover:border-gray-200 hover:shadow-sm">
                                                <input 
                                                    type="checkbox" 
                                                    className="w-5 h-5 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
                                                    checked={selectedUsersForGroup.includes(c.id)}
                                                    onChange={e => {
                                                        if (e.target.checked) setSelectedUsersForGroup([...selectedUsersForGroup, c.id]);
                                                        else setSelectedUsersForGroup(selectedUsersForGroup.filter(id => id !== c.id));
                                                    }}
                                                />
                                                <span className="font-medium text-gray-700">{c.name}</span>
                                            </label>
                                        ))
                                    )}
                                </div>
                            </div>
                        </div>

                        <button onClick={createGroup} className="w-full py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 font-semibold transition-colors">
                            Criar Grupo
                        </button>
                    </div>
                </div>
            )}

            {contextMenu && contextMenu.type === 'mainMenu' && (
                <>
                    <div className="fixed inset-0 z-40" onClick={() => setContextMenu(null)}></div>
                    <div className="fixed bg-white/90 backdrop-blur-md border border-gray-200 shadow-2xl rounded-2xl py-2 w-64 z-50 overflow-hidden text-sm" style={{ top: contextMenu.y, left: contextMenu.x }}>
                        <button onClick={() => { setShowAddContact(true); setContextMenu(null); }} className="w-full text-left px-4 py-2.5 hover:bg-indigo-50 flex items-center gap-3 text-gray-700 font-medium transition-colors">
                            <div className="icon-user-plus text-indigo-500 text-lg"></div> Adicionar Contato
                        </button>
                        <button onClick={() => { setShowCreateGroup(true); setContextMenu(null); }} className="w-full text-left px-4 py-2.5 hover:bg-indigo-50 flex items-center gap-3 text-gray-700 font-medium transition-colors">
                            <div className="icon-users text-indigo-500 text-lg"></div> Criar Grupo
                        </button>
                        <button onClick={() => { window.location.href='community.html'; setContextMenu(null); }} className="w-full text-left px-4 py-2.5 hover:bg-indigo-50 flex items-center gap-3 text-gray-700 font-medium transition-colors">
                            <div className="icon-network text-indigo-500 text-lg"></div> Comunidades
                        </button>
                        <button onClick={() => { window.location.href='bots.html'; setContextMenu(null); }} className="w-full text-left px-4 py-2.5 hover:bg-indigo-50 flex items-center gap-3 text-gray-700 font-medium transition-colors">
                            <div className="icon-bot text-indigo-500 text-lg"></div> Gerenciar Bots
                        </button>
                        <div className="h-px bg-gray-100 my-1"></div>
                        <button onClick={() => { setShowSettingsMenu(true); setContextMenu(null); }} className="w-full text-left px-4 py-2.5 hover:bg-indigo-50 flex items-center gap-3 text-gray-700 font-medium transition-colors">
                            <div className="icon-settings text-gray-500 text-lg"></div> Configurações Avançadas
                        </button>
                        <button onClick={async () => { 
                            alert("Abra o chat específico ou clique em um chat recente para bloqueá-lo com biometria.");
                            setContextMenu(null);
                        }} className="w-full text-left px-4 py-2.5 hover:bg-indigo-50 flex items-center gap-3 text-gray-700 font-medium transition-colors">
                            <div className="icon-lock text-gray-500 text-lg"></div> Bloquear Chat (Biometria)
                        </button>
                        <button onClick={onLogout} className="w-full text-left px-4 py-2.5 hover:bg-red-50 flex items-center gap-3 text-red-600 font-medium transition-colors">
                            <div className="icon-log-out text-lg"></div> Sair
                        </button>
                    </div>
                </>
            )}

            {showUserProfileCard && (
                <div className="fixed inset-0 bg-gray-900 bg-opacity-50 backdrop-blur-sm flex items-center justify-center z-[100] p-4" onClick={() => setShowUserProfileCard(false)}>
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-fade-in-up" onClick={e => e.stopPropagation()}>
                        <div className="bg-gradient-to-r from-indigo-500 to-purple-600 h-32 relative">
                            <button onClick={() => setShowUserProfileCard(false)} className="absolute top-4 right-4 text-white hover:bg-white/20 p-1 rounded-full">
                                <div className="icon-x text-xl"></div>
                            </button>
                        </div>
                        <div className="px-6 pb-6 relative">
                            <div className="w-32 h-32 rounded-full border-4 border-white bg-white absolute -top-16 right-6 shadow-md overflow-hidden">
                                {user.avatar ? (
                                    <img src={user.avatar} className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full bg-indigo-100 flex items-center justify-center text-indigo-600"><div className="icon-user text-5xl"></div></div>
                                )}
                            </div>
                            <div className="mt-20">
                                <div className="mb-4">
                                    <h2 className="text-2xl font-bold text-gray-800">{user.name}</h2>
                                    <p className="text-gray-500 text-sm">Nascimento: {allUsersData[user.id]?.birthdate ? new Date(allUsersData[user.id].birthdate).toLocaleDateString('pt-BR') : 'Não informado'}</p>
                                </div>
                                
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 mb-1">Nome de usuário (@)</label>
                                        <div className="relative">
                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">@</span>
                                            <input 
                                                type="text" 
                                                value={editUsername}
                                                onChange={e => setEditUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))}
                                                className="w-full pl-8 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-gray-800"
                                            />
                                        </div>
                                    </div>
                                    <button onClick={async () => {
                                        const BAD_WORDS = ["palavrao", "admin", "root", "suporte", "puta", "merda", "caralho", "foda"];
                                        const validateUsernameFormat = (u) => {
                                            if (!u || u.length < 6) return "O @arroba deve ter no mínimo 6 caracteres.";
                                            if (u.includes('@')) return "O @arroba não deve conter o caractere @ duplicado.";
                                            if (/[^a-zA-Z0-9_]/i.test(u)) return "O @arroba só pode conter letras, números e underline (_).";
                                            if (!/\d/.test(u)) return "O @arroba deve conter pelo menos um número.";
                                            if (!/[A-Z]/.test(u)) return "O @arroba deve conter pelo menos uma letra maiúscula.";
                                            for (let i = 0; i < u.length - 2; i++) {
                                                const c1 = u.charCodeAt(i);
                                                const c2 = u.charCodeAt(i+1);
                                                const c3 = u.charCodeAt(i+2);
                                                if (c1 >= 48 && c1 <= 57 && c2 === c1 + 1 && c3 === c2 + 1) {
                                                    return "O @arroba não pode conter sequências numéricas (ex: 123).";
                                                }
                                            }
                                            const lowerUser = u.toLowerCase();
                                            for (const badWord of BAD_WORDS) {
                                              if (lowerUser.includes(badWord)) return "Este @arroba contém palavras não permitidas.";
                                            }
                                            return null;
                                        };

                                        const newU = editUsername.trim();
                                        const validationError = validateUsernameFormat(newU);
                                        if (validationError) {
                                            showToastMessage(validationError, "error");
                                            return;
                                        }

                                        const lowerNewU = newU.toLowerCase();
                                        if(lowerNewU === allUsersData[user.id]?.username) return setShowUserProfileCard(false);
                                        const snap = await db.ref('users').orderByChild('username').equalTo(lowerNewU).once('value');
                                        if(snap.exists() && Object.keys(snap.val())[0] !== user.id) {
                                            showToastMessage("Arroba já em uso!", "error");
                                            return;
                                        }
                                        await db.ref(`users/${user.id}`).update({username: lowerNewU});
                                        showToastMessage("Arroba atualizado!", "success");
                                        setShowUserProfileCard(false);
                                    }} className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-colors">
                                        Salvar Alterações
                                    </button>
                                    
                                    <button onClick={() => {
                                        const link = `${window.location.origin}${window.location.pathname.replace('index.html','')}` + `index.html?addUser=${user.id}`;
                                        navigator.clipboard.writeText(link);
                                        showToastMessage("Link do seu perfil copiado com sucesso!", "success");
                                    }} className="w-full py-2.5 bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 font-bold rounded-xl transition-colors flex items-center justify-center gap-2">
                                        <div className="icon-share-2"></div> Compartilhar Meu Perfil
                                    </button>

                                    <button onClick={() => { setShowUserProfileCard(false); setShowFeaturedModal(true); }} className="w-full py-2.5 bg-yellow-50 text-yellow-700 border border-yellow-200 hover:bg-yellow-100 font-bold rounded-xl transition-colors flex items-center justify-center gap-2 mt-2">
                                        <div className="icon-star"></div> Destacar Meu Perfil
                                    </button>

                                    <div className="pt-4 mt-2 border-t border-gray-100">
                                        <button 
                                            onClick={() => window.location.href = 'credits.html'}
                                            className="w-full py-3 bg-amber-100 hover:bg-amber-200 text-amber-800 font-bold rounded-xl transition-colors flex items-center justify-center gap-2 shadow-sm"
                                        >
                                            <div className="icon-coins text-xl"></div>
                                            <span>Meus Créditos: {allUsersData[user.id]?.credits || 0}</span>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {showFeaturedModal && (
                <div className="fixed inset-0 bg-gray-900 bg-opacity-50 backdrop-blur-sm flex items-center justify-center z-[100] p-4" onClick={() => setShowFeaturedModal(false)}>
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden animate-fade-in-up" onClick={e => e.stopPropagation()}>
                        <div className="px-6 py-6 relative">
                            <button onClick={() => setShowFeaturedModal(false)} className="absolute top-4 right-4 text-gray-400 hover:bg-gray-100 p-1 rounded-full">
                                <div className="icon-x text-xl"></div>
                            </button>
                            <h2 className="text-xl font-bold text-gray-800 mb-2 flex items-center gap-2">
                                <div className="icon-star text-yellow-500"></div> Destacar Perfil
                            </h2>
                            <p className="text-gray-600 text-sm mb-4">Seu perfil aparecerá globalmente na aba de Destacados.</p>
                            
                            <div className="bg-gray-50 p-4 rounded-xl mb-4 border border-gray-100">
                                <p className="text-sm text-gray-500 font-medium mb-1">Seus Créditos:</p>
                                <div className="text-2xl font-bold text-indigo-600 flex items-center gap-2">
                                    <div className="icon-coins text-yellow-500"></div> {allUsersData[user.id]?.credits || 0}
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2">Tempo de destaque (Horas)</label>
                                    <div className="flex items-center gap-3">
                                        <button onClick={() => setFeaturedHours(Math.max(1, featuredHours - 1))} className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200">
                                            <div className="icon-minus"></div>
                                        </button>
                                        <span className="flex-1 text-center font-bold text-xl">{featuredHours}h</span>
                                        <button onClick={() => setFeaturedHours(featuredHours + 1)} className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200">
                                            <div className="icon-plus"></div>
                                        </button>
                                    </div>
                                </div>
                                <div className="bg-yellow-50 text-yellow-800 p-3 rounded-xl border border-yellow-200 text-sm font-medium text-center">
                                    Custo total: {featuredHours * 100} créditos
                                </div>
                                <button onClick={async () => {
                                    const cost = featuredHours * 100;
                                    const currentCredits = allUsersData[user.id]?.credits || 0;
                                    
                                    if (currentCredits < cost) {
                                        showToastMessage("Créditos insuficientes!", "error");
                                        return;
                                    }
                                    
                                    const now = Date.now();
                                    const currentFeaturedUntil = allUsersData[user.id]?.featuredUntil || now;
                                    const baseTime = currentFeaturedUntil > now ? currentFeaturedUntil : now;
                                    const newFeaturedUntil = baseTime + (featuredHours * 3600000);
                                    
                                    try {
                                        await db.ref(`users/${user.id}`).update({
                                            credits: currentCredits - cost,
                                            isFeatured: true,
                                            featuredUntil: newFeaturedUntil
                                        });
                                        showToastMessage(`Perfil destacado por ${featuredHours}h!`, "success");
                                        setShowFeaturedModal(false);
                                    } catch (e) {
                                        showToastMessage("Erro ao destacar perfil", "error");
                                    }
                                }} className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-colors">
                                    Confirmar Pagamento
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {quickActionChat && (
                <div className="fixed inset-0 bg-gray-900 bg-opacity-50 backdrop-blur-sm z-[100] flex items-center justify-center p-4" onClick={() => setQuickActionChat(null)}>
                    <div className="bg-white rounded-3xl shadow-2xl w-64 overflow-hidden animate-fade-in-up border border-gray-100" onClick={e => e.stopPropagation()}>
                        <div className="w-full h-64 bg-gray-100 relative group cursor-pointer" onClick={async () => { 
                            if (quickActionChat.type === 'community') {
                                window.location.href = `community.html?commId=${quickActionChat.id}`;
                            } else {
                                let aliasId = window.CryptoJS 
                                    ? window.CryptoJS.SHA256(user.id + "_" + quickActionChat.id).toString(window.CryptoJS.enc.Hex).substring(0, 16)
                                    : btoa(user.id + "_" + quickActionChat.id).replace(/[^a-zA-Z0-9]/g, '').substring(0, 16);
                                
                                await db.ref(`users/${user.id}/chats/${quickActionChat.id}`).update({ aliasId });
                                await db.ref(`chat_aliases/${aliasId}`).set({ realId: quickActionChat.id });
                                window.location.href = `chat.html?c=${aliasId}`;
                            }
                        }}>
                            {quickActionChat.type === 'community' ? (
                                <div className="w-full h-full bg-gradient-to-br from-blue-600 to-indigo-800 flex items-center justify-center text-white">
                                    <div className="icon-network text-6xl"></div>
                                </div>
                            ) : quickActionChat.type === 'direct' && (quickActionChat.avatar || allUsersData[quickActionChat.targetId || quickActionChat.id]?.profilePicture) ? (
                                <img src={quickActionChat.avatar || allUsersData[quickActionChat.targetId || quickActionChat.id].profilePicture} className="w-full h-full object-cover" />
                            ) : (
                                <div className="w-full h-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white font-bold text-6xl">
                                    {(quickActionChat.name || 'Chat').charAt(0).toUpperCase()}
                                </div>
                            )}
                            <div className="absolute top-0 left-0 w-full p-4 bg-gradient-to-b from-black/60 to-transparent pointer-events-none">
                                <h3 className="text-white font-bold text-lg drop-shadow-md">{quickActionChat.name}</h3>
                            </div>
                        </div>
                        <div className="flex justify-around items-center p-4 bg-white border-t border-gray-50">
                            <button onClick={async () => { 
                                if (quickActionChat.type === 'community') {
                                    window.location.href = `community.html?commId=${quickActionChat.id}`;
                                } else {
                                    let aliasId = window.CryptoJS 
                                        ? window.CryptoJS.SHA256(user.id + "_" + quickActionChat.id).toString(window.CryptoJS.enc.Hex).substring(0, 16)
                                        : btoa(user.id + "_" + quickActionChat.id).replace(/[^a-zA-Z0-9]/g, '').substring(0, 16);
                                    
                                    await db.ref(`users/${user.id}/chats/${quickActionChat.id}`).update({ aliasId });
                                    await db.ref(`chat_aliases/${aliasId}`).set({ realId: quickActionChat.id });
                                    window.location.href = `chat.html?c=${aliasId}`;
                                }
                            }} className="w-12 h-12 flex items-center justify-center rounded-full hover:bg-indigo-50 text-indigo-600 transition-colors" title="Conversar">
                                <div className="icon-message-circle text-2xl"></div>
                            </button>
                            {quickActionChat.type !== 'community' && (
                                <>
                                    <button onClick={async () => {
                                        try {
                                            const locked = JSON.parse(localStorage.getItem('lockedChats') || '{}');
                                            const lockData = locked[quickActionChat.id];
                                            const isCurrentlyLocked = lockData === true || (lockData && lockData.enabled);

                                            if (isCurrentlyLocked) {
                                                // Destrancar
                                                if (window.PublicKeyCredential && lockData.credentialId) {
                                                    const challenge = new Uint8Array(32);
                                                    window.crypto.getRandomValues(challenge);
                                                    await navigator.credentials.get({
                                                        publicKey: {
                                                            challenge: challenge,
                                                            allowCredentials: [{
                                                                type: "public-key",
                                                                id: new Uint8Array(lockData.credentialId),
                                                                transports: ["internal", "hybrid"]
                                                            }],
                                                            timeout: 60000,
                                                            userVerification: "required"
                                                        }
                                                    });
                                                }
                                                delete locked[quickActionChat.id];
                                                localStorage.setItem('lockedChats', JSON.stringify(locked));
                                                db.ref(`users/${user.id}/lockedChats/${quickActionChat.id}`).remove();
                                                showToastMessage("Chat desbloqueado com sucesso!", "success");
                                            } else {
                                                // Trancar
                                                if (!window.PublicKeyCredential) {
                                                    locked[quickActionChat.id] = true;
                                                    localStorage.setItem('lockedChats', JSON.stringify(locked));
                                                    db.ref(`users/${user.id}/lockedChats/${quickActionChat.id}`).set(true);
                                                    showToastMessage("Chat bloqueado sem biometria (não suportada).", "success");
                                                } else {
                                                    const challenge = new Uint8Array(32);
                                                    window.crypto.getRandomValues(challenge);
                                                    const userId = new Uint8Array(16);
                                                    window.crypto.getRandomValues(userId);

                                                    const credential = await navigator.credentials.create({
                                                        publicKey: {
                                                            challenge: challenge,
                                                            rp: { name: "Phantora", id: window.location.hostname || "localhost" },
                                                            user: { id: userId, name: user?.name || "Usuario", displayName: user?.name || "Usuario" },
                                                            pubKeyCredParams: [{ type: "public-key", alg: -7 }, { type: "public-key", alg: -257 }],
                                                            authenticatorSelection: { authenticatorAttachment: "platform", userVerification: "required" },
                                                            timeout: 60000
                                                        }
                                                    });
                                                    
                                                    if (credential) {
                                                        const credentialIdArray = Array.from(new Uint8Array(credential.rawId));
                                                        locked[quickActionChat.id] = { enabled: true, credentialId: credentialIdArray };
                                                        localStorage.setItem('lockedChats', JSON.stringify(locked));
                                                        db.ref(`users/${user.id}/lockedChats/${quickActionChat.id}`).set(true);
                                                        showToastMessage("Chave de acesso criada e chat bloqueado com sucesso!", "success");
                                                    } else {
                                                        throw new Error("Falha ao criar credencial.");
                                                    }
                                                }
                                            }
                                            setQuickActionChat(null);
                                        } catch (err) {
                                            showToastMessage("Falha ao autenticar biometria.", "error");
                                        }
                                    }} className="w-12 h-12 flex items-center justify-center rounded-full hover:bg-indigo-50 text-indigo-600 transition-colors" title={JSON.parse(localStorage.getItem('lockedChats') || '{}')[quickActionChat.id] ? "Desbloquear" : "Bloquear com Biometria"}>
                                        <div className={JSON.parse(localStorage.getItem('lockedChats') || '{}')[quickActionChat.id] ? "icon-unlock text-2xl" : "icon-lock text-2xl"}></div>
                                    </button>
                                    <button onClick={() => startCallForChat(quickActionChat, false)} className="w-12 h-12 flex items-center justify-center rounded-full hover:bg-indigo-50 text-indigo-600 transition-colors" title="Chamada de Voz">
                                        <div className="icon-phone text-2xl"></div>
                                    </button>
                                    <button onClick={() => startCallForChat(quickActionChat, true)} className="w-12 h-12 flex items-center justify-center rounded-full hover:bg-indigo-50 text-indigo-600 transition-colors" title="Chamada de Vídeo">
                                        <div className="icon-video text-2xl"></div>
                                    </button>
                                    <button onClick={() => window.location.href = `info.html?chatId=${quickActionChat.id}`} className="w-12 h-12 flex items-center justify-center rounded-full hover:bg-indigo-50 text-indigo-600 transition-colors" title="Informações">
                                        <div className="icon-info text-2xl"></div>
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}

            <SettingsMenu isOpen={showSettingsMenu} onClose={() => setShowSettingsMenu(false)} />

            {/* Barra Inferior (Bottom Bar) com botão Social */}
            <div className="md:hidden fixed bottom-0 left-0 w-full bg-white border-t border-gray-200 flex items-center justify-around py-2 pb-safe shadow-[0_-2px_10px_rgba(0,0,0,0.05)] z-30">
                <button onClick={() => {
                    window.location.href = 'social.html';
                }} className="flex flex-col items-center p-2 text-gray-500 hover:text-indigo-600 transition-colors">
                    <div className="icon-layout-grid text-2xl"></div>
                    <span className="text-[10px] font-bold mt-1">Social</span>
                </button>

                <button onClick={() => {
                    window.location.href = 'social.html';
                }} className="flex flex-col items-center justify-center w-14 h-14 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-full shadow-lg text-white transform -translate-y-4 hover:scale-105 transition-transform border-4 border-white">
                    <div className="icon-plus text-3xl"></div>
                </button>

                <button onClick={() => { window.location.href = 'credits.html'; }} className="flex flex-col items-center p-2 text-amber-500 hover:text-amber-600 transition-colors">
                    <div className="icon-coins text-2xl"></div>
                    <span className="text-[10px] font-bold mt-1">Créditos</span>
                </button>
            </div>

            {/* Desktop Float Button for Social */}
            <div className="hidden md:flex fixed bottom-6 left-6 z-30 gap-4">
                 <button onClick={() => {
                    window.location.href = 'social.html';
                }} className="flex items-center gap-2 bg-white text-indigo-600 px-4 py-3 rounded-full shadow-lg hover:bg-indigo-50 font-bold border border-indigo-100 transition-all">
                    <div className="icon-sparkles"></div> Rede Social
                </button>
            </div>

            {tvAuthRequests.length > 0 && (
                <div className="fixed inset-0 bg-gray-900 bg-opacity-50 backdrop-blur-sm z-[150] flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden p-6 text-center animate-fade-in-up">
                        <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <div className="icon-tv text-3xl text-indigo-600"></div>
                        </div>
                        <h3 className="text-xl font-bold text-gray-800 mb-2">Solicitação de Acesso (TV)</h3>
                        <p className="text-gray-600 mb-6">Uma TV está solicitando acesso a um chat trancado. Deseja permitir e autenticar?</p>
                        <div className="flex gap-3">
                            <button onClick={() => handleTvAuthRequest(tvAuthRequests[0], false)} className="flex-1 py-3 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition-colors">Negar</button>
                            <button onClick={() => handleTvAuthRequest(tvAuthRequests[0], true)} className="flex-1 py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-colors">Autenticar e Permitir</button>
                        </div>
                    </div>
                </div>
            )}

            {toastMessage && (
                <div className={`fixed bottom-20 right-4 md:bottom-4 p-4 rounded-xl shadow-2xl text-white font-medium z-[60] flex items-center gap-2 transform transition-all animate-fade-in-up ${toastMessage.type === 'error' ? 'bg-red-500' : 'bg-gray-800'}`}>
                    <div className={`icon-${toastMessage.type === 'error' ? 'alert-circle' : 'check-circle'} text-xl`}></div>
                    {toastMessage.message}
                </div>
            )}
        </div>
    );
}

window.ChatInterface = ChatInterface;