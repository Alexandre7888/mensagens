class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) { return { hasError: true, error }; }
  componentDidCatch(error, errorInfo) { console.error('Chat ErrorBoundary:', error, errorInfo); }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-100">
          <div className="text-center p-8 bg-white rounded-lg shadow-md">
            <h1 className="text-2xl font-bold text-red-500 mb-4">Erro no Chat</h1>
            <button onClick={() => window.location.reload()} className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700">Recarregar</button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function ChatApp() {
  const [userData, setUserData] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [chatInfo, setChatInfo] = React.useState(null);

  React.useEffect(() => {
    const init = async () => {
      try {
        if (window.ModerationSystem) {
          await window.ModerationSystem.init();
        }
        const params = new URLSearchParams(window.location.search);
        let chatId = params.get("chatId");
        const aliasId = params.get("c");

        if (!chatId && !aliasId) {
          window.location.href = "index.html";
          return;
        }

        if (aliasId && window.firebaseDB) {
            const aliasSnap = await window.firebaseDB.ref(`chat_aliases/${aliasId}`).once('value');
            if (aliasSnap.exists()) {
                chatId = aliasSnap.val().realId;
            } else {
                window.location.href = "index.html";
                return;
            }
        }

        const userKey = localStorage.getItem("userkey");
        if (!userKey) {
          window.location.href = "index.html";
          return;
        }

        const codeHubData = await api.getCodeHubUser(userKey);
        if (!codeHubData || codeHubData.erro) {
          window.location.href = "index.html";
          return;
        }

        const uid = codeHubData.uid || userKey;
        
        if (window.firebaseDB) {
           const banSnap = await window.firebaseDB.ref(`banned_users/${uid}`).once('value');
           const banData = banSnap.val();
           if (banData) {
              if (banData.banUntil && Date.now() > banData.banUntil) {
                 if (banData.backup) {
                    const jsonString = decodeURIComponent(escape(atob(banData.backup)));
                    const userData = JSON.parse(jsonString);
                    await window.firebaseDB.ref(`users/${uid}`).set(userData);
                 }
                 await window.firebaseDB.ref(`banned_users/${uid}`).remove();
              } else {
                 window.location.href = `appeal.html?uid=${uid}`;
                 return;
              }
           }
        }

        const firebaseData = await api.getFirebaseUser(uid);

        if (window.firebaseDB) {
          const chatSnap = await window.firebaseDB.ref(`users/${uid}/chats/${chatId}`).once('value');
          const chatData = chatSnap.val();
          if (!chatData) {
            window.location.href = "index.html";
            return;
          }

          // If accessed via chatId, mask it in URL
          if (!aliasId) {
              let existingAlias = chatData.aliasId;
              if (!existingAlias) {
                  existingAlias = `c_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                  await window.firebaseDB.ref(`users/${uid}/chats/${chatId}`).update({ aliasId: existingAlias });
                  await window.firebaseDB.ref(`chat_aliases/${existingAlias}`).set({ realId: chatId });
              }
              window.history.replaceState(null, '', `chat.html?c=${existingAlias}`);
          }

          setChatInfo({ id: chatId, type: chatData.type, name: chatData.name || 'Chat' });
        } else {
          window.location.href = "index.html";
          return;
        }

        const finalUserData = {
          ...codeHubData,
          userKey: userKey,
          id: uid,
          name: firebaseData?.name || codeHubData.nome || 'Usuário',
          profilePicture: firebaseData?.profilePicture || null
        };
        setUserData(finalUserData);

        if (window.firebaseDB) {
            const userRef = window.firebaseDB.ref(`users/${uid}`);
            userRef.update({
                isOnline: true,
                lastSeen: firebase.database.ServerValue.TIMESTAMP
            });
            userRef.onDisconnect().update({
                isOnline: false,
                lastSeen: firebase.database.ServerValue.TIMESTAMP
            });
        }

        if (window.SyncManager && !window.appSyncManager) {
            window.appSyncManager = new window.SyncManager(uid, 'mobile', null);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, []);

  const [messages, setMessages] = React.useState([]);
  const [targetUserStatus, setTargetUserStatus] = React.useState(null);
  const [selectedMessages, setSelectedMessages] = React.useState([]);
  const [replyingTo, setReplyingTo] = React.useState(null);

  React.useEffect(() => {
      window.selectedMessagesCallback = (msgs) => {
          setSelectedMessages(msgs);
      };
  }, []);

  React.useEffect(() => {
      if (!chatInfo || chatInfo.type === 'group') return;
      const db = window.firebaseDB;
      if (!db) return;
      
      const targetId = chatInfo.targetId || chatInfo.id;
      const targetRef = db.ref(`users/${targetId}`);
      
      const onStatusChange = targetRef.on('value', snap => {
          setTargetUserStatus(snap.val());
      });
      
      return () => targetRef.off('value', onStatusChange);
  }, [chatInfo]);

  React.useEffect(() => {
      if (!userData || !chatInfo) return;
      const db = window.firebaseDB;
      if (!db) return;

      const sharedId = (chatInfo.id && chatInfo.id.startsWith('chat_')) ? chatInfo.id : [userData.id, chatInfo.id].sort().join('_');
      const refPath = chatInfo.type === 'group' ? `groups/${chatInfo.id}/messages` : `chats/${sharedId}/messages`;
      
      const messagesRef = db.ref(refPath);
      messagesRef.on('value', (snapshot) => {
          const data = snapshot.val();
          if (data) {
              const msgList = Object.keys(data).map(key => ({ ...data[key], key }));
              setMessages(msgList);
          } else {
              setMessages([]);
          }
      });

      return () => messagesRef.off();
  }, [userData, chatInfo]);

  const handleSendMessage = async (text) => {
      if (!text.trim() || !userData || !chatInfo) return;
      const db = window.firebaseDB;
      const sharedId = (chatInfo.id && chatInfo.id.startsWith('chat_')) ? chatInfo.id : [userData.id, chatInfo.id].sort().join('_');
      const refPath = chatInfo.type === 'group' ? `groups/${chatInfo.id}/messages` : `chats/${sharedId}/messages`;
      
      const msgData = {
          senderId: userData.id,
          senderName: userData.name,
          type: 'text',
          text: text.trim(),
          timestamp: Date.now(),
          replyTo: replyingTo ? {
              id: replyingTo.key || replyingTo.id,
              senderName: replyingTo.senderName,
              text: replyingTo.type === 'text' ? replyingTo.text : (replyingTo.type === 'audio' ? 'Áudio' : 'Mídia')
          } : null
      };
      
      setReplyingTo(null);
      
      const uniqueKey = db.ref(refPath).push().key;
      const finalMsgData = { ...msgData, key: uniqueKey };
      await db.ref(`${refPath}/${uniqueKey}`).set(finalMsgData);
      
      if (window.appSyncManager) {
          window.appSyncManager.broadcastMessage(chatInfo.id, finalMsgData);
      }

      const chatUpdate = { lastMessage: text.trim(), timestamp: Date.now() };
      await db.ref(`users/${userData.id}/chats/${chatInfo.id}`).update(chatUpdate);
      if (chatInfo.type !== 'group') {
          const targetId = chatInfo.targetId || chatInfo.id;
          if (targetId !== userData.id) {
              await db.ref(`users/${targetId}/chats/${chatInfo.id}`).update(chatUpdate);
          }
      }
  };

  const handleSendAudio = async (audioBlob) => {
      if (!userData || !chatInfo) return;
      const db = window.firebaseDB;
      const reader = new FileReader();
      reader.readAsDataURL(audioBlob);
      reader.onload = async () => {
          const base64 = reader.result;
          const sharedId = (chatInfo.id && chatInfo.id.startsWith('chat_')) ? chatInfo.id : [userData.id, chatInfo.id].sort().join('_');
          const refPath = chatInfo.type === 'group' ? `groups/${chatInfo.id}/messages` : `chats/${sharedId}/messages`;
          
          const msgData = {
              senderId: userData.id,
              senderName: userData.name,
              type: 'audio',
              fileData: base64,
              timestamp: Date.now()
          };
          
          const uniqueKey = db.ref(refPath).push().key;
          const finalMsgData = { ...msgData, key: uniqueKey };
          await db.ref(`${refPath}/${uniqueKey}`).set(finalMsgData);
          
          if (window.appSyncManager) {
              window.appSyncManager.broadcastMessage(chatInfo.id, finalMsgData);
          }
      };
  };

  React.useEffect(() => {
        const handleRealtimeSync = (e) => {
            const { chatId, message, isDelete, msgId } = e.detail;
            if (chatInfo && chatInfo.id === chatId) {
                if (isDelete) {
                    setMessages(prev => prev.filter(m => m.key !== msgId));
                } else if (message) {
                    setMessages(prev => {
                        if (!prev.find(m => m.key === message.key)) {
                            return [...prev, message].sort((a,b) => a.timestamp - b.timestamp);
                        }
                        return prev;
                    });
                }
            }
        };
        window.addEventListener('sync_realtime_msg', handleRealtimeSync);
        return () => window.removeEventListener('sync_realtime_msg', handleRealtimeSync);
  }, [chatInfo]);

  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="icon-loader text-4xl animate-spin text-indigo-600"></div></div>;
  if (!userData || !chatInfo) return null;

  const handleDeleteSelected = async (forEveryone) => {
        if (!selectedMessages.length) return;
        if (window.confirm(forEveryone ? "Apagar para todos?" : "Apagar para mim?")) {
            const db = window.firebaseDB;
            const sharedId = (chatInfo.id && chatInfo.id.startsWith('chat_')) ? chatInfo.id : [userData.id, chatInfo.id].sort().join('_');
            const refPath = chatInfo.type === 'group' ? `groups/${chatInfo.id}/messages` : `chats/${sharedId}/messages`;
            
            for (const msgId of selectedMessages) {
                 if (forEveryone) {
                     const msgRef = db.ref(`${refPath}/${msgId}`);
                     const snap = await msgRef.once('value');
                     if (snap.exists() && snap.val().senderId === userData.id) {
                         await msgRef.remove();
                     }
                 } else {
                     // Local delete mock logic if needed, or remove completely if local logic applies
                     await db.ref(`${refPath}/${msgId}`).remove(); // Simplified to just remove for now
                 }
            }
            setSelectedMessages([]);
        }
  };

  return (
    <div className="flex flex-col h-screen bg-gray-100">
      {selectedMessages.length > 0 ? (
          <div className="bg-indigo-600 text-white border-b px-4 py-3 flex items-center gap-3 shadow-sm z-10 sticky top-0">
              <button onClick={() => setSelectedMessages([])} className="p-2 -ml-2 rounded-full hover:bg-indigo-700 transition-colors">
                  <div className="icon-x text-xl"></div>
              </button>
              <div className="flex-1 font-bold flex items-center gap-3">
                  {selectedMessages.length} selecionada(s)
                  <button onClick={() => {
                      if (selectedMessages.length === messages.length) {
                          setSelectedMessages([]);
                      } else {
                          setSelectedMessages(messages.map(m => m.key || m.id));
                      }
                  }} className="text-xs font-bold underline text-indigo-200 hover:text-white">
                      {selectedMessages.length === messages.length ? "Desmarcar Todos" : "Selecionar Tudo"}
                  </button>
              </div>
              <div className="flex gap-2">
                  <button className="p-2 rounded-full hover:bg-indigo-700 transition-colors" title="Apagar para mim" onClick={() => handleDeleteSelected(false)}>
                      <div className="icon-trash text-xl"></div>
                  </button>
                  <button className="p-2 rounded-full hover:bg-indigo-700 transition-colors text-red-300" title="Apagar para todos" onClick={() => handleDeleteSelected(true)}>
                      <div className="icon-trash text-xl"></div>
                  </button>
              </div>
          </div>
      ) : (
          <div className="bg-white border-b px-4 py-3 flex items-center gap-3 shadow-sm z-10 sticky top-0">
              <button onClick={() => window.location.href = 'index.html'} className="p-2 -ml-2 rounded-full hover:bg-gray-100 text-gray-600 transition-colors">
                  <div className="icon-arrow-left text-xl"></div>
              </button>
              <div className="flex items-center gap-3 flex-1 cursor-pointer" onClick={() => window.location.href = `info.html?chatId=${chatInfo.id}`}>
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white font-bold shadow-sm shrink-0">
                      {chatInfo.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0 flex items-center justify-between">
                      <div className="flex flex-col justify-center">
                          <h2 className="font-bold text-gray-800 leading-tight truncate pr-2">{chatInfo.name}</h2>
                          {chatInfo.type !== 'group' && targetUserStatus && targetUserStatus.showOnlineStatus !== false && (
                              <span className="text-[11px] leading-tight mt-0.5 font-medium transition-colors">
                                  {targetUserStatus.isOnline ? (
                                      <span className="text-green-500">Online</span>
                                  ) : (
                                      <span className="text-gray-400">Visto por último às {new Date(targetUserStatus.lastSeen || Date.now()).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                                  )}
                              </span>
                          )}
                      </div>
                      {window.DeviceSyncStatus && <window.DeviceSyncStatus />}
                  </div>
              </div>
              <button onClick={() => window.location.href = `info.html?chatId=${chatInfo.id}`} className="p-2 rounded-full hover:bg-gray-100 text-gray-600 transition-colors hidden sm:block">
                  <div className="icon-info text-xl"></div>
              </button>
          </div>
      )}

      <div className="flex-1 overflow-hidden flex flex-col relative">
          <ChatRoom messages={messages} currentUser={userData} onReply={(msg) => setReplyingTo(msg)} />
      </div>

      <ChatInput onSendMessage={handleSendMessage} onSendAudio={handleSendAudio} replyingTo={replyingTo} onCancelReply={() => setReplyingTo(null)} />

      <GlobalCallListener user={userData} />
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<ErrorBoundary><ChatApp /></ErrorBoundary>);
