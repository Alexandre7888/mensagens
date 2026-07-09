const root = ReactDOM.createRoot(document.getElementById('root'));

function App() {
    const [user, setUser] = React.useState(null);
    const [loading, setLoading] = React.useState(true);
    const [channelUserId, setChannelUserId] = React.useState(null);
    const [errorLog, setErrorLog] = React.useState('');

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
                        if (!codeHubData || codeHubData.erro) {
                            throw new Error("Sessão inválida ou expirada");
                        }
                        const db = window.firebaseDB;
                        let firebaseAvatar = '';
                        let firebaseName = codeHubData.nome || 'Usuário';
                        
                        if (db) {
                            const snap = await db.ref(`users/${codeHubData.uid || savedKey}`).once('value');
                            if (snap.exists()) {
                                const dbData = snap.val();
                                firebaseName = dbData.nome || codeHubData.nome || 'Usuário';
                                firebaseAvatar = dbData.profilePicture || '';
                                window.currentUserData = dbData;
                            }
                        }
                        
                        userObj = {
                            id: codeHubData.uid || savedKey,
                            name: firebaseName,
                            avatar: firebaseAvatar
                        };
                    }
                    
                    setUser(userObj);
                    
                    const params = new URLSearchParams(window.location.search);
                    const uid = params.get('uid');
                    setChannelUserId(uid ? uid : userObj.id);

                } catch (e) {
                    console.error("Erro ao validar login:", e);
                    setErrorLog("Erro ao validar login: " + (e.message || JSON.stringify(e)));
                }
            } else {
                console.error("Chave de sessão não encontrada.");
                setErrorLog("Chave de sessão não encontrada. Faça login novamente na página inicial.");
            }
            
            setLoading(false);
        };
        init();
    }, []);

    if (loading) {
        return <div className="flex h-screen items-center justify-center bg-gray-100"><div className="icon-loader animate-spin text-4xl text-indigo-600"></div></div>;
    }

        if (!user || !channelUserId) {
            return (
                <div className="flex h-screen flex-col items-center justify-center bg-gray-100 p-4 text-center">
                    <p className="mb-2 text-red-500 font-bold">Erro ao carregar o seu perfil ou o ID do canal é inválido.</p>
                    <p className="mb-2 text-gray-500 text-sm">Log: ID do Canal: {channelUserId || 'Nulo'}, Seu Perfil: {user ? 'Carregado' : 'Falhou'}</p>
                    {errorLog && (
                        <div className="mb-6 p-3 bg-red-50 text-red-600 border border-red-200 rounded-md text-xs max-w-md w-full text-left overflow-auto">
                            <strong>Detalhes do erro:</strong><br />
                            {errorLog}
                        </div>
                    )}
                    <a href="social.html" className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700">Voltar para a Rede Social</a>
                </div>
            );
        }

    return <UserChannel currentUser={user} channelUserId={channelUserId} />;
}

root.render(<App />);