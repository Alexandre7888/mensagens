const { useState, useEffect } = React;

function LiveApp() {
    const [user, setUser] = useState(null);

    useEffect(() => {
        const checkAuth = async () => {
            const userData = localStorage.getItem('social_user_cache');
            if (userData) {
                setUser(JSON.parse(userData));
            } else {
                window.location.href = 'index.html';
            }
        };
        checkAuth();
    }, []);

    const urlParams = new URLSearchParams(window.location.search);
    const initialLiveId = urlParams.get('liveid');

    if (!user) return <div className="h-screen flex items-center justify-center bg-gray-900"><div className="icon-loader animate-spin text-4xl text-indigo-500"></div></div>;

    return <LiveInterface user={user} onClose={() => window.location.href = 'social.html'} initialLiveId={initialLiveId} />;
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<LiveApp />);