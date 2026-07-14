function TVApp() {
    const [appState, setAppState] = React.useState('loading'); 
    const [deviceId, setDeviceId] = React.useState(null);
    const [accounts, setAccounts] = React.useState([]);
    const [selectedAccount, setSelectedAccount] = React.useState(null);
    const [viewStack, setViewStack] = React.useState(['account_select']);
    
    // Main state variables
    const [currentTab, setCurrentTab] = React.useState('chats'); // chats, social
    const [activeChat, setActiveChat] = React.useState(null);
    const [chats, setChats] = React.useState([]);
    const [posts, setPosts] = React.useState([]);
    const [messages, setMessages] = React.useState([]);
    const [usersData, setUsersData] = React.useState({});
    const [lockedChats, setLockedChats] = React.useState({});
    const [unlockedForTv, setUnlockedForTv] = React.useState({});
    const [authRequest, setAuthRequest] = React.useState(null);
    const [showUnlockModal, setShowUnlockModal] = React.useState(null);
    const [alwaysAllow, setAlwaysAllow] = React.useState(false);
    
    const [textInput, setTextInput] = React.useState('');
    const [isRecording, setIsRecording] = React.useState(false);
    const [isVoiceToText, setIsVoiceToText] = React.useState(false);
    
    const [activeVideoFeed, setActiveVideoFeed] = React.useState(null);
    const [showComments, setShowComments] = React.useState(null);
    
    const messagesEndRef = React.useRef(null);
    const videoContainerRef = React.useRef(null);
    const mediaRecorderRef = React.useRef(null);
    const audioChunksRef = React.useRef([]);
    const recognitionRef = React.useRef(null);
    const recordTimerRef = React.useRef(null);

    React.useEffect(() => {
        let savedDeviceId = localStorage.getItem("tv_device_id");
        if (!savedDeviceId) {
            savedDeviceId = 'tv_' + Math.random().toString(36).substr(2, 9);
            localStorage.setItem("tv_device_id", savedDeviceId);
        }
        setDeviceId(savedDeviceId);

        const savedAccounts = JSON.parse(localStorage.getItem("tv_accounts") || "[]");
        setAccounts(savedAccounts);
        
        if (savedAccounts.length === 0) {
            setAppState('auth');
            listenForAuth(savedDeviceId);
            setViewStack(['auth']);
        } else {
            setAppState('account_select');
            setViewStack(['account_select']);
        }

        if (window.firebaseDB) {
            window.firebaseDB.ref('users').on('value', snap => {
                if (snap.val()) setUsersData(snap.val());
            });
        }
        
        // Voice recognition setup
        if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            recognitionRef.current = new SpeechRecognition();
            recognitionRef.current.continuous = false;
            recognitionRef.current.interimResults = true;
            recognitionRef.current.lang = 'pt-BR';
            
            recognitionRef.current.onresult = (event) => {
                let interimTranscript = '';
                let finalTranscript = '';
                for (let i = event.resultIndex; i < event.results.length; ++i) {
                    if (event.results[i].isFinal) {
                        finalTranscript += event.results[i][0].transcript;
                    } else {
                        interimTranscript += event.results[i][0].transcript;
                    }
                }
                if (finalTranscript) setTextInput(prev => prev + ' ' + finalTranscript);
            };
            
            recognitionRef.current.onend = () => {
                if (isVoiceToText) setIsVoiceToText(false);
            };
        }
    }, []);

    // Controle Remoto
    React.useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape' || e.key === 'Backspace' || e.key === 'GoBack') {
                if (showComments) { setShowComments(null); return; }
                if (activeVideoFeed !== null) { setActiveVideoFeed(null); return; }
                if (activeChat) { setActiveChat(null); return; }
                handleBack();
                return;
            }
            
            const focusableElements = Array.from(document.querySelectorAll('.tv-focusable:not([disabled])'));
            if (focusableElements.length === 0) return;

            let currentFocus = focusableElements.findIndex(el => el.classList.contains('tv-focused'));
            
            // Navegação no feed de vídeo (só muda o vídeo se o foco estiver no player principal)
            if (activeVideoFeed !== null && !showComments) {
                if (currentFocus !== -1 && focusableElements[currentFocus].id === 'tv-video-player') {
                    if (e.key === 'ArrowDown') {
                        setActiveVideoFeed(prev => Math.min(prev + 1, posts.length - 1));
                        return;
                    }
                    if (e.key === 'ArrowUp') {
                        setActiveVideoFeed(prev => Math.max(prev - 1, 0));
                        return;
                    }
                }
            }
            if (currentFocus === -1) {
                currentFocus = 0;
                focusableElements[0].classList.add('tv-focused');
                return;
            }

            const currentRect = focusableElements[currentFocus].getBoundingClientRect();
            let nextFocus = currentFocus;

            const findClosest = (direction) => {
                let closest = -1;
                let minDistance = Infinity;

                focusableElements.forEach((el, index) => {
                    if (index === currentFocus) return;
                    const rect = el.getBoundingClientRect();
                    let isCandidate = false;
                    let distance = 0;

                    // Usando o centro dos elementos para uma navegação mais natural
                    const currentCenter = { x: currentRect.left + currentRect.width / 2, y: currentRect.top + currentRect.height / 2 };
                    const targetCenter = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
                    
                    const dx = targetCenter.x - currentCenter.x;
                    const dy = targetCenter.y - currentCenter.y;
                    
                    if (direction === 'right' && dx > Math.abs(dy)) {
                        isCandidate = true;
                        distance = Math.sqrt(dx*dx + dy*dy);
                    } else if (direction === 'left' && -dx > Math.abs(dy)) {
                        isCandidate = true;
                        distance = Math.sqrt(dx*dx + dy*dy);
                    } else if (direction === 'down' && dy > Math.abs(dx)) {
                        isCandidate = true;
                        distance = Math.sqrt(dx*dx + dy*dy);
                    } else if (direction === 'up' && -dy > Math.abs(dx)) {
                        isCandidate = true;
                        distance = Math.sqrt(dx*dx + dy*dy);
                    }

                    if (isCandidate && distance < minDistance) {
                        minDistance = distance;
                        closest = index;
                    }
                });
                return closest !== -1 ? closest : currentFocus;
            };

            switch (e.key) {
                case 'ArrowRight': nextFocus = findClosest('right'); break;
                case 'ArrowLeft': nextFocus = findClosest('left'); break;
                case 'ArrowDown': nextFocus = findClosest('down'); break;
                case 'ArrowUp': nextFocus = findClosest('up'); break;
                case 'Enter':
                case 'Ok':
                    // Verifica se é o botão de gravação
                    if (focusableElements[currentFocus].id === 'btn-record-audio') {
                        startAudioRecording();
                    } else if (focusableElements[currentFocus].id === 'tv-video-player') {
                        const vid = document.getElementById(`tv-video-${activeVideoFeed}`);
                        if (vid) {
                            if (vid.paused) vid.play();
                            else vid.pause();
                        }
                    } else if (focusableElements[currentFocus].tagName.toLowerCase() === 'input') {
                        focusableElements[currentFocus].focus();
                    } else {
                        focusableElements[currentFocus].click();
                    }
                    break;
                default:
                    return;
            }

            if (nextFocus !== currentFocus) {
                focusableElements[currentFocus].classList.remove('tv-focused');
                focusableElements[nextFocus].classList.add('tv-focused');
                focusableElements[nextFocus].scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
            }
        };

        const handleKeyUp = (e) => {
            if (e.key === 'Enter' || e.key === 'Ok') {
                const focusableElements = Array.from(document.querySelectorAll('.tv-focusable.tv-focused'));
                if (focusableElements.length > 0 && focusableElements[0].id === 'btn-record-audio') {
                    stopAudioRecording();
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
        };
    });

    React.useEffect(() => {
        setTimeout(() => {
            const elements = document.querySelectorAll('.tv-focusable:not([disabled])');
            const hasFocus = document.querySelector('.tv-focused');
            
            // Se o overlay de comentários abriu, foca no input de comentário
            if (showComments && document.getElementById('comment-input')) {
                elements.forEach(el => el.classList.remove('tv-focused'));
                document.getElementById('comment-input').classList.add('tv-focused');
                return;
            }

            if (elements.length > 0 && !hasFocus) {
                elements.forEach(el => el.classList.remove('tv-focused'));
                elements[0].classList.add('tv-focused');
            }
        }, 300);
    }, [appState, currentTab, activeChat, activeVideoFeed, showComments]);

    React.useEffect(() => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: 'auto' });
        }
    }, [messages]);

    React.useEffect(() => {
        if (appState === 'main' && selectedAccount && window.firebaseDB) {
            const db = window.firebaseDB;
            const chatsRef = db.ref(`users/${selectedAccount.uid}/chats`);
            chatsRef.on('value', snap => {
                const val = snap.val();
                if (val) {
                    const chatsList = Object.keys(val).map(k => ({...val[k], id: k}));
                    chatsList.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
                    setChats(chatsList);
                } else {
                    setChats([]);
                }
            });

            const lockedRef = db.ref(`users/${selectedAccount.uid}/lockedChats`);
            lockedRef.on('value', snap => {
                setLockedChats(snap.val() || {});
            });

            const unlockedRef = db.ref(`users/${selectedAccount.uid}/devices/${deviceId}/unlockedChats`);
            unlockedRef.on('value', snap => {
                setUnlockedForTv(snap.val() || {});
            });

            const postsRef = db.ref('posts');
            postsRef.on('value', snap => {
                const data = snap.val();
                if (data) {
                    const postsList = Object.keys(data).map(key => ({ 
                        id: key, 
                        ...data[key],
                        likesCount: data[key].likes ? Object.keys(data[key].likes).length : 0,
                        hasLiked: data[key].likes ? !!data[key].likes[selectedAccount.uid] : false,
                        commentsCount: data[key].comments ? Object.keys(data[key].comments).length : 0,
                    }));
                    postsList.sort((a, b) => b.timestamp - a.timestamp);
                    setPosts(postsList.filter(p => p.type === 'video' || (p.mediaUrl && p.mediaUrl.match(/\.(mp4|webm|ogg|mov)$/i))));
                } else {
                    setPosts([]);
                }
            });

            return () => {
                chatsRef.off();
                postsRef.off();
            };
        }
    }, [appState, selectedAccount]);

    React.useEffect(() => {
        if (activeChat && selectedAccount && window.firebaseDB) {
            const db = window.firebaseDB;
            const getTargetId = () => activeChat.targetId || activeChat.id.replace(selectedAccount.uid, '').replace('_', '');
            
            let listenPath = activeChat.type === 'group' ? `groups/${activeChat.id}/messages` : `chats/${[selectedAccount.uid, getTargetId()].sort().join('_')}/messages`;
            
            const messagesRef = db.ref(listenPath);
            messagesRef.on('value', snap => {
                const data = snap.val();
                if (data) {
                    const msgList = Object.keys(data).map(key => ({ ...data[key], key }));
                    setMessages(msgList.sort((a,b) => a.timestamp - b.timestamp));
                } else {
                    setMessages([]);
                }
            });

            return () => messagesRef.off();
        }
    }, [activeChat, selectedAccount]);

    const handleBack = () => {
        setViewStack(prev => {
            if (prev.length <= 1) return prev;
            const newStack = [...prev];
            newStack.pop();
            setAppState(newStack[newStack.length - 1]);
            return newStack;
        });
    };

    const navigateTo = (view) => {
        setViewStack(prev => [...prev, view]);
        setAppState(view);
    };

    const listenForAuth = (currentDeviceId) => {
        if (!window.firebaseDB) return;
        const ref = window.firebaseDB.ref(`tv_auth/${currentDeviceId}`);
        ref.on('value', async (snap) => {
            const data = snap.val();
            if (data && data.userKey && data.status === 'approved') {
                ref.remove();
                const userData = await window.api.getCodeHubUser(data.userKey);
                if (userData && !userData.erro) {
                    const uid = userData.uid || userData.userKey;
                    const fbUserSnap = await window.firebaseDB.ref(`users/${uid}`).once('value');
                    const fbUser = fbUserSnap.val() || {};
                    const newAccount = {
                        userKey: data.userKey,
                        uid: uid,
                        nome: fbUser.name || userData.nome,
                        foto: fbUser.profilePicture || userData.foto
                    };
                    setAccounts(prev => {
                        const exists = prev.find(a => a.uid === newAccount.uid);
                        if (exists) return prev;
                        const newAccs = [...prev, newAccount].slice(0, 5); 
                        localStorage.setItem("tv_accounts", JSON.stringify(newAccs));
                        return newAccs;
                    });
                    setAppState('account_select');
                    setViewStack(['account_select']);
                }
            }
        });
    };

    const selectAccount = async (acc) => {
        if (window.firebaseDB) {
            const fbUserSnap = await window.firebaseDB.ref(`users/${acc.uid}`).once('value');
            const fbUser = fbUserSnap.val();
            if (fbUser && fbUser.profilePicture && fbUser.profilePicture !== acc.foto) {
                const updatedAcc = { ...acc, foto: fbUser.profilePicture, nome: fbUser.name || acc.nome };
                setSelectedAccount(updatedAcc);
            } else {
                setSelectedAccount(acc);
            }
        } else {
            setSelectedAccount(acc);
        }
        setActiveChat(null);
        setCurrentTab('chats');
        navigateTo('main');
    };

    // Chat sending logic
    const sendTextMessage = async (customText = null) => {
        const text = customText || textInput;
        if (!text.trim() || !activeChat) return;
        
        const db = window.firebaseDB;
        const getTargetId = () => activeChat.targetId || activeChat.id.replace(selectedAccount.uid, '').replace('_', '');
        
        const encryptionKey = activeChat.type === 'group' ? activeChat.id : [selectedAccount.uid, getTargetId()].sort().join('_');
        const encryptedText = window.CryptoUtils ? window.CryptoUtils.encrypt(text.trim(), encryptionKey) : text.trim();
        
        const msgData = {
            senderId: selectedAccount.uid,
            senderName: selectedAccount.nome,
            targetId: getTargetId(),
            chatId: activeChat.id,
            chatType: activeChat.type || 'direct',
            type: 'text',
            text: encryptedText,
            timestamp: Date.now()
        };
        
        await db.ref(`tv_sync_queue/${selectedAccount.uid}`).push(msgData);
        
        setTextInput('');
    };

    const startAudioRecording = async () => {
        if (isRecording) return;
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorderRef.current = new MediaRecorder(stream);
            audioChunksRef.current = [];
            
            mediaRecorderRef.current.ondataavailable = e => {
                if (e.data.size > 0) audioChunksRef.current.push(e.data);
            };
            
            mediaRecorderRef.current.onstop = async () => {
                const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                const reader = new FileReader();
                reader.readAsDataURL(blob);
                reader.onload = async () => {
                    const base64 = reader.result;
                    const getTargetId = () => activeChat.targetId || activeChat.id.replace(selectedAccount.uid, '').replace('_', '');
                    
                    const msgData = {
                        senderId: selectedAccount.uid,
                        senderName: selectedAccount.nome,
                        targetId: getTargetId(),
                        chatId: activeChat.id,
                        chatType: activeChat.type || 'direct',
                        type: 'audio',
                        fileData: base64,
                        timestamp: Date.now()
                    };
                    await window.firebaseDB.ref(`tv_sync_queue/${selectedAccount.uid}`).push(msgData);
                };
            };
            
            mediaRecorderRef.current.start();
            setIsRecording(true);
            recordTimerRef.current = Date.now();
        } catch (e) {
            console.log("Mic error");
        }
    };

    const stopAudioRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            mediaRecorderRef.current.stream.getTracks().forEach(t => t.stop());
            setIsRecording(false);
        }
    };

    const toggleVoiceToText = () => {
        if (isVoiceToText) {
            recognitionRef.current?.stop();
            setIsVoiceToText(false);
        } else {
            setTextInput('');
            recognitionRef.current?.start();
            setIsVoiceToText(true);
        }
    };

    const handleSocialLike = async (postId, hasLiked) => {
        const db = window.firebaseDB;
        if (!db) return;
        const likeRef = db.ref(`posts/${postId}/likes/${selectedAccount.uid}`);
        if (hasLiked) await likeRef.remove();
        else await likeRef.set(true);
    };

    const handleSocialComment = async (postId, commentText) => {
        if (!commentText.trim()) return;
        await window.firebaseDB.ref(`posts/${postId}/comments`).push({
            authorId: selectedAccount.uid,
            authorName: selectedAccount.nome,
            authorAvatar: selectedAccount.foto || '',
            text: commentText.trim(),
            timestamp: Date.now()
        });
    };

    if (appState === 'loading') {
        return <div className="flex h-screen items-center justify-center bg-gray-900 text-white"><div className="icon-loader animate-spin text-4xl text-indigo-500"></div></div>;
    }

    if (appState === 'auth') {
        return (
            <div className="flex h-screen items-center justify-center bg-gray-900 p-8 text-white">
                <div className="flex bg-gray-800 rounded-3xl overflow-hidden shadow-2xl max-w-4xl w-full relative mt-[500px]">
                    <div style={{"paddingTop":"48px","paddingRight":"48px","paddingBottom":"48px","paddingLeft":"48px","marginTop":"0px","marginRight":"0px","marginBottom":"0px","marginLeft":"0px","fontSize":"1","color":"rgb(255, 255, 255)","backgroundColor":"rgba(0, 0, 0, 0)","textAlign":"start","fontWeight":"400","objectFit":"fill","display":"flex","position":"static","top":"auto","left":"auto","right":"auto","bottom":"auto"}} className="w-1/2 p-12 flex flex-col justify-center">
                        <div className="icon-tv text-6xl text-indigo-500 mb-6"></div>
                        <h1 className="text-4xl font-bold mb-4">Adicionar Conta</h1>
                        <p className="text-gray-400 text-lg mb-8">Abra o Phantora no celular, vá em Configurações &gt; Dispositivos Conectados e escaneie o código QR.</p>
                        <div className="text-sm text-gray-500 font-mono bg-gray-900 p-3 rounded-lg inline-block self-start">ID: {deviceId}</div>
                    </div>
                    <div className="w-1/2 bg-gray-950 flex flex-col items-center justify-center p-12">
                        <div className="bg-gray-900 p-4 rounded-2xl border-4 border-indigo-500 shadow-[0_0_30px_rgba(99,102,241,0.3)]">
                            <div className="bg-white p-4 rounded-xl">
                                {deviceId && <img src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(`https://app.mensagens.site.je/?tvAuthId=${deviceId}`)}`} className="w-48 h-48 object-contain" />}
                            </div>
                        </div>
                        <p className="mt-8 text-indigo-400 font-semibold animate-pulse">Aguardando conexão...</p>
                    </div>
                </div>
            </div>
        );
    }

    if (appState === 'account_select') {
        return (
            <div className="flex h-screen flex-col items-center justify-center bg-gray-900 text-white">
                <h1 className="text-5xl font-bold mb-12">Quem está assistindo?</h1>
                <div className="flex flex-wrap gap-8 justify-center max-w-5xl">
                    {accounts.map((acc) => (
                        <div key={acc.uid} className="tv-focusable flex flex-col items-center gap-4 p-4 rounded-2xl cursor-pointer transition-transform" onClick={() => selectAccount(acc)}>
                            {acc.foto ? <img src={acc.foto} className="w-32 h-32 rounded-full object-cover border-4 border-transparent bg-gray-800" /> : <div className="w-32 h-32 rounded-full bg-indigo-600 flex items-center justify-center border-4 border-transparent text-5xl font-bold">{(acc.nome || '?').charAt(0).toUpperCase()}</div>}
                            <span className="text-2xl font-semibold">{acc.nome}</span>
                        </div>
                    ))}
                    {accounts.length < 5 && (
                        <div className="tv-focusable flex flex-col items-center gap-4 p-4 rounded-2xl cursor-pointer transition-transform" onClick={() => { listenForAuth(deviceId); navigateTo('auth'); }}>
                            <div className="w-32 h-32 rounded-full bg-gray-800 flex items-center justify-center border-4 border-transparent"><div className="icon-plus text-5xl text-gray-400"></div></div>
                            <span className="text-2xl font-semibold text-gray-400">Adicionar</span>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    if (appState === 'main') {
        const isFullScreenMode = activeChat !== null || activeVideoFeed !== null;

        return (
            <div className="flex h-screen bg-gray-900 text-white overflow-hidden">
                {/* Sidebar */}
                {!isFullScreenMode && (
                    <div className="w-80 bg-gray-800 p-6 flex flex-col border-r border-gray-700 z-10 shrink-0">
                        <div className="flex items-center gap-4 mb-8">
                            {selectedAccount?.foto ? <img src={selectedAccount.foto} className="w-12 h-12 rounded-full object-cover bg-gray-700" /> : <div className="w-12 h-12 rounded-full bg-indigo-600 flex items-center justify-center text-xl font-bold">{(selectedAccount?.nome || '?').charAt(0).toUpperCase()}</div>}
                            <h2 className="text-xl font-bold truncate">{selectedAccount?.nome}</h2>
                        </div>
                        <button className={`tv-focusable text-left p-4 rounded-xl mb-2 flex items-center gap-3 transition-colors ${currentTab === 'chats' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:bg-gray-700'}`} onClick={() => { setActiveChat(null); setActiveVideoFeed(null); setCurrentTab('chats'); }}>
                            <div className="icon-message-circle"></div> Chats
                        </button>
                        <button className={`tv-focusable text-left p-4 rounded-xl mb-2 flex items-center gap-3 transition-colors ${currentTab === 'social' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:bg-gray-700'}`} onClick={() => { setActiveChat(null); setCurrentTab('social'); if(posts.length>0) setActiveVideoFeed(0); }}>
                            <div className="icon-layout-grid"></div> Rede Social
                        </button>
                        <div className="flex-1"></div>
                        <button className="tv-focusable text-left p-4 rounded-xl flex items-center gap-3 text-red-400 hover:bg-gray-700 transition-colors" onClick={handleBack}>
                            <div className="icon-log-out"></div> Trocar Conta
                        </button>
                    </div>
                )}
                
                <div className="flex-1 flex flex-col relative overflow-hidden bg-gray-900">
                    
                    {/* Chat Area */}
                    {activeChat ? (
                        <div className="flex flex-col h-full absolute inset-0 bg-gray-900 z-20">
                            <div className="bg-gray-800 p-6 border-b border-gray-700 flex items-center gap-4 shrink-0 shadow-md">
                                <button className="tv-focusable p-3 bg-gray-700 rounded-full hover:bg-gray-600" onClick={() => setActiveChat(null)}>
                                    <div className="icon-arrow-left text-xl"></div>
                                </button>
                                {activeChat.avatar || usersData[activeChat.targetId || activeChat.id]?.profilePicture ? (
                                    <img src={activeChat.avatar || usersData[activeChat.targetId || activeChat.id].profilePicture} className="w-14 h-14 rounded-full object-cover bg-gray-700" />
                                ) : (
                                    <div className="w-14 h-14 rounded-full bg-indigo-600 flex items-center justify-center font-bold text-2xl">{(activeChat.name || 'C').charAt(0).toUpperCase()}</div>
                                )}
                                <h2 className="text-2xl font-bold">{activeChat.name}</h2>
                            </div>

                            <div className="flex-1 overflow-y-auto p-6 space-y-4">
                                {messages.map((msg) => {
                                    const isMe = msg.senderId === selectedAccount.uid;
                                    const encryptionKey = activeChat.type === 'group' ? activeChat.id : [selectedAccount.uid, (activeChat.targetId || activeChat.id.replace(selectedAccount.uid, '').replace('_', ''))].sort().join('_');
                                    const textContent = msg.type === 'text' && window.CryptoUtils ? window.CryptoUtils.decrypt(msg.text, encryptionKey) : msg.text;
                                    return (
                                        <div key={msg.key} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                                            <div className={`max-w-[70%] rounded-2xl px-6 py-4 ${isMe ? 'bg-indigo-600 text-white rounded-br-none' : 'bg-gray-800 text-gray-100 rounded-bl-none border border-gray-700'}`}>
                                                {!isMe && activeChat.type === 'group' && <span className="block text-sm font-bold text-indigo-400 mb-1">{msg.senderName}</span>}
                                                {msg.type === 'text' && <p className="text-xl leading-relaxed">{textContent}</p>}
                                                {msg.type === 'audio' && window.CustomAudioPlayer ? <window.CustomAudioPlayer src={msg.fileData} isOwn={isMe} /> : null}
                                                {msg.type === 'image' && <img src={msg.fileData} className="max-w-full rounded-xl max-h-96 object-contain" />}
                                                {msg.type === 'video' && <video src={msg.fileData} controls className="max-w-full rounded-xl max-h-96" />}
                                            </div>
                                        </div>
                                    );
                                })}
                                <div ref={messagesEndRef} />
                            </div>

                            <div className="bg-gray-800 p-6 border-t border-gray-700 shrink-0 flex flex-col gap-4">
                                <div className="flex items-center gap-4">
                                    <button 
                                        id="btn-record-audio"
                                        className={`tv-focusable p-4 rounded-full font-bold text-xl flex items-center justify-center transition-colors shadow-lg ${isRecording ? 'bg-red-500 animate-pulse' : 'bg-indigo-600 hover:bg-indigo-700'}`}
                                    >
                                        <div className="icon-mic text-2xl"></div>
                                    </button>
                                    <button 
                                        className={`tv-focusable p-4 rounded-full font-bold text-xl flex items-center justify-center transition-colors shadow-lg ${isVoiceToText ? 'bg-blue-500 animate-pulse' : 'bg-gray-700 hover:bg-gray-600'}`}
                                        onClick={toggleVoiceToText}
                                    >
                                        <div className="icon-audio-lines text-2xl"></div>
                                    </button>
                                    <input 
                                        type="text" 
                                        className="tv-focusable flex-1 bg-gray-900 border border-gray-700 rounded-xl px-4 py-4 text-xl outline-none focus:border-indigo-500" 
                                        placeholder="Digite uma mensagem..." 
                                        value={textInput} 
                                        onChange={e => setTextInput(e.target.value)}
                                        onKeyDown={e => { if(e.key==='Enter' && textInput.trim()) sendTextMessage(); }}
                                    />
                                    <button className="tv-focusable bg-indigo-600 p-4 rounded-xl hover:bg-indigo-700" onClick={() => sendTextMessage()}>
                                        <div className="icon-send text-2xl"></div>
                                    </button>
                                </div>
                                <p className="text-gray-400 text-sm text-center">Pressione e segure "OK" no botão de microfone para gravar áudio.</p>
                            </div>
                        </div>
                    ) : activeVideoFeed !== null ? (
                        /* TikTok Style Video Feed */
                        <div className="absolute inset-0 bg-black z-20 flex">
                            <div 
                                id="tv-video-player"
                                className="tv-focusable flex-1 relative h-full cursor-pointer group"
                                onClick={() => {
                                    const vid = document.getElementById(`tv-video-${activeVideoFeed}`);
                                    if (vid) {
                                        if (vid.paused) vid.play();
                                        else vid.pause();
                                    }
                                }}
                            >
                                {posts[activeVideoFeed] && (
                                    <>
                                        <video 
                                            id={`tv-video-${activeVideoFeed}`}
                                            src={posts[activeVideoFeed].mediaUrl} 
                                            autoPlay loop playsInline 
                                            className="w-full h-full object-contain pointer-events-none"
                                        />
                                        <div className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity" style={{ opacity: document.getElementById(`tv-video-${activeVideoFeed}`)?.paused ? 1 : 0 }}>
                                            <div className="w-24 h-24 bg-black/50 rounded-full flex items-center justify-center backdrop-blur-sm pointer-events-none">
                                                <div className="icon-play text-white text-5xl ml-2 opacity-90"></div>
                                            </div>
                                        </div>
                                        <div className="absolute bottom-0 left-0 right-0 p-8 bg-gradient-to-t from-black/80 to-transparent pointer-events-none">
                                            <h3 className="text-2xl font-bold">@{posts[activeVideoFeed].authorName}</h3>
                                            <p className="text-xl mt-2">{posts[activeVideoFeed].content}</p>
                                        </div>
                                    </>
                                )}
                            </div>
                            
                            {/* Actions Right Sidebar */}
                            <div className="w-24 bg-black/50 backdrop-blur-md flex flex-col items-center justify-end py-12 gap-8 border-l border-white/10 z-30">
                                <div className="relative">
                                    <img src={posts[activeVideoFeed]?.authorAvatar || 'https://via.placeholder.com/150'} className="w-14 h-14 rounded-full border-2 border-white object-cover" />
                                </div>
                                
                                <button className="tv-focusable flex flex-col items-center gap-2 group" onClick={() => handleSocialLike(posts[activeVideoFeed].id, posts[activeVideoFeed].hasLiked)}>
                                    <div className={`w-12 h-12 rounded-full flex items-center justify-center transition ${posts[activeVideoFeed]?.hasLiked ? 'text-red-500 bg-red-500/20' : 'text-white bg-white/10'}`}>
                                        <div className={`icon-heart text-3xl ${posts[activeVideoFeed]?.hasLiked ? 'fill-current' : ''}`}></div>
                                    </div>
                                    <span className="text-sm font-bold">{posts[activeVideoFeed]?.likesCount}</span>
                                </button>
                                
                                <button className="tv-focusable flex flex-col items-center gap-2 group" onClick={() => setShowComments(posts[activeVideoFeed])}>
                                    <div className="w-12 h-12 rounded-full flex items-center justify-center transition text-white bg-white/10">
                                        <div className="icon-message-circle text-3xl"></div>
                                    </div>
                                    <span className="text-sm font-bold">{posts[activeVideoFeed]?.commentsCount}</span>
                                </button>

                                <div className="mt-8 flex flex-col items-center gap-2">
                                    <div className="icon-arrow-up text-gray-400 text-xl animate-bounce"></div>
                                    <div className="icon-arrow-down text-gray-400 text-xl animate-bounce"></div>
                                </div>
                            </div>
                            
                            {/* Comments Overlay */}
                            {showComments && (
                                <div className="absolute top-0 right-24 bottom-0 w-[450px] bg-gray-900 border-l border-gray-700 flex flex-col shadow-2xl z-40">
                                    <div className="p-4 border-b border-gray-700 flex justify-between items-center bg-gray-800">
                                        <h3 className="font-bold text-xl">Comentários</h3>
                                        <button className="tv-focusable p-2 rounded-full hover:bg-gray-700" onClick={() => setShowComments(null)} id="btn-close-comments">
                                            <div className="icon-x text-xl"></div>
                                        </button>
                                    </div>
                                    <div className="flex-1 overflow-y-auto p-4 space-y-4">
                                        {showComments.comments && Object.keys(showComments.comments).length > 0 ? Object.values(showComments.comments).map((c, i) => (
                                            <div key={i} className="tv-focusable flex gap-3 p-2 rounded-lg outline-none">
                                                {c.authorAvatar ? (
                                                    <img src={c.authorAvatar} className="w-10 h-10 rounded-full object-cover shrink-0 bg-gray-800" />
                                                ) : (
                                                    <div className="w-10 h-10 rounded-full bg-indigo-600 flex items-center justify-center font-bold shrink-0">
                                                        {(c.authorName || '?').charAt(0)}
                                                    </div>
                                                )}
                                                <div>
                                                    <span className="font-bold text-sm text-gray-300 block">{c.authorName}</span>
                                                    <p className="text-gray-100 text-lg mt-1 leading-snug">{c.text}</p>
                                                </div>
                                            </div>
                                        )) : <p className="text-center text-gray-500 mt-10">Nenhum comentário. Pressione OK no campo abaixo para digitar.</p>}
                                    </div>
                                    <div className="p-4 border-t border-gray-700 bg-gray-800 shrink-0">
                                        <div className="flex gap-2">
                                            <input 
                                                type="text" 
                                                className="tv-focusable flex-1 bg-gray-900 border border-gray-600 rounded-xl px-4 py-3 outline-none focus:border-indigo-500 text-lg" 
                                                placeholder="Digite aqui..."
                                                id="comment-input"
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') {
                                                        const val = e.target.value;
                                                        if (val) {
                                                            handleSocialComment(showComments.id, val);
                                                            e.target.value = '';
                                                        }
                                                    }
                                                }}
                                            />
                                            <button className="tv-focusable bg-indigo-600 px-5 rounded-xl flex items-center justify-center hover:bg-indigo-700" onClick={() => {
                                                const el = document.getElementById('comment-input');
                                                if(el && el.value) {
                                                    handleSocialComment(showComments.id, el.value);
                                                    el.value = '';
                                                }
                                            }}>
                                                <div className="icon-send text-xl"></div>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        /* Normal Tab Views */
                        <div className="flex-1 p-10 overflow-y-auto">
                            {currentTab === 'chats' && (
                                <>
                                    <h1 className="text-4xl font-bold mb-8 flex items-center gap-4">
                                        <div className="icon-message-circle text-indigo-500"></div> Minhas Conversas
                                    </h1>
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                        {chats.map(chat => {
                                            const chatAvatar = chat.type === 'community' ? null : (chat.avatar || usersData[chat.targetId || chat.id]?.profilePicture);
                                            const isLocked = lockedChats[chat.id] && !unlockedForTv[chat.id];
                                            return (
                                                <div key={chat.id} className="tv-focusable bg-gray-800 border border-gray-700 p-6 rounded-2xl flex items-center gap-6 cursor-pointer hover:bg-gray-700 transition-colors relative" onClick={() => {
                                                    if (isLocked) {
                                                        setShowUnlockModal(chat);
                                                    } else {
                                                        setActiveChat(chat);
                                                    }
                                                }}>
                                                    {isLocked && <div className="absolute top-4 right-4"><div className="icon-lock text-red-400 text-xl"></div></div>}
                                                    {chatAvatar ? <img src={chatAvatar} className="w-16 h-16 rounded-full object-cover bg-gray-700 shrink-0 border-2 border-gray-600" /> : <div className="w-16 h-16 rounded-full bg-indigo-600 flex items-center justify-center font-bold text-2xl shrink-0">{(chat.name || 'C').charAt(0).toUpperCase()}</div>}
                                                    <div className="flex-1 min-w-0">
                                                        <h3 className="font-bold text-2xl truncate mb-1 pr-6">{chat.name}</h3>
                                                        <p className="text-gray-400 text-lg truncate">{isLocked ? 'Conversa Trancada' : 'Tocar para abrir'}</p>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                        
                                        {showUnlockModal && (
                                            <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-8">
                                                <div className="bg-gray-800 border border-gray-700 rounded-3xl p-8 max-w-lg w-full text-center shadow-2xl">
                                                    <div className="w-20 h-20 bg-gray-900 rounded-full flex items-center justify-center mx-auto mb-6">
                                                        <div className="icon-lock text-4xl text-indigo-500"></div>
                                                    </div>
                                                    <h2 className="text-2xl font-bold mb-4">Conversa Trancada</h2>
                                                    {authRequest === 'pending' ? (
                                                        <div>
                                                            <p className="text-gray-400 text-lg mb-6">Solicitação enviada. Aprove no seu dispositivo principal...</p>
                                                            <div className="icon-loader animate-spin text-4xl text-indigo-500 mx-auto"></div>
                                                            <button className="tv-focusable mt-8 px-6 py-3 bg-gray-700 rounded-xl hover:bg-gray-600" onClick={() => {
                                                                window.firebaseDB.ref(`users/${selectedAccount.uid}/authRequests/${deviceId}`).remove();
                                                                setAuthRequest(null);
                                                                setShowUnlockModal(null);
                                                            }}>Cancelar</button>
                                                        </div>
                                                    ) : (
                                                        <div>
                                                            <p className="text-gray-400 text-lg mb-6">Deseja pedir permissão para o dispositivo principal abrir este contato?</p>
                                                            <label className="flex items-center justify-center gap-3 mb-8 cursor-pointer group">
                                                                <input type="checkbox" className="tv-focusable w-6 h-6 rounded border-gray-600 bg-gray-900 text-indigo-600 focus:ring-indigo-500" checked={alwaysAllow} onChange={e => setAlwaysAllow(e.target.checked)} />
                                                                <span className="text-gray-300 text-lg group-hover:text-white">Deixar este dispositivo abrir sem senha futuramente</span>
                                                            </label>
                                                            <div className="flex gap-4 justify-center">
                                                                <button className="tv-focusable px-8 py-4 bg-gray-700 rounded-xl hover:bg-gray-600 text-lg font-bold transition-colors" onClick={() => setShowUnlockModal(null)}>Cancelar</button>
                                                                <button className="tv-focusable px-8 py-4 bg-indigo-600 rounded-xl hover:bg-indigo-700 text-lg font-bold transition-colors" onClick={() => {
                                                                    setAuthRequest('pending');
                                                                    const reqRef = window.firebaseDB.ref(`users/${selectedAccount.uid}/authRequests/${deviceId}`);
                                                                    reqRef.set({ chatId: showUnlockModal.id, alwaysAllow, status: 'pending', timestamp: Date.now() });
                                                                    reqRef.on('value', snap => {
                                                                        const val = snap.val();
                                                                        if (val && val.status === 'approved') {
                                                                            reqRef.off();
                                                                            reqRef.remove();
                                                                            setAuthRequest(null);
                                                                            setShowUnlockModal(null);
                                                                            setActiveChat(showUnlockModal);
                                                                        } else if (!val) {
                                                                            reqRef.off();
                                                                            setAuthRequest(null);
                                                                            setShowUnlockModal(null);
                                                                        }
                                                                    });
                                                                }}>Sim, permito</button>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </>
                            )}
                        </div>
                    )}
                </div>
            </div>
        );
    }

    return null;
}

window.TVApp = TVApp;