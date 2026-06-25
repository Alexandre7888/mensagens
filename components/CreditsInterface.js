function CreditsInterface() {
    const [userData, setUserData] = React.useState(null);
    const [credits, setCredits] = React.useState(0);
    const [loading, setLoading] = React.useState(true);
    const [actionLoading, setActionLoading] = React.useState(false);
    const [showingAd, setShowingAd] = React.useState(false);

    const processTokenRedemption = async (tokenCode, uid) => {
        try {
            setActionLoading(true);
            const tokenRef = window.firebaseDB.ref(`tokens/${tokenCode}`);
            const tokenSnap = await tokenRef.once('value');
            const tokenData = tokenSnap.val();

            if (tokenData && tokenData.active) {
                const amount = tokenData.amount;
                
                // Get fresh credits value
                const userRef = window.firebaseDB.ref(`users/${uid}`);
                const userSnap = await userRef.once('value');
                const userDataObj = userSnap.val() || {};
                const currentCredits = userDataObj.credits || 0;
                
                const updates = {};
                updates[`tokens/${tokenCode}/active`] = false;
                updates[`tokens/${tokenCode}/redeemedAt`] = Date.now();
                updates[`tokens/${tokenCode}/redeemedBy`] = uid;
                updates[`users/${uid}/credits`] = currentCredits + amount;

                await window.firebaseDB.ref().update(updates);
                
                alert(`✨ Sucesso! Você resgatou ${amount} créditos.`);
                return true;
            } else {
                alert("Token inválido, já resgatado ou inexistente.");
                return false;
            }
        } catch (error) {
            console.error("Erro ao resgatar:", error);
            alert("Erro ao processar o link de resgate.");
            return false;
        } finally {
            setActionLoading(false);
        }
    };

    React.useEffect(() => {
        const initializeCredits = async () => {
            const userKey = localStorage.getItem("userkey");
            if (!userKey && !window.currentUserData) {
                window.location.href = 'index.html';
                return;
            }

            try {
                let uid = userKey;
                let userObj = window.currentUserData;

                if (!userObj && typeof window.api !== 'undefined') {
                    const codeHubData = await window.api.getCodeHubUser(userKey);
                    if (codeHubData && !codeHubData.erro) {
                        uid = codeHubData.uid || userKey;
                        userObj = { ...codeHubData, userKey: userKey };
                    } else {
                        userObj = { userKey: userKey, uid: userKey };
                    }
                } else if (!userObj) {
                    userObj = { userKey: userKey, uid: userKey };
                }

                setUserData(userObj);
                
                if (window.firebaseDB) {
                    const userRef = window.firebaseDB.ref(`users/${uid}`);
                    
                    userRef.on('value', snap => {
                        const data = snap.val() || {};
                        setCredits(data.credits || 0);
                        setLoading(false);
                    });

                    // Verificar se tem token na URL para resgate automático
                    const urlParams = new URLSearchParams(window.location.search);
                    const urlToken = urlParams.get('token');
                    if (urlToken) {
                        // Remove token from URL immediately to prevent double redemption attempt on refresh
                        window.history.replaceState({}, document.title, window.location.pathname);
                        setTimeout(() => {
                            processTokenRedemption(urlToken, uid);
                        }, 500);
                    }

                    return () => {
                        userRef.off('value');
                    };
                } else {
                    setLoading(false);
                }
            } catch (e) {
                console.error(e);
                window.location.href = 'index.html';
            }
        };

        initializeCredits();
    }, []);

    const handleGenerateTokenLink = async (amount) => {
        if (!userData) return;
        setActionLoading(true);
        setGeneratedLink('');
        try {
            const uid = userData.uid || userData.userKey;
            const uniqueCode = 'GIFT-' + Math.random().toString(36).substr(2, 9).toUpperCase();
            
            await window.firebaseDB.ref(`tokens/${uniqueCode}`).set({
                active: true,
                amount: amount,
                createdBy: uid,
                createdAt: Date.now()
            });

            const baseUrl = window.location.href.split('?')[0];
            const link = `${baseUrl}?token=${uniqueCode}`;
            setGeneratedLink(link);
            
            // Auto copy to clipboard if supported
            if (navigator.clipboard) {
                await navigator.clipboard.writeText(link);
                alert("Link gerado e copiado para a área de transferência!");
            }
        } catch (err) {
            console.error(err);
            alert("Erro ao gerar link de presente.");
        } finally {
            setActionLoading(false);
        }
    };

    const handleBuyCredits = async (amount) => {
        if (!userData) return;
        setActionLoading(true);
        
        try {
            const uid = userData.uid || userData.userKey;
            
            const userRef = window.firebaseDB.ref(`users/${uid}`);
            const snapshot = await userRef.once('value');
            const data = snapshot.val() || {};
            const currentCredits = data.credits || 0;
            
            await userRef.update({
                credits: currentCredits + amount
            });
            
            alert(`Sucesso! ${amount} créditos foram adicionados à sua conta.`);
            
        } catch (error) {
            console.error(error);
            alert("Erro ao processar a compra de créditos.");
        } finally {
            setActionLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="flex h-screen items-center justify-center bg-gray-50">
                <div className="flex flex-col items-center gap-4">
                    <div className="icon-loader text-4xl text-indigo-600 animate-spin"></div>
                    <p className="text-gray-600 font-medium">Carregando seus créditos...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-screen w-full bg-gray-50 overflow-y-auto" data-name="credits-interface" data-file="components/CreditsInterface.js">
            <div className="bg-indigo-600 shadow-md sticky top-0 z-50">
                <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <button onClick={() => window.location.href = 'index.html'} className="text-white hover:bg-white/20 p-2 rounded-full transition-colors">
                            <div className="icon-arrow-left text-xl"></div>
                        </button>
                        <h1 className="text-white text-xl font-bold">Central de Créditos</h1>
                    </div>
                    <div className="flex items-center gap-2 bg-indigo-800/50 px-4 py-2 rounded-full border border-indigo-500">
                        <div className="icon-coins text-yellow-400 text-xl"></div>
                        <span className="text-white font-bold text-lg">{credits}</span>
                    </div>
                </div>
            </div>

            <div className="max-w-4xl mx-auto w-full p-4 space-y-6">
                
                {/* Info Card */}
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div>
                        <h2 className="text-xl font-bold text-gray-800 mb-1">Seu Saldo Atual</h2>
                        <p className="text-gray-500 text-sm">Use seus créditos para destacar seu perfil ou comprar cosméticos e funcionalidades.</p>
                    </div>
                    <div className="flex items-center gap-3 text-3xl font-bold text-indigo-600 bg-indigo-50 px-6 py-4 rounded-xl border border-indigo-100">
                        <div className="icon-coins text-yellow-500"></div> {credits}
                    </div>
                </div>

                {/* Gerar Link de Presente */}
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                    <h3 className="text-lg font-bold text-gray-800 mb-2 flex items-center gap-2">
                        <div className="icon-link text-indigo-600"></div> Gerar Link de Resgate (Teste)
                    </h3>
                    <p className="text-gray-500 text-sm mb-4">Crie links com créditos e envie para seus amigos. O resgate é feito automaticamente ao abrir o link!</p>
                    
                    <div className="flex flex-col sm:flex-row gap-3 mb-4">
                        <button 
                            onClick={() => handleGenerateTokenLink(100)}
                            disabled={actionLoading}
                            className="flex-1 py-3 bg-indigo-100 text-indigo-700 font-bold rounded-xl hover:bg-indigo-200 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                            <div className="icon-coins"></div> Gerar Link de 100
                        </button>
                        <button 
                            onClick={() => handleGenerateTokenLink(200)}
                            disabled={actionLoading}
                            className="flex-1 py-3 bg-indigo-100 text-indigo-700 font-bold rounded-xl hover:bg-indigo-200 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                            <div className="icon-coins"></div> Gerar Link de 200
                        </button>
                    </div>

                    {generatedLink && (
                        <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-xl">
                            <p className="text-green-800 font-medium text-sm mb-2">Link gerado com sucesso!</p>
                            <div className="flex items-center gap-2 bg-white px-3 py-2 rounded border border-green-100 overflow-hidden">
                                <code className="text-xs text-gray-600 flex-1 whitespace-nowrap overflow-x-auto">{generatedLink}</code>
                                <button onClick={() => {navigator.clipboard.writeText(generatedLink); alert('Copiado!');}} className="text-green-600 hover:text-green-800 p-1">
                                    <div className="icon-copy"></div>
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Comprar Créditos (Simulação) */}
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                    <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                        <div className="icon-credit-card text-green-600"></div> Adquirir Créditos
                    </h3>
                    <p className="text-gray-500 text-sm mb-4">Selecione o pacote desejado para adicionar os créditos à sua conta (Modo Teste).</p>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        {[
                            { amount: 500, price: 'R$ 5,00', icon: 'zap' },
                            { amount: 1000, price: 'R$ 9,00', icon: 'rocket', popular: true },
                            { amount: 5000, price: 'R$ 40,00', icon: 'crown' }
                        ].map((pack) => (
                            <div key={pack.amount} className={`relative border-2 rounded-xl p-4 cursor-pointer transition-all ${pack.popular ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 hover:border-indigo-300 bg-white'}`}>
                                {pack.popular && (
                                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-indigo-600 text-white text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                                        Mais Popular
                                    </div>
                                )}
                                <div className="text-center space-y-2">
                                    <div className={`w-12 h-12 mx-auto rounded-full flex items-center justify-center ${pack.popular ? 'bg-indigo-100 text-indigo-600' : 'bg-gray-100 text-gray-600'}`}>
                                        <div className={`icon-${pack.icon} text-2xl`}></div>
                                    </div>
                                    <div className="font-bold text-gray-800 text-xl">{pack.amount}</div>
                                    <div className="text-xs text-gray-500 font-medium tracking-wide">CRÉDITOS</div>
                                    <div className="pt-2">
                                        <button 
                                            onClick={() => handleBuyCredits(pack.amount)}
                                            disabled={actionLoading}
                                            className={`w-full py-2 rounded-lg font-bold text-sm transition-colors ${pack.popular ? 'bg-indigo-600 text-white hover:bg-indigo-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                                        >
                                            {pack.price}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

            </div>
        </div>
    );
}

window.CreditsInterface = CreditsInterface;