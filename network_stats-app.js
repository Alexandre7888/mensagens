const { useState, useEffect } = React;

function NetworkStatsApp() {
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

    if (!user) return <div className="h-screen flex items-center justify-center bg-gray-100"><div className="icon-loader animate-spin text-4xl text-indigo-600"></div></div>;

    return <NetworkStats user={user} onClose={() => window.location.href = 'social.html'} />;
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<NetworkStatsApp />);