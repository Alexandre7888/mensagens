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
        <BetaSocialNetwork 
            user={user} 
            onClose={() => window.location.href = 'index.html'} 
        />
    );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<SocialApp />);