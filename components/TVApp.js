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
    const [scale, setScale] = React.useState(1);
    
    const [textInput, setTextInput] = React.useState('');
    const [isRecording, setIsRecording] = React.useState(false);
    const [isVoiceToText, setIsVoiceToText] = React.useState(false);
    
    const [activeVideoFeed, setActiveVideoFeed] = React.useState(null);
    const [showComments, setShowComments] = React.useState(null);
    const [selectedMsgId, setSelectedMsgId] = React.useState(null);
    const [showSendConfirmTV, setShowSendConfirmTV] = React.useState(false);
    
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
        
        setTimeout(() => {
            if (savedAccounts.length === 0) {
                setAppState('auth');
                listenForAuth(savedDeviceId);
                setViewStack(['auth']);
            } else {
                setAppState('account_select');
                setViewStack(['account_select']);
            }
        }, 100);

        const handleResize = () => {
            const baseWidth = 1920;
            const baseHeight = 1080;
            const currentWidth = window.innerWidth;
            const currentHeight = window.innerHeight;
            
            const scaleX = currentWidth / baseWidth;
            const scaleY = currentHeight / baseHeight;
            
            setScale(Math.min(scaleX, scaleY));
        };

        window.addEventListener('resize', handleResize);
        handleResize();

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

        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Controle Remoto
    React.useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape' || e.key === 'Backspace' || e.key === 'GoBack') {
                if (showSendConfirmTV) { setShowSendConfirmTV(false); return; }
                if (showComments) { setShowComments(null); return; }
                if (activeVideoFeed !== null) { setActiveVideoFeed(null); return; }
                if (activeChat) { setActiveChat(null); return; }
                handleBack();
                return;
            }
            
            const focusableElements = Array.from(document.querySelectorAll('.tv-focusable:not([disabled])'));
            if (focusableElements.length === 0) return;

            let currentFocus = focusableElements.findIndex(el => el.classList.contains('tv-focused'));
            
            // Atalho para microfone
            if (activeChat && !showSendConfirmTV && currentFocus !== -1 && focusableElements[currentFocus].classList.contains('msg-item')) {
                if (e.key === 'ArrowDown') {
                    const allMsgs = Array.from(document.querySelectorAll('.msg-item'));
                    const index = allMsgs.indexOf(focusableElements[currentFocus]);
                    if (index >= allMsgs.length - 2) {
                        const micBtn = document.getElementById('btn-record-audio');
                        if (micBtn) {
                            e.preventDefault();
                            focusableElements[currentFocus].classList.remove('tv-focused');
                            micBtn.classList.add('tv-focused');
                            micBtn.focus();
                            return;
                        }
                    }
                }
            }

            if (selectedMsgId) {
                const popupBtns = Array.from(document.querySelectorAll('.msg-popup-btn'));
                if (popupBtns.length > 0) {
                    const currentIndex = popupBtns.indexOf(focusableElements[currentFocus]);
                    if (currentIndex !== -1) {
                        if (e.key === 'ArrowRight' && currentIndex < popupBtns.length - 1) {
                            focusableElements[currentFocus].classList.remove('tv-focused');
                            popupBtns[currentIndex + 1].classList.add('tv-focused');
                            return;
                        } else if (e.key === 'ArrowLeft' && currentIndex > 0) {
                            focusableElements[currentFocus].classList.remove('tv-focused');
                            popupBtns[currentIndex - 1].classList.add('tv-focused');
                            return;
                        } else if (e.key === 'ArrowDown') {
                            focusableElements[currentFocus].classList.remove('tv-focused');
                            const selectedMsg = document.querySelector('.msg-item.ring-4');
                            if (selectedMsg) selectedMsg.classList.add('tv-focused');
                            return;
                        } else if (e.key === 'Escape' || e.key === 'GoBack') {
                            setSelectedMsgId(null);
                            return;
                        }
                    }
                }
            }

            const bottomControls = ['btn-record-audio', 'btn-voice-text', 'chat-input-tv', 'btn-send-tv'];
            if (bottomControls.includes(focusableElements[currentFocus].id) && e.key === 'ArrowUp') {
                const msgs = Array.from(document.querySelectorAll('.msg-item'));
                if (msgs.length > 0) {
                    e.preventDefault();
                    focusableElements[currentFocus].classList.remove('tv-focused');
                    msgs[msgs.length - 1].classList.add('tv-focused');
                    msgs[msgs.length - 1].scrollIntoView({ behavior: 'smooth', block: 'center' });
                    return;
                }
            }

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
                    if (focusableElements[currentFocus].id === 'btn-record-audio') {
                        if (!isRecording) startAudioRecording();
                    } else if (focusableElements[currentFocus].id === 'btn-voice-text') {
                        if (!isVoiceToText) {
                            setTextInput('');
                            recognitionRef.current?.start();
                            setIsVoiceToText(true);
                        }
                    } else if (focusableElements[currentFocus].classList.contains('audio-player-tv')) {
                        const audioEl = focusableElements[currentFocus].querySelector('audio');
                        if (audioEl) {
                            if (audioEl.paused) audioEl.play();
                            else audioEl.pause();
                        }
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
                focusableElements[nextFocus].scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
            }
        };

        const handleKeyUp = (e) => {
            if (e.key === 'Enter' || e.key === 'Ok') {
                const focusableElements = Array.from(document.querySelectorAll('.tv-focusable.tv-focused'));
                if (focusableElements.length > 0) {
                    if (focusableElements[0].id === 'btn-record-audio') {
                        stopAudioRecording();
                    } else if (focusableElements[0].id === 'btn-voice-text') {
                        recognitionRef.current?.stop();
                        setIsVoiceToText(false);
                    }
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

    const prevRecordingRef = React.useRef(isRecording);
    React.useEffect(() => {
        if (prevRecordingRef.current !== isRecording) {
            setTimeout(() => {
                const micBtn = document.getElementById('btn-record-audio');
                if (micBtn) micBtn.classList.add('tv-focused');
            }, 50);
        }
        prevRecordingRef.current = isRecording;
    }, [isRecording]);

    React.useEffect(() => {
        setTimeout(() => {
            const elements = document.querySelectorAll('.tv-focusable:not([disabled])');
            let hasFocus = document.querySelector('.tv-focused');

            if (selectedMsgId) {
                const popupBtns = document.querySelectorAll('.msg-popup-btn');
                if (popupBtns.length > 0) {
                    elements.forEach(el => el.classList.remove('tv-focused'));
                    popupBtns[0].classList.add('tv-focused');
                }
                return;
            }
            
            if (showUnlockModal) {
                const btn = document.getElementById('btn-request-auth') || document.querySelector('.tv-focusable.bg-gray-600');
                if (btn) {
                    elements.forEach(el => el.classList.remove('tv-focused'));
                    btn.classList.add('tv-focused');
                }
                return;
            }

            if (showSendConfirmTV && document.getElementById('btn-confirm-send')) {
                elements.forEach(el => el.classList.remove('tv-focused'));
                document.getElementById('btn-confirm-send').classList.add('tv-focused');
                return;
            }

            if (showComments && document.getElementById('comment-input')) {
                elements.forEach(el => el.classList.remove('tv-focused'));
                document.getElementById('comment-input').classList.add('tv-focused');
                return;
            }

            if (elements.length > 0 && !hasFocus) {
                // Tenta focar na última mensagem enviada/recebida se estiver no chat
                const msgs = document.querySelectorAll('.msg-item');
                if (msgs.length > 0) {
                    msgs[msgs.length - 1].classList.add('tv-focused');
                } else {
                    elements[0].classList.add('tv-focused');
                }
            }
        }, 100);
    }, [appState, currentTab, activeChat, activeVideoFeed, showComments, showSendConfirmTV, messages.length]);

    React.useEffect(() => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: 'auto' });
        }
    }, [messages]);

    React.useEffect(() => {
        if (appState === 'main' && selectedAccount && window.firebaseDB) {
            const db = window.firebaseDB;
            const chatsRef = db.ref(`users/${selectedAccount.uid}/chats`).orderByChild('timestamp').limitToLast(30);
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

            const postsRef = db.ref('posts').orderByChild('timestamp').limitToLast(20);
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

    // Handle incoming Sync realtime events
    React.useEffect(() => {
        const handleRealtimeSync = (e) => {
            const { chatId, message, isDelete, msgId } = e.detail;
            if (activeChat && activeChat.id === chatId) {
                if (isDelete) {
                    setMessages(prev => {
                        const merged = prev.filter(m => m.key !== msgId);
                        localStorage.setItem(`local_history_${activeChat.id}`, JSON.stringify(merged.slice(-2000)));
                        return merged;
                    });
                } else if (message) {
                    setMessages(prev => {
                        if (!prev.find(m => m.key === message.key)) {
                            const merged = [...prev, message].sort((a,b) => a.timestamp - b.timestamp);
                            localStorage.setItem(`local_history_${activeChat.id}`, JSON.stringify(merged.slice(-2000)));
                            return merged;
                        }
                        return prev;
                    });
                }
            } else if (isDelete) {
                try {
                    const localKey = `local_history_${chatId}`;
                    const localHist = JSON.parse(localStorage.getItem(localKey)) || [];
                    const filtered = localHist.filter(m => m.key !== msgId);
                    localStorage.setItem(localKey, JSON.stringify(filtered));
                } catch(err) {}
            }
        };
        window.addEventListener('sync_realtime_msg', handleRealtimeSync);
        return () => window.removeEventListener('sync_realtime_msg', handleRealtimeSync);
    }, [activeChat]);

    React.useEffect(() => {
        if (activeChat && selectedAccount && window.firebaseDB) {
            const db = window.firebaseDB;
            const getTargetId = () => activeChat.targetId || activeChat.id.replace(selectedAccount.uid, '').replace('_', '');
            const sharedId = activeChat.type === 'group' ? activeChat.id : [selectedAccount.uid, getTargetId()].sort().join('_');
            
            let listenPath = activeChat.type === 'group' ? `groups/${activeChat.id}/messages` : `chats/${sharedId}/messages`;
            
            const handleData = (snapshot) => {
                const msgList = [];
                snapshot.forEach((child) => {
                    const msg = child.val();
                    msgList.push({ ...msg, key: child.key });
                    if (activeChat.type === 'group' && !usersData[msg.senderId] && msg.senderId !== selectedAccount.uid) {
                        db.ref(`users/${msg.senderId}/profilePicture`).once('value').then(snap => {
                            if (snap.exists()) {
                                setUsersData(prev => ({ ...prev, [msg.senderId]: { profilePicture: snap.val() } }));
                            }
                        });
                    }
                });
                
                if (msgList.length === 0) return;
                
                const localKey = `local_history_${activeChat.id}`;
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
                    merged.sort((a, b) => a.timestamp - b.timestamp);
                    if (merged.length > 2000) merged = merged.slice(merged.length - 2000);
                    localStorage.setItem(localKey, JSON.stringify(merged));
                    setMessages(merged);
                }
                
                if (activeChat.type !== 'group') {
                    msgList.forEach(msg => {
                        db.ref(`${listenPath}/${msg.key}`).remove().catch(console.error);
                    });
                }
            };

            const localKey = `local_history_${activeChat.id}`;
            try {
                const localHist = JSON.parse(localStorage.getItem(localKey));
                if (localHist && localHist.length > 0) {
                    localHist.sort((a, b) => a.timestamp - b.timestamp);
                    setMessages(localHist);
                }
            } catch(e) {}

            db.ref(listenPath).on('value', handleData);

            return () => db.ref(listenPath).off('value', handleData);
        }
    }, [activeChat, selectedAccount, usersData]);

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
        setAppState('loading');
        
        if (window.ChatP2P) {
            window.ChatP2P.initPeer(acc.uid, (msg) => {
                if (activeChat) {
                    const getTargetId = () => activeChat.targetId || activeChat.id.replace(acc.uid, '').replace('_', '');
                    const isFromCurrentChat = (activeChat.type === 'group' && msg.groupId === activeChat.id) || (msg.senderId === getTargetId());
                    
                    if (isFromCurrentChat) {
                        setMessages(prev => {
                            if (!prev.find(m => m.key === msg.key)) {
                                const newMsg = { ...msg, key: msg.key || `webrtc_${Date.now()}` };
                                const merged = [...prev, newMsg].sort((a,b) => a.timestamp - b.timestamp);
                                localStorage.setItem(`local_history_${activeChat.id}`, JSON.stringify(merged.slice(-2000)));
                                return merged;
                            }
                            return prev;
                        });
                    }
                }
            });
        }

        if (window.SyncManager) {
            window.tvSyncManager = new window.SyncManager(acc.uid, 'tv', (syncedHistory) => {
                for (const [key, history] of Object.entries(syncedHistory)) {
                    localStorage.setItem(key, JSON.stringify(history));
                }
                if (activeChat) {
                    const localKey = `local_history_${activeChat.id}`;
                    if (syncedHistory[localKey]) {
                        setMessages(syncedHistory[localKey]);
                    }
                }
            });
        }

        if (window.firebaseDB) {
            try {
                const fbNameSnap = await window.firebaseDB.ref(`users/${acc.uid}/name`).once('value');
                const fbPicSnap = await window.firebaseDB.ref(`users/${acc.uid}/profilePicture`).once('value');
                
                const name = fbNameSnap.val();
                const pic = fbPicSnap.val();
                
                if (pic && pic !== acc.foto) {
                    setSelectedAccount({ ...acc, foto: pic, nome: name || acc.nome });
                } else {
                    setSelectedAccount({ ...acc, nome: name || acc.nome });
                }
            } catch (e) {
                setSelectedAccount(acc);
            }
        } else {
            setSelectedAccount(acc);
        }
        setActiveChat(null);
        setCurrentTab('chats');
        navigateTo('main');
    };

    const sendTextMessage = async () => {
        if (!textInput.trim() || !activeChat) return;
        
        const db = window.firebaseDB;
        const getTargetId = () => activeChat.targetId || activeChat.id.replace(selectedAccount.uid, '').replace('_', '');
        
        const encryptedText = window.CryptoUtils ? window.CryptoUtils.encrypt(textInput.trim(), 'phantora-secret-key-123') : textInput.trim();
        const sharedChatId = activeChat.type === 'group' ? activeChat.id : [selectedAccount.uid, getTargetId()].sort().join('_');
        const writePath = activeChat.type === 'group' ? `groups/${activeChat.id}/messages` : `chats/${sharedChatId}`;
        
        const msgData = {
            senderId: selectedAccount.uid,
            senderName: selectedAccount.nome,
            type: 'text',
            text: encryptedText,
            timestamp: Date.now()
        };
        
        const uniqueKey = db.ref(writePath).push().key;
        const finalMsgData = { ...msgData, key: uniqueKey };
        
        await db.ref(`${writePath}/${uniqueKey}`).set(finalMsgData);
        
        if (activeChat.type !== 'group') {
            setMessages(prev => {
                const merged = [...prev, finalMsgData].sort((a,b) => a.timestamp - b.timestamp);
                localStorage.setItem(`local_history_${activeChat.id}`, JSON.stringify(merged.slice(-2000)));
                return merged;
            });
        }

        if (window.tvSyncManager) {
            window.tvSyncManager.broadcastMessage(activeChat.id, finalMsgData);
        }
        
        const chatUpdate = { lastMessage: encryptedText, timestamp: Date.now() };
        if (activeChat.type === 'group') {
            db.ref(`groups/${activeChat.id}/members`).once('value').then(snap => {
                const members = snap.val() || {};
                for (const uid of Object.keys(members)) {
                    db.ref(`users/${uid}/chats/${activeChat.id}`).update(chatUpdate);
                }
            });
        } else {
            db.ref(`users/${selectedAccount.uid}/chats/${activeChat.id}`).update(chatUpdate);
            const targetId = getTargetId();
            if (targetId && targetId !== selectedAccount.uid) {
                db.ref(`users/${targetId}/chats/${selectedAccount.uid}`).update({
                    ...chatUpdate,
                    name: selectedAccount.nome || 'Usuário',
                    type: 'direct',
                    targetId: selectedAccount.uid
                });
            }
        }
        
        setTextInput('');
        setShowSendConfirmTV(false);
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
                    const db = window.firebaseDB;
                    const getTargetId = () => activeChat.targetId || activeChat.id.replace(selectedAccount.uid, '').replace('_', '');
                    const writePath = activeChat.type === 'group' ? `groups/${activeChat.id}/messages` : `chats/${getTargetId()}`;
                    
                    const msgData = {
                        senderId: selectedAccount.uid,
                        senderName: selectedAccount.nome,
                        type: 'audio',
                        fileData: base64,
                        timestamp: Date.now()
                    };
                    
                    const uniqueKey = db.ref(writePath).push().key;
                    const finalMsgData = { ...msgData, key: uniqueKey };

                    let targetId = getTargetId();
                    let sentViaP2P = false;

                    if (activeChat.type === 'group') {
                        finalMsgData.groupId = activeChat.id;
                    }

                    if (window.ChatP2P) {
                        if (activeChat.type === 'group') {
                            try {
                                const snap = await db.ref(`groups/${activeChat.id}/members`).once('value');
                                const members = snap.val() || {};
                                const targetIds = Object.keys(members).filter(uid => uid !== selectedAccount.uid);
                                sentViaP2P = window.ChatP2P.sendMessage(selectedAccount.uid, targetIds, finalMsgData);
                            } catch(e) {}
                        } else if (targetId) {
                            sentViaP2P = window.ChatP2P.sendMessage(selectedAccount.uid, targetId, finalMsgData);
                        }
                    }
                    
                    await db.ref(`${writePath}/${uniqueKey}`).set(finalMsgData);
                    
                    if (activeChat.type !== 'group') {
                        setMessages(prev => {
                            if (!prev.find(m => m.key === finalMsgData.key)) {
                                const merged = [...prev, finalMsgData].sort((a,b) => a.timestamp - b.timestamp);
                                localStorage.setItem(`local_history_${activeChat.id}`, JSON.stringify(merged.slice(-2000)));
                                return merged;
                            }
                            return prev;
                        });
                    }

                    if (window.tvSyncManager) {
                        window.tvSyncManager.broadcastMessage(activeChat.id, finalMsgData);
                    }
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

    const toggleSelection = (msgId) => {
        setSelectedMsgId(prev => prev === msgId ? null : msgId);
    };

    const handleDeleteMessage = async (msgId, forEveryone) => {
        if (window.confirm(forEveryone ? "Apagar para todos?" : "Apagar para mim?")) {
            const db = window.firebaseDB;
            const getTargetId = () => activeChat.targetId || activeChat.id.replace(selectedAccount.uid, '').replace('_', '');
            
            if (forEveryone) {
                const writePath = activeChat.type === 'group' ? `groups/${activeChat.id}/messages` : `chats/${[selectedAccount.uid, getTargetId()].sort().join('_')}`;
                await db.ref(`${writePath}/${msgId}`).remove();
            }
            
            // Remove locally
            setMessages(prev => {
                const merged = prev.filter(m => m.key !== msgId);
                localStorage.setItem(`local_history_${activeChat.id}`, JSON.stringify(merged.slice(-2000)));
                return merged;
            });

            if (window.tvSyncManager) {
                window.tvSyncManager.broadcastDelete(activeChat.id, msgId);
            }

            setSelectedMsgId(null);
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
        return window.TVLoading ? <window.TVLoading /> : null;
    }

    if (appState === 'auth') {
        return window.TVAuth ? <window.TVAuth deviceId={deviceId} /> : null;
    }

    if (appState === 'account_select') {
        return window.TVAccountSelect ? <window.TVAccountSelect 
            accounts={accounts} 
            selectAccount={selectAccount} 
            listenForAuth={listenForAuth} 
            deviceId={deviceId} 
            navigateTo={navigateTo} 
        /> : null;
    }

    if (appState === 'main') {
        const isFullScreenMode = activeChat !== null || activeVideoFeed !== null;

        return (
            <div className="fixed inset-0 bg-[#0f172a] flex items-center justify-center overflow-hidden">
                <div 
                    className="flex text-white overflow-hidden origin-center absolute"
                    style={{ 
                        width: '1920px', 
                        height: '1080px',
                        transform: `scale(${scale})`,
                        top: '50%',
                        left: '50%',
                        marginTop: '-540px',
                        marginLeft: '-960px',
                    }}
                >
                <div className="w-full h-full flex gap-12 p-12 pt-[60px] pb-[80px] px-[80px] bg-transparent relative box-border">
                
                {/* Send Confirmation Modal */}
                {/* Unlock Modal for Private Chats */}
                {showUnlockModal && (
                    <div className="absolute inset-0 bg-black/90 flex items-center justify-center z-[100]">
                        <div className="bg-gray-800 p-8 rounded-3xl text-center shadow-2xl border border-gray-700 w-[500px]">
                            <div className="icon-lock text-6xl text-indigo-500 mb-6 mx-auto"></div>
                            <h2 className="text-3xl font-bold mb-4 text-white">Conversa Trancada</h2>
                            {authRequest ? (
                                <div>
                                    <p className="text-gray-400 text-xl mb-4">Solicitação enviada ao seu celular.</p>
                                    <p className="text-indigo-400 text-lg mb-8 animate-pulse">Aguardando autorização...</p>
                                </div>
                            ) : (
                                <p className="text-gray-400 text-xl mb-8">Esta conversa requer autenticação pelo celular.</p>
                            )}
                            
                            <div className="flex gap-4 justify-center">
                                {!authRequest && (
                                    <button id="btn-request-auth" className="tv-focusable bg-indigo-600 px-8 py-4 rounded-xl text-xl font-bold text-white w-full" onClick={() => {
                                        const db = window.firebaseDB;
                                        const reqId = `req_${Date.now()}`;
                                        setAuthRequest(reqId);
                                        db.ref(`users/${selectedAccount.uid}/authRequests/${reqId}`).set({
                                            chatId: showUnlockModal.id,
                                            chatName: showUnlockModal.name,
                                            deviceId: deviceId,
                                            status: 'pending',
                                            timestamp: Date.now(),
                                            alwaysAllow: false
                                        });

                                        db.ref(`users/${selectedAccount.uid}/authRequests/${reqId}/status`).on('value', snap => {
                                            const status = snap.val();
                                            if (status === 'approved') {
                                                db.ref(`users/${selectedAccount.uid}/authRequests/${reqId}/status`).off();
                                                db.ref(`users/${selectedAccount.uid}/authRequests/${reqId}`).remove();
                                                db.ref(`users/${selectedAccount.uid}/devices/${deviceId}/unlockedChats/${showUnlockModal.id}`).set(true);
                                                setShowUnlockModal(null);
                                                setAuthRequest(null);
                                                setActiveChat(showUnlockModal);
                                            } else if (status === 'denied') {
                                                db.ref(`users/${selectedAccount.uid}/authRequests/${reqId}/status`).off();
                                                setShowUnlockModal(null);
                                                setAuthRequest(null);
                                            }
                                        });
                                    }}>Solicitar Acesso</button>
                                )}
                                <button className="tv-focusable bg-gray-600 px-8 py-4 rounded-xl text-xl font-bold text-white w-full" onClick={() => {
                                    if (authRequest) {
                                        window.firebaseDB.ref(`users/${selectedAccount.uid}/authRequests/${authRequest}`).remove();
                                    }
                                    setShowUnlockModal(null);
                                    setAuthRequest(null);
                                }}>Cancelar</button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Send Confirmation Modal */}
                {showSendConfirmTV && (
                    <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-[100]">
                        <div className="bg-gray-800 p-8 rounded-3xl text-center shadow-2xl border border-gray-700">
                            <h2 className="text-3xl font-bold mb-8">Enviar mensagem?</h2>
                            <div className="flex gap-6 justify-center">
                                <button id="btn-confirm-send" className="tv-focusable bg-indigo-600 px-8 py-4 rounded-xl text-xl font-bold" onClick={sendTextMessage}>Enviar</button>
                                <button className="tv-focusable bg-gray-600 px-8 py-4 rounded-xl text-xl font-bold" onClick={() => setShowSendConfirmTV(false)}>Cancelar</button>
                            </div>
                        </div>
                    </div>
                )}

                {!isFullScreenMode && (
                    <div className="w-80 bg-gray-800/90 backdrop-blur-md p-8 flex flex-col border border-gray-700/50 rounded-[2rem] z-10 shrink-0 shadow-2xl">
                        <div className="flex items-center gap-3 mb-4 bg-gray-900/50 p-3 rounded-2xl border border-gray-700/50">
                            {selectedAccount?.foto ? <img src={selectedAccount.foto} className="w-10 h-10 rounded-full object-cover bg-gray-700 border border-gray-600" /> : <div className="w-10 h-10 rounded-full bg-indigo-600 flex items-center justify-center text-lg font-bold">{(selectedAccount?.nome || '?').charAt(0).toUpperCase()}</div>}
                            <h2 className="text-lg font-bold truncate text-gray-200">{selectedAccount?.nome}</h2>
                        </div>
                        <div className="mb-6">
                            {window.DeviceSyncStatus && <window.DeviceSyncStatus />}
                        </div>
                        <div className="space-y-3">
                            <button className={`tv-focusable w-full text-left p-4 rounded-xl flex items-center gap-4 transition-colors font-semibold ${currentTab === 'chats' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/50' : 'text-gray-400 hover:bg-gray-700 hover:text-white'}`} onClick={() => { setActiveChat(null); setActiveVideoFeed(null); setCurrentTab('chats'); }}>
                                <div className="icon-message-circle text-xl"></div> 
                                <span>Chats</span>
                            </button>
                            <button className={`tv-focusable w-full text-left p-4 rounded-xl flex items-center gap-4 transition-colors font-semibold ${currentTab === 'social' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/50' : 'text-gray-400 hover:bg-gray-700 hover:text-white'}`} onClick={() => { setActiveChat(null); setCurrentTab('social'); if(posts.length>0) setActiveVideoFeed(0); }}>
                                <div className="icon-layout-grid text-xl"></div> 
                                <span>Rede Social</span>
                            </button>
                        </div>
                        <div className="flex-1"></div>
                        <div className="space-y-3">
                            <button 
                                className="tv-focusable w-full text-left p-4 rounded-xl flex items-center gap-4 text-emerald-400 hover:bg-emerald-500/10 hover:text-emerald-300 transition-colors font-semibold" 
                                onClick={async () => {
                                    if (window.confirm('Atualizar aplicativo? Isso apagará os códigos cacheados e buscará a versão mais recente do servidor, mantendo seus arquivos.')) {
                                        if ('caches' in window) {
                                            try {
                                                const cacheNames = await caches.keys();
                                                await Promise.all(cacheNames.map(name => caches.delete(name)));
                                            } catch(e) {}
                                        }
                                        window.location.reload(true);
                                    }
                                }}
                            >
                                <div className="icon-refresh-cw text-xl"></div> 
                                <span>Atualizar App</span>
                            </button>
                            <button className="tv-focusable w-full text-left p-4 rounded-xl flex items-center gap-4 text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors font-semibold" onClick={handleBack}>
                                <div className="icon-log-out text-xl"></div> 
                                <span>Trocar Conta</span>
                            </button>
                        </div>
                    </div>
                )}
                
                <div className={`flex-1 flex flex-col relative overflow-hidden bg-gray-900/95 backdrop-blur-md ${!isFullScreenMode ? 'border border-gray-700/50 rounded-[2rem] shadow-2xl' : 'rounded-3xl'}`}>
                    
                    {activeChat ? (
                        <div className="flex flex-col h-full absolute inset-0 bg-gray-900 z-20">
                            <div className="bg-gray-800/90 backdrop-blur p-6 border-b border-gray-700/50 flex items-center gap-4 shrink-0 shadow-md rounded-t-[2rem]">
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
                                    const isSelected = selectedMsgId === msg.key;
                                    
                                    const textContent = msg.type === 'text' && window.CryptoUtils ? window.CryptoUtils.decrypt(msg.text, 'phantora-secret-key-123') : msg.text;
                                    return (
                                        <div key={msg.key} className={`flex ${isMe ? 'justify-end' : 'justify-start'} gap-3 mb-4`}>
                                            {!isMe && activeChat.type === 'group' && (
                                                <div className="shrink-0 mt-auto">
                                                    {usersData[msg.senderId]?.profilePicture ? (
                                                        <img src={usersData[msg.senderId].profilePicture} className="w-10 h-10 rounded-full object-cover border border-gray-600" />
                                                    ) : (
                                                        <div className="w-10 h-10 rounded-full bg-indigo-600 flex items-center justify-center font-bold text-sm">{(msg.senderName || 'U').charAt(0).toUpperCase()}</div>
                                                    )}
                                                </div>
                                            )}
                                            <div 
                                                className={`msg-item tv-focusable relative max-w-[70%] rounded-2xl px-6 py-4 outline-none ${isMe ? 'bg-indigo-600 text-white rounded-br-none' : 'bg-gray-800 text-gray-100 rounded-bl-none border border-gray-700'} ${isSelected ? 'ring-4 ring-indigo-400 scale-[1.02] z-10' : ''}`}
                                                onClick={() => toggleSelection(msg.key)}
                                            >
                                                {isSelected && (
                                                    <div className="absolute -top-20 right-0 flex gap-4 bg-gray-800 p-3 rounded-2xl z-20 shadow-2xl border border-gray-700">
                                                        <button 
                                                            onClick={(e) => { e.stopPropagation(); handleDeleteMessage(msg.key, false); }} 
                                                            className="tv-focusable msg-popup-btn text-white hover:text-gray-300 flex items-center justify-center p-3 rounded-xl hover:bg-gray-700" 
                                                            title="Apagar para mim"
                                                        >
                                                            <div className="icon-trash text-2xl"></div>
                                                        </button>
                                                        {isMe && (
                                                            <button 
                                                                onClick={(e) => { e.stopPropagation(); handleDeleteMessage(msg.key, true); }} 
                                                                className="tv-focusable msg-popup-btn text-red-500 hover:text-red-400 flex items-center justify-center p-3 rounded-xl hover:bg-gray-700" 
                                                                title="Apagar para todos"
                                                            >
                                                                <div className="icon-trash text-2xl"></div>
                                                            </button>
                                                        )}
                                                        <button 
                                                            onClick={(e) => { e.stopPropagation(); setSelectedMsgId(null); }} 
                                                            className="tv-focusable msg-popup-btn text-gray-400 hover:text-white flex items-center justify-center p-3 rounded-xl hover:bg-gray-700" 
                                                            title="Sair"
                                                        >
                                                            <div className="icon-door-open text-2xl"></div>
                                                        </button>
                                                    </div>
                                                )}
                                                
                                                {!isMe && activeChat.type === 'group' && <span className="block text-sm font-bold text-indigo-400 mb-1">{msg.senderName}</span>}
                                                {msg.type === 'text' && <p className="text-xl leading-relaxed">{textContent}</p>}
                                                {msg.type === 'audio' && window.CustomAudioPlayer ? (
                                                    <div className="tv-focusable audio-player-tv outline-none mt-2 p-1 rounded-xl" tabIndex="0">
                                                        <window.CustomAudioPlayer src={msg.fileData} isOwn={isMe} />
                                                    </div>
                                                ) : null}
                                                {msg.type === 'image' && <img src={msg.fileData} className="max-w-full rounded-xl max-h-96 object-contain" />}
                                                {msg.type === 'video' && <video src={msg.fileData} controls className="max-w-full rounded-xl max-h-96" />}
                                            </div>
                                        </div>
                                    );
                                })}
                                <div ref={messagesEndRef} />
                            </div>

                            <div className="bg-gray-800/90 backdrop-blur p-8 pb-10 border-t border-gray-700/50 shrink-0 flex flex-col gap-6 rounded-b-[2rem]">
                                <div className="flex items-center gap-6">
                                    <button 
                                        id="btn-record-audio"
                                        className={`tv-focusable p-5 rounded-full font-bold text-xl flex items-center justify-center transition-colors shadow-lg ${isRecording ? 'bg-red-600 scale-110' : 'bg-indigo-600 hover:bg-indigo-700'}`}
                                    >
                                        <div className="icon-mic text-2xl"></div>
                                    </button>
                                    <button 
                                        id="btn-voice-text"
                                        className={`tv-focusable p-5 rounded-full font-bold text-xl flex items-center justify-center transition-colors shadow-lg ${isVoiceToText ? 'bg-blue-500 animate-pulse scale-110' : 'bg-gray-700 hover:bg-gray-600'}`}
                                    >
                                        <div className="icon-audio-lines text-2xl"></div>
                                    </button>
                                    <input 
                                        id="chat-input-tv"
                                        type="text" 
                                        className="tv-focusable flex-1 bg-gray-900 border border-gray-700 rounded-2xl px-6 py-5 text-2xl outline-none focus:border-indigo-500" 
                                        placeholder="Digite uma mensagem..." 
                                        value={textInput} 
                                        onChange={e => setTextInput(e.target.value)}
                                    />
                                    <button id="btn-send-tv" className="tv-focusable bg-indigo-600 p-5 rounded-2xl hover:bg-indigo-700" onClick={() => {
                                        if (textInput.trim()) {
                                            setShowSendConfirmTV(true);
                                        }
                                    }}>
                                        <div className="icon-send text-3xl"></div>
                                    </button>
                                </div>
                                <p className="text-gray-400 text-base text-center pb-2">Pressione e segure "OK" no microfone para áudio ou texto.</p>
                            </div>
                        </div>
                    ) : activeVideoFeed !== null ? (
                        <div className="absolute inset-0 bg-black z-20 flex flex-col">
                            <div 
                                ref={videoContainerRef}
                                className="flex-1 w-full h-full snap-y snap-mandatory overflow-y-scroll no-scrollbar bg-black relative rounded-l-[2rem]"
                            >
                                {posts.map((vPost, index) => {
                                    const isVisible = index === activeVideoFeed;
                                    const isNear = Math.abs(index - activeVideoFeed) <= 1;
                                    return (
                                        <div key={vPost.id} data-index={index} className="w-full h-full snap-start snap-always relative flex items-center justify-center bg-black">
                                            <video 
                                                id={`tv-video-${index}`}
                                                src={isNear ? vPost.mediaUrl : ""} 
                                                autoPlay={isVisible} 
                                                loop 
                                                playsInline 
                                                preload={isVisible ? "auto" : "metadata"}
                                                className="w-full h-full object-contain pointer-events-none"
                                            />
                                            {isVisible && (
                                                <>
                                                    <div 
                                                        id={`tv-video-player`}
                                                        className="tv-focusable absolute inset-0 z-10 cursor-pointer"
                                                    ></div>
                                                    <div className="absolute bottom-0 left-0 right-32 p-8 bg-gradient-to-t from-black/80 to-transparent pointer-events-none z-20">
                                                        <h3 className="text-2xl font-bold text-white">@{vPost.authorName}</h3>
                                                        <p className="text-xl mt-2 text-white">{vPost.content}</p>
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                            
                            <div className="absolute right-0 top-0 bottom-0 w-32 bg-black/60 backdrop-blur-md flex flex-col items-center justify-end py-12 gap-8 border-l border-white/10 z-30 rounded-r-[2rem]">
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
                            </div>
                            
                            {showComments && (
                                <div className="absolute top-0 right-32 bottom-0 w-[500px] bg-gray-900 border-l border-gray-700 flex flex-col shadow-2xl z-40">
                                    <div className="p-6 border-b border-gray-700 flex justify-between items-center bg-gray-800">
                                        <h3 className="font-bold text-2xl">Comentários</h3>
                                        <button className="tv-focusable p-3 rounded-full hover:bg-gray-700" onClick={() => setShowComments(null)} id="btn-close-comments">
                                            <div className="icon-x text-2xl"></div>
                                        </button>
                                    </div>
                                    <div className="flex-1 overflow-y-auto p-6 space-y-6">
                                        {showComments.comments && Object.keys(showComments.comments).length > 0 ? Object.values(showComments.comments).map((c, i) => (
                                            <div key={i} className="tv-focusable flex gap-4 p-3 rounded-xl outline-none">
                                                {c.authorAvatar ? (
                                                    <img src={c.authorAvatar} className="w-12 h-12 rounded-full object-cover shrink-0 bg-gray-800" />
                                                ) : (
                                                    <div className="w-12 h-12 rounded-full bg-indigo-600 flex items-center justify-center font-bold shrink-0 text-lg">
                                                        {(c.authorName || '?').charAt(0)}
                                                    </div>
                                                )}
                                                <div>
                                                    <span className="font-bold text-lg text-gray-300 block">{c.authorName}</span>
                                                    <p className="text-gray-100 text-xl mt-1 leading-snug">{c.text}</p>
                                                </div>
                                            </div>
                                        )) : <p className="text-center text-gray-500 mt-10 text-xl">Nenhum comentário.</p>}
                                    </div>
                                    <div className="p-6 border-t border-gray-700 bg-gray-800 shrink-0">
                                        <div className="flex gap-4">
                                            <input 
                                                type="text" 
                                                className="tv-focusable flex-1 bg-gray-900 border border-gray-600 rounded-xl px-6 py-4 outline-none focus:border-indigo-500 text-xl" 
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
                                            <button className="tv-focusable bg-indigo-600 px-6 rounded-xl flex items-center justify-center hover:bg-indigo-700" onClick={() => {
                                                const el = document.getElementById('comment-input');
                                                if(el && el.value) {
                                                    handleSocialComment(showComments.id, el.value);
                                                    el.value = '';
                                                }
                                            }}>
                                                <div className="icon-send text-2xl"></div>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="flex-1 p-10 overflow-y-auto">
                            {currentTab === 'chats' && (
                                <>
                                    <h1 className="text-3xl font-bold mb-6 flex items-center gap-3 text-gray-100">
                                        <div className="icon-message-circle text-indigo-500"></div> Minhas Conversas
                                    </h1>
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                                        {chats.map(chat => {
                                            const chatAvatar = chat.type === 'community' ? null : (chat.avatar || 'https://via.placeholder.com/150');
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
                                    </div>
                                </>
                            )}
                        </div>
                    )}
                </div>
                </div>
                </div>
            </div>
        );
    }

    return null;
}

window.TVApp = TVApp;