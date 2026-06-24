class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { hasError: false, error: null }; }
  static getDerivedStateFromError(error) { return { hasError: true, error }; }
  componentDidCatch(error, errorInfo) { console.error('Bots ErrorBoundary:', error, errorInfo); }
  render() {
    if (this.state.hasError) return <div className="p-8 text-center text-red-500 font-bold">Erro ao carregar o gerenciador de bots.</div>;
    return this.props.children;
  }
}

function BotsApp() {
  const [userData, setUserData] = React.useState(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const init = async () => {
      try {
        const userKey = localStorage.getItem("userkey");
        if (!userKey) { window.location.href = "index.html"; return; }
        
        const codeHubData = await api.getCodeHubUser(userKey);
        if (!codeHubData || codeHubData.erro) { window.location.href = "index.html"; return; }
        
        if (window.firebaseDB) {
           const banSnap = await window.firebaseDB.ref(`banned_users/${codeHubData.uid || userKey}`).once('value');
           const banData = banSnap.val();
           if (banData) {
              if (banData.banUntil && Date.now() > banData.banUntil) {
                 if (banData.backup) {
                    const jsonString = decodeURIComponent(escape(atob(banData.backup)));
                    const userData = JSON.parse(jsonString);
                    await window.firebaseDB.ref(`users/${codeHubData.uid || userKey}`).set(userData);
                 }
                 await window.firebaseDB.ref(`banned_users/${codeHubData.uid || userKey}`).remove();
              } else {
                 window.location.href = `appeal.html?uid=${codeHubData.uid || userKey}`;
                 return;
              }
           }
        }

        const firebaseData = await api.getFirebaseUser(codeHubData.uid || userKey);
        
        setUserData({
          ...codeHubData,
          userKey: userKey,
          id: codeHubData.uid || userKey,
          name: firebaseData?.name || codeHubData.nome || 'Usuário',
          username: firebaseData?.username || '',
          profilePicture: firebaseData?.profilePicture || null
        });
      } catch (err) { console.error(err); } finally { setLoading(false); }
    };
    init();
  }, []);

  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="icon-loader text-4xl animate-spin text-indigo-600"></div></div>;
  if (!userData) return null;

  return <BotManager user={userData} />;
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<ErrorBoundary><BotsApp /></ErrorBoundary>);