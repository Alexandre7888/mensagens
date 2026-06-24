class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { hasError: false, error: null }; }
  static getDerivedStateFromError(error) { return { hasError: true, error }; }
  componentDidCatch(error, errorInfo) { console.error('BotInvite ErrorBoundary:', error, errorInfo); }
  render() {
    if (this.state.hasError) return <div className="p-8 text-center text-red-500 font-bold">Erro ao carregar o convite do bot.</div>;
    return this.props.children;
  }
}

function InviteBotApp() {
  const [userData, setUserData] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [inviteToken, setInviteToken] = React.useState(null);

  React.useEffect(() => {
    const init = async () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const token = params.get("token");
        if (!token) { window.location.href = "index.html"; return; }
        setInviteToken(token);

        const userKey = localStorage.getItem("userkey");
        if (!userKey) {
            // Se não estiver logado, poderia redirecionar para login passando a URL atual, mas vamos mandar pro index.
            window.location.href = `index.html?redirect=${encodeURIComponent(window.location.href)}`;
            return; 
        }
        
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
  if (!userData || !inviteToken) return null;

  return <BotInvite user={userData} token={inviteToken} />;
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<ErrorBoundary><InviteBotApp /></ErrorBoundary>);