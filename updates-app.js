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
            <button onClick={() => window.location.reload()} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
              Recarregar Página
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const App = () => {
    const [userData, setUserData] = React.useState(null);
    const [loading, setLoading] = React.useState(true);

    React.useEffect(() => {
        const initializeApp = async () => {
            try {
                const savedKey = localStorage.getItem("userkey");
                if (!savedKey) {
                    window.location.href = 'index.html';
                    return;
                }

                const codeHubData = await window.api.getCodeHubUser(savedKey);
                if (!codeHubData || codeHubData.erro) {
                    localStorage.removeItem("userkey");
                    window.location.href = 'index.html';
                    return;
                }

                const firebaseData = await window.api.getFirebaseUser(codeHubData.uid || savedKey);
                
                const combinedData = {
                    ...codeHubData,
                    userKey: savedKey,
                    profilePicture: firebaseData?.profilePicture || null,
                    nome: firebaseData?.username || codeHubData.nome || 'Usuário'
                };
                
                setUserData(combinedData);
                setLoading(false);
            } catch (error) {
                console.error('Initialization error:', error);
                window.location.href = 'index.html';
            }
        };

        initializeApp();
    }, []);

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <div className="icon-loader text-4xl text-indigo-500 animate-spin"></div>
            </div>
        );
    }

    return (
        <React.Fragment>
            <PulseInterface user={{id: userData.uid || userData.userKey, name: userData.nome, avatar: userData.profilePicture}} />
        </React.Fragment>
    );
};

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
    <ErrorBoundary>
        <App />
    </ErrorBoundary>
);