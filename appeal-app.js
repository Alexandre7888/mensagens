function AppealApp() {
    const [status, setStatus] = React.useState('idle'); 
    const [banInfo, setBanInfo] = React.useState(null);
    const params = new URLSearchParams(window.location.search);
    const uid = params.get('uid');

    React.useEffect(() => {
        if (uid && window.firebaseDB) {
            window.firebaseDB.ref(`banned_users/${uid}`).once('value').then(snap => {
                setBanInfo(snap.val());
            });
        }
    }, [uid]);

    const userHasInteracted = React.useRef(false);

    React.useEffect(() => {
        if (!banInfo) return;

        const handleInteraction = () => {
            if (!userHasInteracted.current) {
                userHasInteracted.current = true;
            }
        };
        
        // Escuta qualquer tipo de interação, incluindo scroll mínimo
        window.addEventListener('click', handleInteraction, { once: true });
        window.addEventListener('touchstart', handleInteraction, { once: true });
        window.addEventListener('scroll', handleInteraction, { once: true });
        window.addEventListener('keydown', handleInteraction, { once: true });
        window.addEventListener('pointermove', handleInteraction, { once: true });

        return () => {
            window.removeEventListener('click', handleInteraction);
            window.removeEventListener('touchstart', handleInteraction);
            window.removeEventListener('scroll', handleInteraction);
            window.removeEventListener('keydown', handleInteraction);
            window.removeEventListener('pointermove', handleInteraction);
        };
    }, [banInfo]);

    // O tempo total da animação é 1.2s (1200ms). 
    // O impacto visual no chão acontece em 45% da animação, que é exatamente aos 540ms.
    const syncVibration = () => {
        if (userHasInteracted.current && navigator.vibrate) {
            setTimeout(() => {
                // Vibra exatamente quando a bola bate no chão
                navigator.vibrate([80, 50, 100]);
            }, 540); 
        }
    };

    let userData = null;
    if (banInfo && banInfo.backup) {
        try {
            userData = JSON.parse(decodeURIComponent(escape(atob(banInfo.backup))));
        } catch(e) {}
    }
    
    const defaultAvatar = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23e5e7eb' stroke='%239ca3af' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2'/%3E%3Ccircle cx='12' cy='7' r='4'/%3E%3C/svg%3E";
    const profilePic = userData?.perfil || userData?.photoURL || userData?.foto || userData?.photo || userData?.avatar || userData?.profilePicture || defaultAvatar;

    const [showForm, setShowForm] = React.useState(false);
    const [dataNasc, setDataNasc] = React.useState('');
    const [fotoBase64, setFotoBase64] = React.useState('');
    const [verificacao, setVerificacao] = React.useState(null);

    React.useEffect(() => {
        if (uid && window.firebaseDB) {
            window.firebaseDB.ref(`verificacoes/${uid}`).on('value', snap => {
                if (snap.exists()) {
                    setVerificacao(snap.val());
                }
            });
        }
    }, [uid]);

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setFotoBase64(reader.result);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleAppealSubmit = async (e) => {
        e.preventDefault();
        if (!uid || !dataNasc || !fotoBase64) {
            alert("Preencha a data e envie a foto.");
            return;
        }
        setStatus('appealing');
        try {
            const dados = {
                userId: uid,
                dataNascimento: dataNasc,
                fotoUrl: fotoBase64, // Convertido em Base64 para garantir armazenamento seguro e imediato
                status: "pendente",
                timestamp: Date.now()
            };

            await window.firebaseDB.ref(`verificacoes/${uid}`).set(dados);
            setStatus('success_appeal');
        } catch (error) {
            console.error('Erro na apelação:', error);
            setStatus('error');
        }
    };

    const handleLogout = () => {
        localStorage.removeItem("userkey");
        window.location.href = 'index.html';
    };

    const isTemp = banInfo && banInfo.banUntil;
    const expired = isTemp && Date.now() > banInfo.banUntil;

    return (
        <div className="min-h-screen flex items-center justify-center p-4 pb-20" data-name="appeal-app" data-file="appeal-app.js">
            <style>
            {`
                @keyframes bounceSquash {
                    0%, 100% { transform: translateY(-90px) scaleX(1) scaleY(1); }
                    45% { transform: translateY(0) scaleX(1) scaleY(1); }
                    50% { transform: translateY(0) scaleX(1.3) scaleY(0.6); }
                    55% { transform: translateY(0) scaleX(0.85) scaleY(1.1); }
                    60% { transform: translateY(-20px) scaleX(1) scaleY(1); }
                }
                .profile-ball {
                    animation: bounceSquash 1.2s infinite ease-in-out;
                    transform-origin: bottom center;
                }
            `}
            </style>
            <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full text-center mb-16">
                <div className="flex items-end justify-center gap-4 mb-6 h-48 pt-10">
                    <img 
                        src="https://app.trickle.so/storage/public/images/usr_1b4249e300000001/77f9d53d-f9aa-4909-ae71-62ceb82017dd.Untitled" 
                        alt="Conta Banida" 
                        className="w-32 h-32 object-contain rounded-xl mb-2"
                    />
                    <div className="w-24 h-full flex flex-col justify-end pb-2 relative">
                        <div 
                            className="profile-ball absolute bottom-2 w-20 h-20 rounded-full border-4 border-white shadow-[0_0_15px_rgba(0,0,0,0.2)] overflow-hidden bg-gray-100 flex items-center justify-center"
                            onAnimationStart={syncVibration}
                            onAnimationIteration={syncVibration}
                        >
                            {banInfo ? (
                                <img src={profilePic} alt="Profile" className="w-full h-full object-cover" onError={(e) => { e.target.onerror = null; e.target.src = defaultAvatar; }} />
                            ) : (
                                <div className="icon-user text-3xl text-gray-400"></div>
                            )}
                        </div>
                    </div>
                </div>
                <h1 className="text-2xl font-bold text-gray-800 mb-2">Conta Suspensa</h1>
                
                {banInfo ? (
                    <div className="mb-6 text-gray-600">
                        {isTemp ? (
                            <p>Sua conta foi banida temporariamente.<br/><br/> 
                               <span className="font-bold text-red-600">
                                   Expira em: {new Date(banInfo.banUntil).toLocaleString()}
                               </span>
                            </p>
                        ) : (
                            <p>Sua conta foi banida permanentemente pelo administrador.</p>
                        )}
                        {expired && (
                            <p className="mt-4 text-green-600 font-bold">O tempo do seu banimento já expirou! Você pode restaurar sua conta abaixo.</p>
                        )}

                        {banInfo.reason && (
                            <div className="mt-6 text-left">
                                <p className="text-sm font-bold text-gray-700 mb-2">Motivo do Banimento:</p>
                                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-gray-700 text-sm whitespace-pre-wrap cursor-not-allowed">
                                    {banInfo.reason}
                                </div>
                            </div>
                        )}
                    </div>
                ) : (
                    <p className="text-gray-600 mb-6">Verificando situação da conta...</p>
                )}

                {verificacao ? (
                    <div className="p-4 bg-yellow-50 text-yellow-800 rounded-xl border border-yellow-200">
                        <div className="icon-clock text-3xl mx-auto mb-2"></div>
                        <p className="font-bold">Apelação em Análise</p>
                        <p className="text-sm mt-1">Status: {verificacao.status}</p>
                        {verificacao.status === 'rejeitado' && (
                           <p className="text-sm text-red-600 font-bold mt-2">Sua apelação foi rejeitada.</p>
                        )}
                        <button onClick={handleLogout} className="mt-4 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg text-sm font-bold w-full">Sair da Conta</button>
                    </div>
                ) : (
                    <>
                        {status === 'idle' && !showForm && (
                            <div className="space-y-3">
                                <button 
                                    onClick={() => setShowForm(true)} 
                                    disabled={!banInfo || (isTemp && !expired && banInfo.banType !== 'permanent')}
                                    className={`w-full py-3 rounded-xl font-bold transition-colors ${(!banInfo || (isTemp && !expired)) ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-blue-600 text-white hover:bg-blue-700'}`}
                                >
                                    {(isTemp && !expired) ? 'Aguarde o prazo acabar' : 'Fazer Apelação'}
                                </button>
                                <button onClick={handleLogout} className="w-full py-3 bg-gray-100 text-gray-600 rounded-xl font-bold hover:bg-gray-200 transition-colors">
                                    Sair da Conta
                                </button>
                            </div>
                        )}

                        {showForm && status === 'idle' && (
                            <form onSubmit={handleAppealSubmit} className="space-y-4 text-left">
                                <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                                    <p className="text-sm text-gray-600 mb-4">Para analisar sua apelação, precisamos que confirme sua identidade enviando uma foto segurando um documento e sua data de nascimento.</p>
                                    
                                    <div className="mb-4">
                                        <label className="block text-sm font-bold text-gray-700 mb-1">Data de Nascimento</label>
                                        <input 
                                            type="date" 
                                            value={dataNasc}
                                            onChange={(e) => setDataNasc(e.target.value)}
                                            required
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        />
                                    </div>
                                    
                                    <div className="mb-4">
                                        <label className="block text-sm font-bold text-gray-700 mb-1">Foto Segurando Documento</label>
                                        <input 
                                            type="file" 
                                            accept="image/*"
                                            onChange={handleFileChange}
                                            required
                                            className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                                        />
                                        {fotoBase64 && (
                                            <div className="mt-2">
                                                <img src={fotoBase64} alt="Preview" className="h-24 rounded-lg object-cover" />
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <button type="button" onClick={() => setShowForm(false)} className="flex-1 py-3 bg-gray-200 text-gray-700 rounded-xl font-bold hover:bg-gray-300">
                                        Cancelar
                                    </button>
                                    <button type="submit" className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700">
                                        Enviar
                                    </button>
                                </div>
                            </form>
                        )}

                        {status === 'appealing' && (
                            <div className="flex flex-col items-center gap-3 text-blue-600">
                                <div className="icon-loader animate-spin text-3xl"></div>
                                <p>Enviando apelação...</p>
                            </div>
                        )}

                        {status === 'success_appeal' && (
                            <div className="text-green-600">
                                <div className="icon-circle-check text-4xl mx-auto mb-2"></div>
                                <p className="font-bold">Apelação Enviada!</p>
                                <p className="text-sm mt-2 text-gray-500">Aguarde a análise da administração.</p>
                                <button onClick={handleLogout} className="mt-4 px-4 py-2 bg-gray-100 text-gray-600 rounded-lg text-sm font-bold">Sair</button>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<AppealApp />);