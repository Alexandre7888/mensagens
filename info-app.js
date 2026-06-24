class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { hasError: false, error: null }; }
  static getDerivedStateFromError(error) { return { hasError: true, error }; }
  componentDidCatch(error, errorInfo) { console.error('Info ErrorBoundary:', error, errorInfo); }
  render() {
    if (this.state.hasError) {
      return <div className="min-h-screen flex items-center justify-center"><h1 className="text-red-500 font-bold">Erro ao carregar informações.</h1></div>;
    }
    return this.props.children;
  }
}

function InfoApp() {
  const [userData, setUserData] = React.useState(null);
  const [chatInfo, setChatInfo] = React.useState(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const init = async () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const chatId = params.get("chatId");
        if (!chatId) { window.location.href = "index.html"; return; }

        const userKey = localStorage.getItem("userkey");
        if (!userKey) { window.location.href = "index.html"; return; }

        const codeHubData = await api.getCodeHubUser(userKey);
        if (!codeHubData || codeHubData.erro) { window.location.href = "index.html"; return; }

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
          if (!chatData) { window.location.href = "index.html"; return; }
          setChatInfo({ id: chatId, ...chatData });
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

  return <InfoInterface user={userData} chat={chatInfo} />;
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<ErrorBoundary><InfoApp /></ErrorBoundary>);