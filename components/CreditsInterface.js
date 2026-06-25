function CreditsInterface() {
    const [userData, setUserData] = React.useState(null);
    const [credits, setCredits] = React.useState(0);
    const [loading, setLoading] = React.useState(true);
    const [actionLoading, setActionLoading] = React.useState(false);
    const [adTokenLink, setAdTokenLink] = React.useState('');
    const [paymentStatus, setPaymentStatus] = React.useState(null);

    // Payment Calculator State
    const [rechargeValue, setRechargeValue] = React.useState('');
    const PRECO_POR_CREDITO = 0.50;

    const generateAdLink = async (uid) => {
        try {
            const uniqueCode = 'AD-' + Math.random().toString(36).substr(2, 9).toUpperCase();
            await window.firebaseDB.ref(`tokens/${uniqueCode}`).set({
                active: true,
                amount: 100,
                createdBy: uid,
                createdAt: Date.now()
            });
            const baseUrl = window.location.href.split('?')[0];
            const url = `${baseUrl}?token=${uniqueCode}`;
            setAdTokenLink(url);
            
            if (window.setupStaticAd) {
                window.setupStaticAd(url, () => generateAdLink(uid));
            }
        } catch (err) {
            console.error("Erro ao gerar link de anúncio:", err);
        }
    };

    const processTokenRedemption = async (tokenCode, uid) => {
        try {
            setActionLoading(true);
            const tokenRef = window.firebaseDB.ref(`tokens/${tokenCode}`);
            const tokenSnap = await tokenRef.once('value');
            const tokenData = tokenSnap.val();

            if (tokenData && tokenData.active) {
                const amount = tokenData.amount;
                
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

    const verifyPaymentReturn = async (uid) => {
        const urlParams = new URLSearchParams(window.location.search);
        const recargaPendente = localStorage.getItem('recarga_pendente');

        if (urlParams.get('sucesso') === '1' && recargaPendente) {
            const dados = JSON.parse(recargaPendente);
            const creditosAdicionados = dados.creditos;

            try {
                const userRef = window.firebaseDB.ref(`users/${uid}`);
                const userSnap = await userRef.once('value');
                const userDataObj = userSnap.val() || {};
                const currentCredits = userDataObj.credits || 0;

                await userRef.update({
                    credits: currentCredits + creditosAdicionados
                });

                setPaymentStatus({ type: 'success', message: `✅ Pagamento confirmado! ${creditosAdicionados} créditos foram adicionados à sua conta.` });
                localStorage.removeItem('recarga_pendente');
            } catch (err) {
                console.error("Erro ao adicionar créditos pós-pagamento", err);
                setPaymentStatus({ type: 'error', message: '❌ Erro ao adicionar créditos. Contate o suporte.' });
            }

        } else if (urlParams.get('falha') === '1') {
            setPaymentStatus({ type: 'error', message: '❌ Pagamento cancelado ou não concluído.' });
            localStorage.removeItem('recarga_pendente');
        }

        if (urlParams.has('sucesso') || urlParams.has('falha') || urlParams.has('creditos')) {
            const newUrl = window.location.pathname;
            window.history.replaceState({}, document.title, newUrl);
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
                generateAdLink(uid);
                
                if (window.firebaseDB) {
                    const userRef = window.firebaseDB.ref(`users/${uid}`);
                    
                    userRef.on('value', snap => {
                        const data = snap.val() || {};
                        setCredits(data.credits || 0);
                        setLoading(false);
                    });

                    const urlParams = new URLSearchParams(window.location.search);
                    const urlToken = urlParams.get('token');
                    if (urlToken) {
                        window.history.replaceState({}, document.title, window.location.pathname);
                        setTimeout(() => {
                            processTokenRedemption(urlToken, uid);
                        }, 500);
                    } else {
                        // Verifica retorno de pagamento se não for token de anúncio
                        verifyPaymentReturn(uid);
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

    const createPayment = async () => {
        const valor = parseFloat(rechargeValue);

        if (isNaN(valor) || valor < 1) {
            setPaymentStatus({ type: 'error', message: 'Por favor, digite um valor válido (mínimo R$ 1,00)' });
            return;
        }

        const creditosCalculados = Math.floor(valor / PRECO_POR_CREDITO);
        const valorCentavos = Math.round(valor * 100);

        setActionLoading(true);
        setPaymentStatus({ type: 'info', message: 'Gerando link de pagamento...' });

        try {
            const res = await fetch("https://code-hub-eta.vercel.app/api/payment.js", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    order_nsu: "recarga_" + Date.now(),
                    items: [{
                        quantity: 1,
                        price: valorCentavos,
                        description: `Recarga de ${creditosCalculados} créditos (R$ ${valor.toFixed(2)})`
                    }],
                    redirect_success: window.location.origin + window.location.pathname + "?sucesso=1&creditos=" + creditosCalculados,
                    redirect_fail: window.location.origin + window.location.pathname + "?falha=1"
                })
            });

            const data = await res.json();

            if (data.url) {
                localStorage.setItem('recarga_pendente', JSON.stringify({
                    creditos: creditosCalculados,
                    valor: valor,
                    timestamp: Date.now()
                }));

                window.location.href = data.url;
            } else {
                setPaymentStatus({ type: 'error', message: 'Erro ao gerar pagamento.' });
                setActionLoading(false);
            }
        } catch (e) {
            setPaymentStatus({ type: 'error', message: 'Erro de conexão.' });
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

    const parsedRechargeValue = parseFloat(rechargeValue);
    const isValidRecharge = !isNaN(parsedRechargeValue) && parsedRechargeValue >= 1;
    const calculatedCredits = isValidRecharge ? Math.floor(parsedRechargeValue / PRECO_POR_CREDITO) : 0;

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
                        <p className="text-gray-500 text-sm">Use seus créditos para destacar seu perfil ou comprar cosméticos.</p>
                    </div>
                    <div className="flex items-center gap-3 text-4xl font-bold text-indigo-600 bg-indigo-50 px-8 py-6 rounded-xl border border-indigo-100">
                        <div className="icon-coins text-yellow-500"></div> {credits}
                    </div>
                </div>

                {paymentStatus && (
                    <div className={`p-4 rounded-xl border font-medium flex items-center gap-2 ${paymentStatus.type === 'success' ? 'bg-green-50 border-green-200 text-green-800' : paymentStatus.type === 'error' ? 'bg-red-50 border-red-200 text-red-800' : 'bg-blue-50 border-blue-200 text-blue-800'}`}>
                        {paymentStatus.message}
                    </div>
                )}

                {/* Comprar Créditos (API Real) */}
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                    <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                        <div className="icon-credit-card text-green-600"></div> Recarregar Saldo
                    </h3>
                    
                    <div className="space-y-4">
                        <div>
                            <label className="block text-gray-700 font-bold mb-2">Valor da recarga (R$):</label>
                            <input 
                                type="number" 
                                min="1" 
                                step="0.01" 
                                placeholder="Digite o valor (mínimo R$ 1,00)"
                                className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-indigo-500 focus:ring-0 outline-none text-lg transition-colors"
                                value={rechargeValue}
                                onChange={(e) => setRechargeValue(e.target.value)}
                            />
                            {!isValidRecharge && rechargeValue !== '' && (
                                <p className="text-red-500 text-sm mt-1">O valor mínimo é R$ 1,00</p>
                            )}
                        </div>

                        {isValidRecharge && (
                            <div className="bg-gray-50 p-4 rounded-xl space-y-2 border border-gray-100">
                                <p className="text-gray-600 flex justify-between">
                                    <span>💵 Valor informado:</span> 
                                    <span className="font-bold text-indigo-600">R$ {parsedRechargeValue.toFixed(2).replace('.', ',')}</span>
                                </p>
                                <p className="text-gray-600 flex justify-between">
                                    <span>🪙 Você receberá:</span> 
                                    <span className="font-bold text-indigo-600">{calculatedCredits} créditos</span>
                                </p>
                                <p className="text-gray-600 flex justify-between border-t border-gray-200 pt-2 mt-2">
                                    <span>📊 Novo saldo:</span> 
                                    <span className="font-bold text-indigo-600">{credits + calculatedCredits} créditos</span>
                                </p>
                                <p className="text-green-600 font-bold text-sm text-center pt-2">⚡ Cada R$ 0,50 = 1 crédito</p>
                            </div>
                        )}

                        <button 
                            onClick={createPayment}
                            disabled={!isValidRecharge || actionLoading}
                            className={`w-full py-4 rounded-xl font-bold text-lg transition-colors flex items-center justify-center gap-2 ${isValidRecharge && !actionLoading ? 'bg-indigo-600 text-white hover:bg-indigo-700' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}
                        >
                            {actionLoading ? <div className="icon-loader animate-spin"></div> : <div className="icon-shopping-cart"></div>}
                            {actionLoading ? 'Processando...' : 'Recarregar'}
                        </button>
                    </div>
                </div>

            </div>
        </div>
    );
}

window.CreditsInterface = CreditsInterface;