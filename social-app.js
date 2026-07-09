class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        console.error("ErrorBoundary caught an error:", error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 p-6 text-center">
                    <div className="icon-circle-alert text-6xl text-red-500 mb-4"></div>
                    <h2 className="text-2xl font-bold text-gray-800 mb-2">Ops! Algo deu errado.</h2>
                    <p className="text-gray-600 mb-6">Tivemos um problema ao carregar a página.</p>
                    <div className="bg-white p-4 rounded shadow text-left text-sm text-red-600 max-w-lg w-full overflow-auto mb-6">
                        {this.state.error?.toString()}
                    </div>
                    <button 
                        onClick={() => window.location.href = 'index.html'} 
                        className="bg-indigo-600 text-white px-6 py-2 rounded-xl font-bold hover:bg-indigo-700 transition"
                    >
                        Voltar ao Início
                    </button>
                </div>
            );
        }
        return this.props.children;
    }
}

function SocialApp() {
    const [user, setUser] = React.useState(null);

    React.useEffect(() => {
        // Verifica se o usuário está logado através dos dados locais (similar ao app.js)
        const checkAuth = async () => {
            const savedKey = localStorage.getItem("userkey");
            if (!savedKey) {
                window.location.href = 'index.html';
                return;
            }
            try {
                // Para simplificar, utilizamos os dados globais ou fazemos fetch do usuário logado
                let userObj = null;
                if (window.currentUserData) {
                    userObj = {
                        id: window.currentUserData.uid || window.currentUserData.userKey,
                        name: window.currentUserData.nome || 'Usuário',
                        avatar: window.currentUserData.profilePicture
                    };
                } else {
                    const codeHubData = await window.api.getCodeHubUser(savedKey);
                    if (!codeHubData || codeHubData.erro) {
                        window.location.href = 'index.html';
                        return;
                    }
                    const firebaseData = await window.api.getFirebaseUser(codeHubData.uid || savedKey);
                    userObj = {
                        id: codeHubData.uid || savedKey,
                        name: codeHubData.nome || 'Usuário',
                        avatar: firebaseData?.profilePicture || null
                    };
                }
                localStorage.setItem('social_user_cache', JSON.stringify(userObj));
                setUser(userObj);
            } catch (e) {
                console.error("Erro na autenticação:", e);
                window.location.href = 'index.html';
            }
        };
        checkAuth();
    }, []);

    if (!user) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-100">
                <div className="icon-loader text-4xl text-indigo-500 animate-spin"></div>
            </div>
        );
    }

    return (
        <ErrorBoundary>
            <SocialNetwork 
                user={user} 
                onClose={() => window.location.href = 'index.html'} 
            />
        </ErrorBoundary>
    );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<SocialApp />);
