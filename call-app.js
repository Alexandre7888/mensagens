class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) { return { hasError: true, error }; }
  componentDidCatch(error, errorInfo) { console.error('Call ErrorBoundary:', error, errorInfo); }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white">
          <div className="text-center p-8 bg-gray-800 rounded-lg shadow-md">
            <h1 className="text-2xl font-bold text-red-500 mb-4">Erro na Chamada</h1>
            <button onClick={() => window.location.reload()} className="px-4 py-2 bg-indigo-600 rounded hover:bg-indigo-700">Recarregar</button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function CallApp() {
  const [userData, setUserData] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [callId, setCallId] = React.useState(null);

  React.useEffect(() => {
    const init = async () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const cid = params.get("callId");
        if (!cid) {
          window.location.href = "index.html";
          return;
        }
        setCallId(cid);

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
        setUserData({
          ...codeHubData,
          userKey: userKey,
          id: codeHubData.uid || userKey,
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

  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="icon-loader text-4xl animate-spin"></div></div>;
  if (!userData) return null;

  return <CallInterface user={userData} callId={callId} />;
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<ErrorBoundary><CallApp /></ErrorBoundary>);