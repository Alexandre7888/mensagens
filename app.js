class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo.componentStack);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="text-center p-8 bg-white rounded-lg shadow-md">
            <h1 className="text-2xl font-bold text-red-600 mb-4">Algo deu errado</h1>
            <p className="text-gray-600 mb-4">Ocorreu um erro inesperado.</p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Recarregar Página
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function App() {
  const [appState, setAppState] = React.useState('loading'); // loading, login, profile_setup, dashboard
  const [userData, setUserData] = React.useState(null);
  const [showTutorial, setShowTutorial] = React.useState(!localStorage.getItem("tutorialCompleted"));
  const [pendingTvAuth, setPendingTvAuth] = React.useState(null);

  React.useEffect(() => {
    // Register PWA Service Worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('./sw.js').catch(err => console.log('SW falhou', err));
    }

    // Init OneSignal
    const ONE_SIGNAL_APP_ID = "9d6e714d-c316-428d-80fa-ba51aaec2a18";
    if (ONE_SIGNAL_APP_ID !== "00000000-0000-0000-0000-000000000000") {
      window.OneSignalDeferred = window.OneSignalDeferred || [];
      window.OneSignalDeferred.push(async function(OneSignal) {
        try {
          // Evitar erro em domínios de preview
          if (window.location.hostname !== 'app.mensagens.site.je') {
            console.warn("OneSignal inicialização ignorada: o domínio atual não é app.mensagens.site.je.");
            return;
          }
          await OneSignal.init({
            appId: ONE_SIGNAL_APP_ID,
            safari_web_id: "web.onesignal.auto.468a09a1-a4c0-43e5-8472-22975b523798",
            notifyButton: {
              enable: true,
              size: 'medium',
              theme: 'default',
              position: 'bottom-right',
              text: {
                'tip.state.unsubscribed': 'Inscreva-se para notificações',
                'tip.state.subscribed': 'Você está inscrito',
                'tip.state.blocked': 'Você bloqueou as notificações',
                'message.prenotify': 'Clique para receber notificações do chat',
                'message.action.subscribed': 'Obrigado por se inscrever!',
                'message.action.resubscribed': 'Você está inscrito novamente',
                'message.action.unsubscribed': 'Você não receberá mais notificações'
              }
            }
          });
        } catch (error) {
          console.error("OneSignal init error:", error);
        }
      });
    } else {
      console.warn("OneSignal App ID is not configured. Push notifications are disabled to prevent errors.");
    }

        const initializeApp = async () => {
      try {
        // Verificação de URL com @usuario
        const searchStr = window.location.search;
        if (searchStr.startsWith('?@')) {
            const username = searchStr.substring(2).toLowerCase();
            // Vai ser tratado após o login ou redirecionar se já logado
            localStorage.setItem("pending_channel_redirect", username);
            window.history.replaceState({}, document.title, window.location.pathname);
        }

        const params = new URLSearchParams(window.location.search);
        let userKey = params.get("userKey");
        let tvAuthId = params.get("tvAuthId");
        const savedKey = localStorage.getItem("userkey");

        if (tvAuthId) {
            setPendingTvAuth(tvAuthId);
            // Remove from URL
            window.history.replaceState({}, document.title, window.location.pathname);
        }

        if (userKey) {
          localStorage.setItem("userkey", userKey);
          // Remove userKey from URL
          window.history.replaceState({}, document.title, window.location.pathname);
        } else if (savedKey) {
          userKey = savedKey;
        }

        if (!userKey) {
          setAppState('login');
          return;
        }

        // Fetch user data from CodeHUB
        const codeHubData = await api.getCodeHubUser(userKey);
        if (!codeHubData || codeHubData.erro) {
          localStorage.removeItem("userkey");
          setAppState('login');
          return;
        }

        // --- VERIFICAÇÃO DE BANIMENTO ---
        if (window.firebaseDB) {
           const banSnap = await window.firebaseDB.ref(`banned_users/${codeHubData.uid || userKey}`).once('value');
           const banData = banSnap.val();
           if (banData) {
              // Verifica se é um banimento temporário e já expirou
              if (banData.banUntil && Date.now() > banData.banUntil) {
                 // Auto-desbanir
                 if (banData.backup) {
                    const jsonString = decodeURIComponent(escape(atob(banData.backup)));
                    const userData = JSON.parse(jsonString);
                    await window.firebaseDB.ref(`users/${codeHubData.uid || userKey}`).set(userData);
                 }
                 await window.firebaseDB.ref(`banned_users/${codeHubData.uid || userKey}`).remove();
                 // Seguir o fluxo normal
              } else {
                 // Redirecionar para página de apelação
                 window.location.href = `appeal.html?uid=${codeHubData.uid || userKey}`;
                 return;
              }
           }
        }

        // Check Firebase for existing profile
        const firebaseData = await api.getFirebaseUser(codeHubData.uid || userKey);
        
        const combinedData = {
          ...codeHubData,
          userKey: userKey,
          profilePicture: firebaseData?.profilePicture || null
        };
        
        setUserData(combinedData);
        window.currentUserData = combinedData;
        
        if (window.SyncManager) {
            window.appSyncManager = new window.SyncManager(combinedData.uid || combinedData.userKey, 'mobile', null);
        }

        if (!firebaseData || !firebaseData.profilePicture) {
          setAppState('profile_setup');
        } else {
          // Solicitação automática de localização removida para não incomodar os usuários

          // Register OneSignal Listener if logged in
          if (window.OneSignalDeferred) {
            window.OneSignalDeferred.push(async function(OneSignal) {
              try {
                if (OneSignal.User && OneSignal.User.PushSubscription) {
                  // Check current subscription status immediately
                  const currentSub = OneSignal.User.PushSubscription;
                  if (currentSub && currentSub.optedIn && currentSub.id) {
                    if (window.firebaseDB) {
                      await window.firebaseDB.ref(`users/${combinedData.uid || combinedData.userKey}`).update({
                        oneSignalId: currentSub.id,
                        username: firebaseData.username || combinedData.nome
                      });
                    }
                  }

                  // Listen for future changes
                  OneSignal.User.PushSubscription.addEventListener("change", async (event) => {
                    try {
                      if (event.current && event.current.optedIn) {
                        const pushId = OneSignal.User.PushSubscription.id;
                        if (pushId && window.firebaseDB) {
                          await window.firebaseDB.ref(`users/${combinedData.uid || combinedData.userKey}`).update({
                            oneSignalId: pushId,
                            username: firebaseData.username || combinedData.nome
                          });
                        }
                      }
                    } catch (err) {
                      console.warn("OneSignal change event error:", err);
                    }
                  });
                }
              } catch (err) {
                console.warn("OneSignal push subscription logic error:", err);
              }
            });
          }
          // Handle Invites
          const joinGroup = params.get("joinGroup");
          const joinComm = params.get("joinComm");
          const addUser = params.get("addUser");
          
          if (addUser && window.firebaseDB) {
            if (addUser !== (combinedData.uid || combinedData.userKey)) {
              const targetSnap = await window.firebaseDB.ref(`users/${addUser}`).once('value');
              const targetData = targetSnap.val();
              if (targetData) {
                await window.firebaseDB.ref(`users/${combinedData.uid || combinedData.userKey}/chats/${addUser}`).set({
                  name: targetData.name || targetData.username,
                  type: 'direct',
                  timestamp: Date.now()
                });
                await window.firebaseDB.ref(`users/${addUser}/chats/${combinedData.uid || combinedData.userKey}`).set({
                  name: combinedData.nome || 'Usuário',
                  type: 'direct',
                  timestamp: Date.now()
                });
                window.location.href = `chat.html?chatId=${addUser}`;
                return;
              }
            }
          }

          if (joinGroup && window.firebaseDB) {
            const groupSnap = await window.firebaseDB.ref(`groups/${joinGroup}`).once('value');
            const groupData = groupSnap.val();
            if (groupData) {
              await window.firebaseDB.ref(`groups/${joinGroup}/members/${combinedData.uid || combinedData.userKey}`).set({ role: 'member', joinedAt: Date.now() });
              await window.firebaseDB.ref(`users/${combinedData.uid || combinedData.userKey}/chats/${joinGroup}`).set({
                name: groupData.name,
                type: 'group',
                timestamp: Date.now()
              });
              window.location.href = `chat.html?chatId=${joinGroup}`;
              return;
            }
          }

          if (joinComm && window.firebaseDB) {
            const commSnap = await window.firebaseDB.ref(`communities/${joinComm}`).once('value');
            const commData = commSnap.val();
            if (commData) {
              await window.firebaseDB.ref(`communities/${joinComm}/members/${combinedData.uid || combinedData.userKey}`).set({ role: 'membro', joinedAt: Date.now() });
              await window.firebaseDB.ref(`users/${combinedData.uid || combinedData.userKey}/communities/${joinComm}`).set({
                name: commData.name,
                role: 'membro',
                joinedAt: Date.now()
              });
              window.location.href = `community.html?commId=${joinComm}`;
              return;
            }
          }

          const pendingChannel = localStorage.getItem("pending_channel_redirect");
          if (pendingChannel && window.firebaseDB) {
              localStorage.removeItem("pending_channel_redirect");
              const usersSnap = await window.firebaseDB.ref('users').once('value');
              if (usersSnap.exists()) {
                  const usersData = usersSnap.val();
                  for (const [uid, uData] of Object.entries(usersData)) {
                      if (uData.username && uData.username.toLowerCase().replace(/\s/g, '') === pendingChannel) {
                          window.location.href = `channel.html?uid=${uid}`;
                          return;
                      }
                      if (uData.name && uData.name.toLowerCase().replace(/\s/g, '') === pendingChannel) {
                          window.location.href = `channel.html?uid=${uid}`;
                          return;
                      }
                      if (uData.nome && uData.nome.toLowerCase().replace(/\s/g, '') === pendingChannel) {
                          window.location.href = `channel.html?uid=${uid}`;
                          return;
                      }
                  }
              }
          }

          setAppState('dashboard');
        }

      } catch (error) {
        console.error('Initialization error:', error);
        setAppState('login');
      }
    };

    initializeApp();
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("userkey");
    setUserData(null);
    setAppState('login');
  };

  const handleProfileComplete = (updatedData) => {
    setUserData(updatedData);
    setAppState('dashboard');
  };

  try {
    if (appState === 'loading') {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-100">
          <div className="icon-loader text-4xl text-blue-500 animate-spin"></div>
        </div>
      );
    }

    return (
      <div className="h-screen w-screen overflow-hidden bg-gray-100" data-name="app" data-file="app.js">
        {appState === 'login' && <Login />}
        {appState === 'profile_setup' && <ProfileSetup userData={userData} onComplete={handleProfileComplete} />}
        {appState === 'dashboard' && (
          <>
            <ChatInterface user={{id: userData.uid || userData.userKey, name: userData.nome || 'Usuário', avatar: userData.profilePicture}} onLogout={handleLogout} />
            <GlobalCallListener user={{id: userData.uid || userData.userKey, name: userData.nome || 'Usuário', avatar: userData.profilePicture}} />
            {showTutorial && <TutorialOverlay onComplete={() => setShowTutorial(false)} />}
            {pendingTvAuth && window.DeviceManager && <window.DeviceManager initialScannedId={pendingTvAuth} onClose={() => setPendingTvAuth(null)} />}
          </>
        )}
      </div>
    );
  } catch (error) {
    console.error('App component error:', error);
    return null;
  }
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);
