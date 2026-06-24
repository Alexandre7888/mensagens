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
        const params = new URLSearchParams(window.location.search);
        const chatId = params.get("chatId");

        if (!chatId) {
          window.location.href = "index.html";
          return;
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
          setChatInfo({ id: chatId, type: chatData.type, name: chatData.name || 'Chat' });
        } else {
          window.location.href = "index.html";
          return;
        }

        setUserData({
          ...codeHubData,
          userKey: userKey,
          id: uid,
          name: firebaseData?.name || codeHubData.nome || 'Usuário',
          profilePicture: firebaseData?.profilePicture || null
        });
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, []);

  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="icon-loader text-4xl animate-spin text-indigo-600"></div></div>;
  if (!userData || !chatInfo) return null;

  return (
    <>
      <ChatRoom user={userData} chat={chatInfo} />
      <GlobalCallListener user={userData} />
    </>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<ErrorBoundary><ChatApp /></ErrorBoundary>);