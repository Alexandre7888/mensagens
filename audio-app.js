const root = ReactDOM.createRoot(document.getElementById('root'));

function App() {
    const [user, setUser] = React.useState(null);
    const [loading, setLoading] = React.useState(true);

    React.useEffect(() => {
        const init = async () => {
            const savedKey = localStorage.getItem('userkey');
            if (savedKey) {
                try {
                    let userObj = null;
                    if (window.currentUserData) {
                        userObj = {
                            id: window.currentUserData.uid || window.currentUserData.userKey,
                            name: window.currentUserData.nome || 'Usuário',
                            avatar: window.currentUserData.profilePicture
                        };
                    } else {
                        const codeHubData = await window.api.getCodeHubUser(savedKey);
                        if (codeHubData && !codeHubData.erro) {
                            userObj = {
                                id: codeHubData.uid || savedKey,
                                name: codeHubData.nome || 'Usuário',
                                avatar: ''
                            };
                        }
                    }
                    setUser(userObj);
                } catch (e) {
                    console.error("Erro:", e);
                }
            }
            setLoading(false);
        };
        init();
    }, []);

    if (loading) return <div className="flex h-screen items-center justify-center bg-gray-900"><div className="icon-loader animate-spin text-4xl text-indigo-500"></div></div>;
    if (!user) return <div className="p-8 text-center text-white bg-gray-900 h-screen">Faça login para continuar. <a href="index.html" className="text-indigo-400">Voltar</a></div>;

    return <AudioPage user={user} />;
}

root.render(<App />);