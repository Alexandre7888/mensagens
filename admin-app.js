class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an error no Admin:', error, errorInfo.componentStack);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white">
          <div className="text-center p-8 bg-gray-800 rounded-lg shadow-md border border-red-500">
            <h1 className="text-2xl font-bold text-red-500 mb-4">Erro Crítico no Admin</h1>
            <p className="text-gray-300 mb-4">O sistema encontrou um erro.</p>
            <button onClick={() => window.location.reload()} className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700">Recarregar</button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function AdminApp() {
  const [authState, setAuthState] = React.useState('checking'); // checking, authorized, denied
  const [authReason, setAuthReason] = React.useState('');

  React.useEffect(() => {
    // Apenas aguarda o componente AdminAuth fazer a validação
  }, []);

  const handleAuthSuccess = () => {
    setAuthState('authorized');
  };

  const handleAuthFail = (reason) => {
    setAuthReason(reason || "Você não possui permissões ou não atende aos requisitos rigorosos de IP, Localização ou Dispositivo para acessar este painel.");
    setAuthState('denied');
  };

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100" data-name="admin-app" data-file="admin-app.js">
      {authState === 'checking' && <AdminAuth onSuccess={handleAuthSuccess} onFail={handleAuthFail} />}
      {authState === 'authorized' && <AdminPanel />}
      {authState === 'denied' && (
        <div className="min-h-screen flex items-center justify-center p-4">
          <div className="bg-gray-800 p-8 rounded-xl shadow-2xl max-w-md w-full text-center border border-red-900/50">
            <div className="w-20 h-20 bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
              <div className="icon-shield-alert text-4xl text-red-500"></div>
            </div>
            <h1 className="text-2xl font-bold text-red-500 mb-2">Acesso Negado</h1>
            <p className="text-gray-400 mb-6">{authReason}</p>
            <button onClick={() => window.location.reload()} className="px-6 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-white transition-colors">Tentar Novamente</button>
          </div>
        </div>
      )}
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <ErrorBoundary>
    <AdminApp />
  </ErrorBoundary>
);