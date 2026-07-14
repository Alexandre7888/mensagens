function ChatRoom({ user, chat }) {
    const db = window.firebaseDB;
    const messagesEndRef = React.useRef(null);
    const scrollContainerRef = React.useRef(null);
    
    const [messages, setMessages] = React.useState([]);
    const [messageInput, setMessageInput] = React.useState("");
    const [recording, setRecording] = React.useState(false);
    const [toastMessage, setToastMessage] = React.useState(null);
    const [editingMessage, setEditingMessage] = React.useState(null);
    const [replyingTo, setReplyingTo] = React.useState(null);
    
    // UI States
    const [showEmojiPicker, setShowEmojiPicker] = React.useState(false);
    const [showGifPicker, setShowGifPicker] = React.useState(false);
    const [showAttachMenu, setShowAttachMenu] = React.useState(false);
    const [showCamera, setShowCamera] = React.useState(false);
    const emojiPickerRef = React.useRef(null);
    
    // Selection state
    const [selectionMode, setSelectionMode] = React.useState(false);
    const [contextMenu, setContextMenu] = React.useState(null);
    const [selectedMessages, setSelectedMessages] = React.useState([]);
    const [localDeletedIds, setLocalDeletedIds] = React.useState([]);

    // Admin & Group state
    const [isAdmin, setIsAdmin] = React.useState(false);
    const [myRoleName, setMyRoleName] = React.useState('membro');
    const [cargosData, setCargosData] = React.useState(null);

    // Pull to refresh & Ephemeral
    const [ephemeralMode, setEphemeralMode] = React.useState(false);
    const [targetOnline, setTargetOnline] = React.useState(false);
    const [pullY, setPullY] = React.useState(0);
    const [isLocked, setIsLocked] = React.useState(false);
    const [unlockPin, setUnlockPin] = React.useState("");

    React.useEffect(() => {
        const lockedChats = JSON.parse(localStorage.getItem('lockedChats') || '{}');
        if (lockedChats[chat.id]) {
            setIsLocked(true);
        }
    }, [chat.id]);

    const handleUnlock = () => {
        const lockedChats = JSON.parse(localStorage.getItem('lockedChats') || '{}');
        if (lockedChats[chat.id] === unlockPin) {
            setIsLocked(false);
        } else {
            alert("Senha incorreta");
        }
    };
    const [isPulling, setIsPulling] = React.useState(false);
    const [pullProgress, setPullProgress] = React.useState(0);
    const [showScrollBottom, setShowScrollBottom] = React.useState(false);
    const [typingUsers, setTypingUsers] = React.useState({});
    
    const [appSettings, setAppSettings] = React.useState(window.SettingsManager ? window.SettingsManager.getSettings() : { theme: 'claro', bubbleStyle: 'arredondado', animations: 'nenhuma' });
    
    const mediaRecorder = React.useRef(null);
    const audioChunks = React.useRef([]);
    const fileInputRef = React.useRef(null);
    const isRecordingRef = React.useRef(false);
    const pressTimer = React.useRef(null);
    const secretTimer = React.useRef(null);
    const touchStartY = React.useRef(0);

    const getTargetId = () => chat.targetId || chat.id.replace(user.id, '').replace('_', '');
    
    const getSharedChatId = () => {
        if (chat.type === 'group') return chat.id;
        return [user.id, getTargetId()].sort().join('_');
    };

    const sharedChatId = getSharedChatId();
    
    // Para grupos lê/escreve no mesmo lugar. Para direto: lê do meu nó, escreve no nó do alvo.
    const listenPath = chat.type === 'group' ? `groups/${chat.id}/messages` : `chats/${user.id}`;
    const writePath = chat.type === 'group' ? `groups/${chat.id}/messages` : `chats/${getTargetId()}`;
    const encryptionKey = sharedChatId;

    const showToast = (message, type = "info") => {
        setToastMessage({ message, type });
        setTimeout(() => setToastMessage(null), 3000);
    };

    React.useEffect(() => {
        if (emojiPickerRef.current) {
            const handleEmoji = (e) => setMessageInput(prev => prev + e.detail.unicode);
            emojiPickerRef.current.addEventListener('emoji-click', handleEmoji);
            return () => emojiPickerRef.current?.removeEventListener('emoji-click', handleEmoji);
        }
    }, [showEmojiPicker]);

    React.useEffect(() => {
        const handleSettings = (e) => setAppSettings(e.detail);
        window.addEventListener('settingsChanged', handleSettings);
        return () => window.removeEventListener('settingsChanged', handleSettings);
    }, []);

    // Load Local States & Roles
    React.useEffect(() => {
        const deleted = localStorage.getItem(`deleted_${chat.id}`);
        if (deleted) setLocalDeletedIds(JSON.parse(deleted));
        
        const eph = localStorage.getItem(`ephemeral_${chat.id}`);
        if (eph === 'true') setEphemeralMode(true);

        if (chat.type === 'group' && db) {
            db.ref(`groups/${chat.id}`).on('value', snap => {
                const gData = snap.val();
                if (gData) {
                    const fetchPath = gData.communityId ? `communities/${gData.communityId}/cargos` : `groups/${chat.id}/cargos`;
                    db.ref(fetchPath).on('value', cSnap => {
                        const data = cSnap.val();
                        setCargosData(data);
                        let role = 'membro';
                        if (data) {
                            if (data.dono === user.id) role = 'dono';
                            else if (data.admins?.includes(user.id)) role = 'admin';
                            else if (data.moderadores?.includes(user.id)) role = 'moderador';
                            else if (data.mutados?.includes(user.id)) role = 'mutado';
                            else if (data.cargos_personalizados) {
                                for (const [cName, cData] of Object.entries(data.cargos_personalizados)) {
                                    if (cData.membros?.includes(user.id)) { role = cName; break; }
                                }
                            }
                        }
                        if (role === 'membro' && gData.members?.[user.id]) {
                            const mRole = gData.members[user.id].role || gData.members[user.id];
                            if (mRole === 'admin' || mRole === 'owner') role = mRole === 'owner' ? 'dono' : 'admin';
                        }
                        setMyRoleName(role);
                        setIsAdmin(role === 'dono' || role === 'admin');
                    });
                }
            });
        }
    }, [chat.id, db, user.id, chat.type]);

    // Message Listener
    React.useEffect(() => {
        if (!db) return;
        const messagesRef = db.ref(listenPath);
        
        const handleData = (snapshot) => {
            const msgList = [];
            snapshot.forEach((child) => {
                const msg = child.val();
                // Se for chat direto, só pega mensagens enviadas POR ESSE alvo específico
                if (chat.type === 'group' || msg.senderId === getTargetId()) {
                    msgList.push({ ...msg, key: child.key });
                }
            });
            
            if (msgList.length === 0) return;
            
            const localKey = `local_history_${chat.id}`;
            let localHistory = [];
            try { localHistory = JSON.parse(localStorage.getItem(localKey)) || []; } catch (e) {}

            let merged = [...localHistory];
            let hasNew = false;

            msgList.forEach(msg => {
                const existsIdx = merged.findIndex(m => m.key === msg.key);
                if (existsIdx === -1) {
                    merged.push(msg);
                    hasNew = true;
                } else {
                    merged[existsIdx] = { ...merged[existsIdx], ...msg };
                    hasNew = true;
                }
            });

            if (hasNew) {
                // Ordena as mensagens pelo timestamp real para que fiquem no lugar cronológico certo
                merged.sort((a, b) => a.timestamp - b.timestamp);

                if (merged.length > 2000) merged = merged.slice(merged.length - 2000);
                localStorage.setItem(localKey, JSON.stringify(merged));
                setMessages(merged);
                
                const el = scrollContainerRef.current;
                const isAtBottom = el ? (el.scrollHeight - el.scrollTop - el.clientHeight <= 150) : true;
                const hasMyNewMessage = msgList.length > 0 && msgList[msgList.length - 1].senderId === user.id;

                if ((isAtBottom || hasMyNewMessage) && !isPulling && !selectionMode) {
                    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
                }
            }
            
            // Apaga as mensagens do servidor assim que são recebidas
            if (chat.type !== 'group') {
                msgList.forEach(msg => {
                    db.ref(`${listenPath}/${msg.key}`).remove().catch(console.error);
                });
            }
        };

        const localKey = `local_history_${chat.id}`;
        try {
            const localHist = JSON.parse(localStorage.getItem(localKey));
            if (localHist && localHist.length > 0) {
                // Garante ordenação do histórico local também
                localHist.sort((a, b) => a.timestamp - b.timestamp);
                setMessages(localHist);
                setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'auto' }), 50);
            }
        } catch(e) {}

        messagesRef.on('value', handleData);
        return () => messagesRef.off('value', handleData);
    }, [chat.id, db, user.id, isPulling, selectionMode, listenPath]);

    // PeerJS initialization & Firebase Presence Offer
    React.useEffect(() => {
        if (!chat.id || !user.id || !window.ChatP2P) return;
        
        let targetId = null;
        if (chat.type !== 'group') {
            targetId = chat.targetId || (chat.id.replace(user.id, '').replace('_', ''));
        }

        window.ChatP2P.initPeer(user.id, 
            (msg) => {
                // Chegou mensagem via P2P
                const newMsg = { ...msg, key: msg.key || `webrtc_${Date.now()}`, timestamp: msg.timestamp || Date.now() };
                setMessages(prev => {
                    if (!prev.find(m => m.key === newMsg.key)) {
                        const localKey = `local_history_${chat.id}`;
                        let localHistory = [];
                        try { localHistory = JSON.parse(localStorage.getItem(localKey)) || []; } catch(e){}
                        localHistory.push(newMsg);
                        localStorage.setItem(localKey, JSON.stringify(localHistory.slice(-2000)));
                        setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
                        return [...prev, newMsg];
                    }
                    return prev;
                });
            },
            (senderId, isTyping) => setTypingUsers(prev => ({ ...prev, [senderId]: isTyping }))
        );

        if (db) {
            // Sinaliza que estou online neste chat
            const presenceRef = db.ref(`presence/${sharedChatId}/${user.id}`);
            presenceRef.set({ online: true, timestamp: window.firebase.database.ServerValue.TIMESTAMP });
            presenceRef.onDisconnect().remove();

            // Escuta por outros membros na sala para conectar via P2P
            const roomPresenceRef = db.ref(`presence/${sharedChatId}`);
            const handlePresence = (snap) => {
                const data = snap.val();
                if (data) {
                    Object.keys(data).forEach(peerUid => {
                        if (peerUid !== user.id && data[peerUid].online) {
                            // Se alguém ficou online, tenta se conectar com ele via P2P
                            window.ChatP2P.connectToPeer(user.id, peerUid);
                        }
                    });
                }
            };
            roomPresenceRef.on('value', handlePresence);
            
            return () => {
                presenceRef.remove();
                roomPresenceRef.off('value', handlePresence);
            };
        }
    }, [user.id, chat.id, chat.type, chat.targetId, db]);

    const verificarPermissao = (acao) => {
        if (chat.type !== 'group') return true;
        if (myRoleName === 'dono') return true;
        if (myRoleName === 'mutado') return false;
        if (myRoleName === 'admin') return true;
        if (myRoleName === 'moderador') {
            return ['enviar_mensagem', 'enviar_foto', 'enviar_video', 'enviar_audio', 'enviar_documento', 'responder_mensagem', 'apagar_propria_mensagem'].includes(acao);
        }
        if (myRoleName === 'membro') {
            return ['enviar_mensagem', 'enviar_foto', 'enviar_video', 'enviar_audio', 'enviar_documento', 'responder_mensagem', 'apagar_propria_mensagem'].includes(acao);
        }
        if (cargosData?.cargos_personalizados?.[myRoleName]?.permissoes) {
            return cargosData.cargos_personalizados[myRoleName].permissoes.includes(acao);
        }
        return false;
    };

    const sendMessage = async (rawMsg) => {
        if (!rawMsg.trim() || !db) return;

        if (!verificarPermissao('enviar_mensagem')) {
            showToast("Você não tem permissão para enviar mensagens.", "error"); return;
        }

        const isBotCommand = rawMsg.startsWith('!') || rawMsg.startsWith('/');
        const encryptedText = (window.CryptoUtils && !isBotCommand) ? window.CryptoUtils.encrypt(rawMsg, encryptionKey) : rawMsg;

        if (editingMessage) {
            await db.ref(`${writePath}/${editingMessage.key}`).update({ text: encryptedText, edited: true });
            setEditingMessage(null);
            return;
        }

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
        
        const uniqueKey = db.ref(writePath).push().key;
        const finalMsgData = { ...msgData, key: uniqueKey };

        let targetId = chat.targetId || (chat.id.replace(user.id, '').replace('_', ''));
        let sentViaP2P = false;

        if (window.ChatP2P && chat.type !== 'group' && targetId) {
            sentViaP2P = window.ChatP2P.sendMessage(user.id, targetId, finalMsgData);
        }
        
        if (sentViaP2P) {
            setMessages(prev => {
                if (!prev.find(m => m.key === finalMsgData.key)) {
                    const merged = [...prev, finalMsgData].sort((a, b) => a.timestamp - b.timestamp);
                    localStorage.setItem(`local_history_${chat.id}`, JSON.stringify(merged.slice(-2000)));
                    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
                    return merged;
                }
                return prev;
            });
        } else {
            await db.ref(`${writePath}/${uniqueKey}`).set(finalMsgData);
            // Salva no próprio histórico já que ele não vai escutar de volta a própria mensagem se for chat direto
            if (chat.type !== 'group') {
                setMessages(prev => {
                    if (!prev.find(m => m.key === finalMsgData.key)) {
                        const merged = [...prev, finalMsgData].sort((a, b) => a.timestamp - b.timestamp);
                        localStorage.setItem(`local_history_${chat.id}`, JSON.stringify(merged.slice(-2000)));
                        setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
                        return merged;
                    }
                    return prev;
                });
            }
        }
        
        if(window.SettingsManager) {
            window.SettingsManager.playNotificationSound();
            window.SettingsManager.vibrate('send');
        }

        const chatUpdate = { lastMessage: encryptedText, timestamp: Date.now() };
        if (chat.type === 'group') {
            db.ref(`groups/${chat.id}/members`).once('value').then(snap => {
                const members = snap.val() || {};
                for (const uid of Object.keys(members)) {
                    db.ref(`users/${uid}/chats/${chat.id}`).update(chatUpdate);
                    if (uid !== user.id && window.api && window.api.sendNotification) {
                        window.api.sendNotification(uid, chat.name, `Nova mensagem de ${user.name}`);
                    }
                }
            });
        } else {
            db.ref(`users/${user.id}/chats/${chat.id}`).update(chatUpdate);
            if (targetId && targetId !== user.id) {
                db.ref(`users/${targetId}/chats/${user.id}`).update({
                    ...chatUpdate,
                    name: user.name || 'Usuário',
                    type: 'direct',
                    targetId: user.id
                });
                if (window.api && window.api.sendNotification) {
                    window.api.sendNotification(targetId, user.name, "Nova mensagem recebida");
                }
            }
        }
    };

    const sendMediaFile = async (file, type) => {
        if (!verificarPermissao(`enviar_${type === 'image' ? 'foto' : type === 'video' ? 'video' : 'documento'}`)) {
            showToast(`Sem permissão para enviar ${type}.`, "error"); return;
        }
        if (file.size > 15 * 1024 * 1024) { 
            showToast("Arquivo muito grande! Máximo 15MB", "error"); return; 
        }
        try {
            let base64Data = type === 'image' ? await window.api.compressImage(file, 800, 0.6) : await window.api.fileToBase64(file);
            const mediaMsg = {
                senderId: user.id,
                senderName: user.name,
                type: type,
                fileData: base64Data,
                fileName: file.name,
                timestamp: Date.now(),
                ephemeral: ephemeralMode
            };
            const msgRef = await db.ref(writePath).push(mediaMsg);
            
            if (chat.type !== 'group') {
                setMessages(prev => {
                    const merged = [...prev, { ...mediaMsg, key: msgRef.key }].sort((a, b) => a.timestamp - b.timestamp);
                    localStorage.setItem(`local_history_${chat.id}`, JSON.stringify(merged.slice(-2000)));
                    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
                    return merged;
                });
                if (window.api && window.api.sendNotification) {
                    const targetId = chat.targetId || (chat.id.replace(user.id, '').replace('_', ''));
                    window.api.sendNotification(targetId, user.name, `Enviou um ${type === 'image' ? 'arquivo de imagem' : type}`);
                }
            } else {
                db.ref(`groups/${chat.id}/members`).once('value').then(snap => {
                    const members = snap.val() || {};
                    for (const uid of Object.keys(members)) {
                        if (uid !== user.id && window.api && window.api.sendNotification) {
                            window.api.sendNotification(uid, chat.name, `${user.name} enviou mídia`);
                        }
                    }
                });
            }
        } catch (e) {
            showToast("Erro ao processar arquivo", "error");
        }
    };

    const startRecording = async (e) => {
        if(e) e.preventDefault();
        if (isRecordingRef.current) return;
        if (!verificarPermissao('enviar_audio')) {
            showToast("Sem permissão para enviar áudio.", "error"); return;
        }
        try {
            isRecordingRef.current = true;
            setRecording(true);
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorder.current = new MediaRecorder(stream);
            audioChunks.current = [];
            
            mediaRecorder.current.ondataavailable = ev => {
                if (ev.data.size > 0) audioChunks.current.push(ev.data);
            };
            mediaRecorder.current.onstop = async () => {
                stream.getTracks().forEach(track => track.stop());
                if (audioChunks.current.length > 0) {
                    const blob = new Blob(audioChunks.current, { type: 'audio/webm' });
                    const reader = new FileReader();
                    reader.readAsDataURL(blob);
                    reader.onload = async () => {
                        const audioMsg = {
                            senderId: user.id, senderName: user.name, type: 'audio',
                            fileData: reader.result, timestamp: Date.now(), ephemeral: ephemeralMode
                        };
                        const msgRef = await db.ref(writePath).push(audioMsg);
                        if (chat.type !== 'group') {
                            setMessages(prev => {
                                const merged = [...prev, { ...audioMsg, key: msgRef.key }].sort((a, b) => a.timestamp - b.timestamp);
                                localStorage.setItem(`local_history_${chat.id}`, JSON.stringify(merged.slice(-2000)));
                                setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
                                return merged;
                            });
                            if (window.api && window.api.sendNotification) {
                                const targetId = chat.targetId || (chat.id.replace(user.id, '').replace('_', ''));
                                window.api.sendNotification(targetId, user.name, "Enviou uma mensagem de áudio");
                            }
                        } else {
                            db.ref(`groups/${chat.id}/members`).once('value').then(snap => {
                                const members = snap.val() || {};
                                for (const uid of Object.keys(members)) {
                                    if (uid !== user.id && window.api && window.api.sendNotification) {
                                        window.api.sendNotification(uid, chat.name, `${user.name} enviou áudio`);
                                    }
                                }
                            });
                        }
                    };
                }
            };
            mediaRecorder.current.startTime = Date.now();
            mediaRecorder.current.start();
        } catch (e) {
            isRecordingRef.current = false;
            setRecording(false);
            showToast("Erro ao acessar microfone", "error");
        }
    };

    const stopRecording = (e) => {
        if(e) e.preventDefault();
        if (mediaRecorder.current && isRecordingRef.current) {
            const duration = Date.now() - mediaRecorder.current.startTime;
            if (duration < 1000) {
                audioChunks.current = [];
                mediaRecorder.current.stop();
                isRecordingRef.current = false;
                setRecording(false);
                showToast("Áudio muito curto", "error");
                return;
            }
            mediaRecorder.current.stop();
            isRecordingRef.current = false;
            setRecording(false);
        }
    };

    // Selection & Gesture Handlers
    const handleTouchStart = (e) => {
        const el = scrollContainerRef.current;
        if (!el) return;
        if (el.scrollHeight - el.scrollTop - el.clientHeight <= 50) {
            touchStartY.current = e.touches[0].clientY;
            setIsPulling(true);
        }
    };
    const handleTouchMove = (e) => {
        if (isPulling) {
            const diff = touchStartY.current - e.touches[0].clientY;
            if (diff > 0) {
                const resist = diff * 0.4;
                setPullY(resist);
                if (resist > 40 && !secretTimer.current) {
                    let progress = 0;
                    secretTimer.current = setInterval(() => {
                        progress += 2;
                        setPullProgress(progress);
                        if (progress >= 30) {
                            clearInterval(secretTimer.current);
                            setEphemeralMode(!ephemeralMode);
                            localStorage.setItem(`ephemeral_${chat.id}`, (!ephemeralMode).toString());
                            showToast(!ephemeralMode ? "Modo Secreto Ativado" : "Modo Secreto Desativado", "success");
                            setIsPulling(false); setPullY(0); setPullProgress(0);
                            secretTimer.current = null;
                        }
                    }, 50);
                }
            } else { setPullY(0); setPullProgress(0); }
        }
    };
    const handleTouchEnd = () => {
        setIsPulling(false); setPullY(0); setPullProgress(0);
        if (secretTimer.current) { clearInterval(secretTimer.current); secretTimer.current = null; }
    };

    const visibleMessages = messages.filter(m => !localDeletedIds.includes(m.key));

    return (
        <div className={`flex flex-col h-[100dvh] max-h-[100dvh] w-full relative overflow-hidden ${ephemeralMode ? 'bg-gray-950 text-white' : 'bg-slate-50 text-gray-800'}`} data-name="chat-room" data-file="components/ChatRoom.js">
            
            {selectionMode ? (
                <div className="flex-none px-4 py-3 bg-indigo-600 shadow-md z-50 flex justify-between items-center text-white">
                    <div className="flex items-center gap-4">
                        <button onClick={() => { setSelectionMode(false); setSelectedMessages([]); }} className="p-2 hover:bg-indigo-700 rounded-full">
                            <div className="icon-arrow-left text-xl"></div>
                        </button>
                        <span className="font-bold text-lg">{selectedMessages.length} selecionadas</span>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={() => {
                            const newLocal = [...localDeletedIds, ...selectedMessages];
                            setLocalDeletedIds(newLocal);
                            localStorage.setItem(`deleted_${chat.id}`, JSON.stringify(newLocal));
                            setSelectionMode(false); setSelectedMessages([]);
                        }} className="p-2 hover:bg-indigo-700 rounded-full" title="Apagar localmente">
                            <div className="icon-trash-2 text-xl"></div>
                        </button>
                    </div>
                </div>
            ) : (
                <div className={`flex-none px-4 py-3 shadow-sm z-50 flex justify-between items-center border-b ${ephemeralMode ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200'}`}>
                    <div className="flex items-center gap-3 flex-1">
                        <button onClick={() => window.location.href = 'index.html'} className="p-2 rounded-full hover:bg-gray-100/10">
                            <div className="icon-arrow-left text-xl"></div>
                        </button>
                        <div className="flex-1 cursor-pointer flex items-center gap-3" onClick={() => window.location.href = `info.html?chatId=${chat.id}`}>
                            <div className="w-10 h-10 rounded-full bg-indigo-500 flex items-center justify-center text-white font-bold">
                                {chat.name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                                <h3 className="font-bold truncate">{chat.name}</h3>
                                <p className={`text-xs ${ephemeralMode ? 'text-purple-400' : 'text-indigo-500'}`}>{ephemeralMode ? 'Modo Secreto' : 'Toque para info'}</p>
                            </div>
                        </div>
                    </div>
                    {chat.type !== 'group' && (
                        <div className="flex items-center gap-1">
                            <button onClick={() => {
                                const targetId = chat.targetId || chat.id.replace(user.id, '').replace('_', '');
                                const callId = Date.now().toString() + '_' + Math.random().toString(36).substr(2, 9);
                                window.firebaseDB.ref(`calls/${callId}`).set({
                                    callerId: user.id,
                                    receiverId: targetId,
                                    isVideo: false,
                                    status: 'initiated',
                                    timestamp: window.firebase.database.ServerValue.TIMESTAMP
                                }).then(() => {
                                    window.location.href = `call.html?callId=${callId}`;
                                });
                            }} className="p-2 rounded-full hover:bg-gray-200/50 text-indigo-500 transition-colors">
                                <div className="icon-phone text-xl"></div>
                            </button>
                            <button onClick={() => {
                                const targetId = chat.targetId || chat.id.replace(user.id, '').replace('_', '');
                                const callId = Date.now().toString() + '_' + Math.random().toString(36).substr(2, 9);
                                window.firebaseDB.ref(`calls/${callId}`).set({
                                    callerId: user.id,
                                    receiverId: targetId,
                                    isVideo: true,
                                    status: 'initiated',
                                    timestamp: window.firebase.database.ServerValue.TIMESTAMP
                                }).then(() => {
                                    window.location.href = `call.html?callId=${callId}`;
                                });
                            }} className="p-2 rounded-full hover:bg-gray-200/50 text-indigo-500 transition-colors">
                                <div className="icon-video text-xl"></div>
                            </button>
                        </div>
                    )}
                </div>
            )}

            <div 
                ref={scrollContainerRef}
                onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}
                onScroll={(e) => {
                    const isAtBottom = e.target.scrollHeight - e.target.scrollTop - e.target.clientHeight < 150;
                    setShowScrollBottom(!isAtBottom);
                }}
                className="flex-1 overflow-y-auto p-4 space-y-4 z-10 relative" 
                onClick={() => { setShowAttachMenu(false); setShowEmojiPicker(false); setShowGifPicker(false); setContextMenu(null); }}
                style={{ transform: `translateY(-${pullY}px)`, transition: isPulling ? 'none' : 'transform 0.4s ease' }}
            >
                <style>
                    {`
                    .typing-indicator span {
                        display: inline-block;
                        width: 6px;
                        height: 6px;
                        background-color: currentColor;
                        border-radius: 50%;
                        animation: typing 1.4s infinite ease-in-out both;
                        margin: 0 2px;
                    }
                    .typing-indicator span:nth-child(1) { animation-delay: -0.32s; }
                    .typing-indicator span:nth-child(2) { animation-delay: -0.16s; }
                    @keyframes typing {
                        0%, 80%, 100% { transform: scale(0); }
                        40% { transform: scale(1); }
                    }
                    `}
                </style>
                {visibleMessages.map((msg) => {
                    const isSelected = selectedMessages.includes(msg.key);
                    const isMe = msg.senderId === user.id;
                    const textContent = msg.type === 'text' ? (window.CryptoUtils ? window.CryptoUtils.decrypt(msg.text, encryptionKey) : msg.text) : '';
                    
                    return (
                        <div key={msg.key} 
                             className={`flex ${isMe ? 'justify-end' : 'justify-start'} cursor-pointer relative`}
                             onContextMenu={(e) => {
                                 e.preventDefault();
                                 if (!selectionMode) setContextMenu({ x: e.clientX, y: e.clientY, msg });
                             }}
                             onClick={() => {
                                 if (selectionMode) {
                                     setSelectedMessages(prev => prev.includes(msg.key) ? prev.filter(id => id !== msg.key) : [...prev, msg.key]);
                                 }
                             }}
                        >
                            {selectionMode && (
                                <div className="mr-2 flex items-center">
                                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${isSelected ? 'bg-indigo-600 border-indigo-600' : 'border-gray-400'}`}>
                                        {isSelected && <div className="icon-check text-white text-sm"></div>}
                                    </div>
                                </div>
                            )}
                            <div className={`max-w-[80%] px-4 py-3 shadow-sm rounded-2xl ${isMe ? 'bg-indigo-600 text-white rounded-br-none' : (ephemeralMode ? 'bg-gray-800 text-gray-100 rounded-bl-none' : 'bg-white text-gray-800 border border-gray-200 rounded-bl-none')} ${isSelected ? 'scale-95 opacity-80' : ''}`}>
                                {msg.ephemeral && <div className="icon-timer text-xs absolute top-1 right-2 opacity-50"></div>}
                                
                                {msg.replyTo && (
                                    <div className={`mb-2 pl-2 border-l-4 rounded p-2 text-sm ${isMe ? 'bg-black/10 border-white text-indigo-100' : 'bg-gray-100 border-indigo-400 text-gray-600'}`}>
                                        <div className="font-bold text-xs">{msg.replyTo.senderName}</div>
                                        <div className="truncate">{window.CryptoUtils && msg.replyTo.text && msg.replyTo.text !== 'Mídia' ? window.CryptoUtils.decrypt(msg.replyTo.text, encryptionKey) : msg.replyTo.text}</div>
                                    </div>
                                )}

                                {msg.type === 'text' && <div className="break-words mt-1">{textContent}</div>}
                                {msg.type === 'image' && <img src={msg.fileData} className="max-w-full rounded mt-2" />}
                                {msg.type === 'video' && (
                                    <div className="max-w-full overflow-hidden rounded bg-black mt-2">
                                        {window.UniversalVideoPlayer ? <window.UniversalVideoPlayer src={msg.fileData} /> : <video src={msg.fileData} controls className="w-full" />}
                                    </div>
                                )}
                                {msg.type === 'audio' && <window.CustomAudioPlayer src={msg.fileData} isOwn={isMe} />}

                                <div className={`text-[10px] mt-1 flex justify-between items-center w-full ${isMe ? 'text-indigo-200' : 'text-gray-400'}`}>
                                    <div className="flex items-center gap-1">
                                        {isMe && msg.read && <div className="icon-check-check text-blue-300"></div>}
                                        {isMe && !msg.read && <div className="icon-check opacity-70"></div>}
                                    </div>
                                    <div className="flex gap-1 items-center">
                                        {!isMe && chat.type === 'group' && <span className="font-bold truncate max-w-[80px]">{msg.senderName} • </span>}
                                        {new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })}
                
                {chat.type !== 'group' && (chat.targetId || (chat.id.replace(user.id, '').replace('_', ''))) && typingUsers[(chat.targetId || (chat.id.replace(user.id, '').replace('_', '')))] && (
                    <div className="flex justify-start">
                        <div className={`px-4 py-3 shadow-sm rounded-2xl rounded-bl-none flex items-center gap-1 ${ephemeralMode ? 'bg-gray-800 text-gray-400' : 'bg-white text-gray-500 border border-gray-200'}`}>
                            <div className="typing-indicator text-indigo-500">
                                <span></span><span></span><span></span>
                            </div>
                        </div>
                    </div>
                )}

                <div ref={messagesEndRef} className="h-4" />
            </div>

            {showScrollBottom && (
                <button onClick={() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })} className="absolute bottom-[90px] right-4 w-10 h-10 bg-white text-indigo-600 rounded-full shadow-lg flex items-center justify-center z-[60] hover:bg-gray-50">
                    <div className="icon-chevron-down text-xl"></div>
                </button>
            )}

            {contextMenu && (
                <div className={`fixed z-[100] rounded-xl shadow-2xl border w-48 overflow-hidden animate-fade-in-up ${ephemeralMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`} style={{ top: Math.min(contextMenu.y, window.innerHeight - 150), left: Math.min(contextMenu.x, window.innerWidth - 200) }}>
                    <button className="w-full text-left px-4 py-3 text-sm font-bold flex items-center gap-3 hover:bg-gray-100/10" onClick={(e) => { e.stopPropagation(); setSelectionMode(true); setSelectedMessages([contextMenu.msg.key]); setContextMenu(null); }}>
                        <div className="icon-check-square text-lg text-indigo-500"></div> Selecionar
                    </button>
                    {contextMenu.msg.type === 'text' && (
                        <button className="w-full text-left px-4 py-3 text-sm font-bold flex items-center gap-3 border-t border-gray-200/20 hover:bg-gray-100/10" onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(window.CryptoUtils ? window.CryptoUtils.decrypt(contextMenu.msg.text, encryptionKey) : contextMenu.msg.text); showToast("Copiado", "success"); setContextMenu(null); }}>
                            <div className="icon-copy text-lg text-indigo-500"></div> Copiar
                        </button>
                    )}
                    <button className="w-full text-left px-4 py-3 text-sm font-bold flex items-center gap-3 border-t border-gray-200/20 hover:bg-gray-100/10" onClick={(e) => { e.stopPropagation(); setReplyingTo(contextMenu.msg); setContextMenu(null); }}>
                        <div className="icon-corner-up-left text-lg text-indigo-500"></div> Responder
                    </button>
                    <button className="w-full text-left px-4 py-3 text-sm font-bold flex items-center gap-3 border-t border-gray-200/20 hover:bg-gray-100/10 text-red-600" onClick={(e) => { 
                        e.stopPropagation(); 
                        const reason = prompt("Motivo da denúncia:");
                        if (reason && db) {
                            db.ref('reports').push({ type: 'message', message: contextMenu.msg, reason, reportedBy: user.id, timestamp: Date.now() });
                            showToast("Mensagem denunciada", "success");
                        }
                        setContextMenu(null); 
                    }}>
                        <div className="icon-flag text-lg"></div> Denunciar
                    </button>
                </div>
            )}

            {isLocked && (
                <div className="fixed inset-0 bg-gray-900 z-[200] flex flex-col items-center justify-center p-4">
                    <div className="icon-lock text-6xl text-white mb-6"></div>
                    <h2 className="text-2xl text-white font-bold mb-4">Conversa Bloqueada</h2>
                    <input type="password" value={unlockPin} onChange={e => setUnlockPin(e.target.value)} placeholder="Senha (PIN)" className="p-3 rounded-xl w-full max-w-xs text-center font-bold tracking-[0.5em] mb-4 text-gray-800" />
                    <button onClick={handleUnlock} className="px-6 py-3 bg-indigo-600 text-white font-bold rounded-xl w-full max-w-xs">Desbloquear</button>
                    <button onClick={() => window.location.href='index.html'} className="mt-4 text-gray-400">Voltar</button>
                </div>
            )}

            <div className={`flex-none p-2 sm:p-3 border-t flex flex-col z-50 w-full ${ephemeralMode ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200'}`}>
                {replyingTo && (
                    <div className="flex items-center justify-between p-2 px-4 rounded-t-xl bg-indigo-50/10 border-l-4 border-indigo-500 -mt-3 mb-2">
                        <div className="overflow-hidden min-w-0">
                            <span className="text-xs font-bold text-indigo-500">Respondendo a {replyingTo.senderName}</span>
                            <span className="text-sm truncate block">{replyingTo.type === 'text' ? (window.CryptoUtils ? window.CryptoUtils.decrypt(replyingTo.text, encryptionKey) : replyingTo.text) : 'Mídia'}</span>
                        </div>
                        <button onClick={() => setReplyingTo(null)} className="text-gray-400"><div className="icon-x text-lg"></div></button>
                    </div>
                )}
                
                {chat.type === 'group' && myRoleName === 'mutado' ? (
                    <div className="p-3 bg-orange-50 text-orange-600 rounded-xl font-bold text-sm text-center">🔇 Você foi mutado neste grupo.</div>
                ) : (
                    <window.ChatInput 
                        chat={chat} user={user} db={db} refPath={writePath} ephemeralMode={ephemeralMode} encryptionKey={encryptionKey}
                        replyingTo={replyingTo} setReplyingTo={setReplyingTo} showEmojiPicker={showEmojiPicker} setShowEmojiPicker={setShowEmojiPicker}
                        showGifPicker={showGifPicker} setShowGifPicker={setShowGifPicker} showAttachMenu={showAttachMenu} setShowAttachMenu={setShowAttachMenu}
                        setShowCamera={setShowCamera} fileInputRef={fileInputRef} sendMediaFile={sendMediaFile} sendMessage={sendMessage}
                        messageInput={messageInput} setMessageInput={setMessageInput} startRecording={startRecording} stopRecording={stopRecording} recording={recording}
                    />
                )}
            </div>

            {toastMessage && (
                <div className={`fixed bottom-20 right-4 p-4 rounded-xl shadow-lg text-white font-medium z-[100] flex items-center gap-2 animate-fade-in-up ${toastMessage.type === 'error' ? 'bg-red-500' : 'bg-gray-800'}`}>
                    <div className={`icon-${toastMessage.type === 'error' ? 'alert-circle' : 'check-circle'} text-xl`}></div>
                    {toastMessage.message}
                </div>
            )}
        </div>
    );
}
window.ChatRoom = ChatRoom;