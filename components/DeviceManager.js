function DeviceManager({ onClose, initialScannedId = null }) {
    const [scannerActive, setScannerActive] = React.useState(false);
    const [scannedId, setScannedId] = React.useState(initialScannedId);
    const [devices, setDevices] = React.useState([]);
    const [loading, setLoading] = React.useState(true);

    React.useEffect(() => {
        if (!window.firebaseDB || !window.currentUserData) return;
        const uid = window.currentUserData.uid || window.currentUserData.userKey;
        
        const devicesRef = window.firebaseDB.ref(`users/${uid}/devices`);
        devicesRef.on('value', (snap) => {
            const data = snap.val();
            if (data) {
                setDevices(Object.entries(data).map(([id, info]) => ({ id, ...info })));
            } else {
                setDevices([]);
            }
            setLoading(false);
        });

        return () => devicesRef.off();
    }, []);

    const qrScannerRef = React.useRef(null);

    React.useEffect(() => {
        if (scannerActive) {
            if (!window.QrScanner) {
                const script = document.createElement('script');
                script.src = "https://unpkg.com/qr-scanner/qr-scanner.umd.min.js";
                script.onload = () => setTimeout(initScanner, 300);
                document.head.appendChild(script);
            } else {
                setTimeout(initScanner, 300);
            }
        }

        async function initScanner() {
            try {
                const videoElem = document.getElementById('qr-video');
                if (!videoElem) return;

                qrScannerRef.current = new window.QrScanner(
                    videoElem,
                    async (result) => {
                        try {
                            const text = result.data || result;
                            const url = new URL(text);
                            // Suporta os dois padrões de query string para maior segurança
                            const id = url.searchParams.get("tvAuthId") || url.searchParams.get("id");
                            if (id && id.startsWith("tv_")) {
                                if (qrScannerRef.current) {
                                    qrScannerRef.current.stop();
                                }
                                setScannerActive(false);
                                await handleAutoApprove(id);
                            }
                        } catch(e) {
                            // ignore silent errors on background parsing
                        }
                    },
                    { 
                        highlightScanRegion: true, 
                        highlightCodeOutline: true,
                        returnDetailedScanResult: true 
                    }
                );
                
                await qrScannerRef.current.start();
            } catch (err) {
                console.error("Erro ao iniciar scanner", err);
            }
        }

        return () => {
            if (qrScannerRef.current) {
                qrScannerRef.current.stop();
                qrScannerRef.current.destroy();
                qrScannerRef.current = null;
            }
        };
    }, [scannerActive]);

    const handleAutoApprove = async (id) => {
        if (!id || !window.firebaseDB || !window.currentUserData) return;
        
        const uid = window.currentUserData.uid || window.currentUserData.userKey;
        
        try {
            await window.firebaseDB.ref(`tv_auth/${id}`).set({
                status: 'approved',
                userKey: window.currentUserData.userKey
            });

            await window.firebaseDB.ref(`users/${uid}/devices/${id}`).set({
                name: 'Smart TV',
                addedAt: Date.now(),
                lastActive: Date.now()
            });

            alert("Dispositivo conectado com sucesso!");
            if (initialScannedId && onClose) onClose();
        } catch (e) {
            console.error("Erro ao conectar", e);
            alert("Erro ao conectar o dispositivo.");
        }
    };

    const handleDisconnect = async (deviceId) => {
        if (!window.firebaseDB || !window.currentUserData) return;
        if (!window.confirm("Deseja realmente desconectar este dispositivo?")) return;
        
        const uid = window.currentUserData.uid || window.currentUserData.userKey;
        try {
            await window.firebaseDB.ref(`users/${uid}/devices/${deviceId}`).remove();
        } catch (e) {
            console.error("Erro ao desconectar", e);
            alert("Erro ao desconectar dispositivo.");
        }
    };

    return (
        <div className="fixed inset-0 z-[120] bg-gray-50 sm:bg-gray-900 sm:bg-opacity-50 flex flex-col sm:items-center sm:justify-center animate-fade-in">
            <div className="bg-white w-full h-full sm:h-auto sm:max-h-[90vh] sm:max-w-md sm:rounded-2xl shadow-xl flex flex-col overflow-hidden">
                <div className="p-4 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white z-10">
                    <h2 className="text-xl font-bold text-gray-800">Dispositivos Conectados</h2>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full">
                        <div className="icon-x text-xl text-gray-600"></div>
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 relative">
                    {!scannerActive && !scannedId && (
                        <div className="space-y-6">
                            <button 
                                onClick={() => setScannerActive(true)}
                                className="w-full flex flex-col items-center justify-center p-6 bg-indigo-50 border-2 border-dashed border-indigo-200 rounded-2xl hover:bg-indigo-100 transition-colors"
                            >
                                <div className="w-16 h-16 bg-indigo-600 rounded-full flex items-center justify-center text-white mb-3 shadow-lg">
                                    <div className="icon-scan text-3xl"></div>
                                </div>
                                <span className="font-bold text-indigo-900">Conectar Novo Dispositivo</span>
                                <span className="text-sm text-indigo-600 mt-1">Escaneie o QR Code na sua TV</span>
                            </button>

                            <div>
                                <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3">Meus Dispositivos</h3>
                                {loading ? (
                                    <div className="flex justify-center p-4"><div className="icon-loader animate-spin text-indigo-500"></div></div>
                                ) : devices.length > 0 ? (
                                    <div className="space-y-3">
                                        {devices.map(dev => (
                                            <div key={dev.id} className="flex flex-col gap-2 p-4 bg-gray-50 border border-gray-100 rounded-xl">
                                                <div className="flex items-center gap-4">
                                                    <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center text-gray-600">
                                                        <div className="icon-tv text-xl"></div>
                                                    </div>
                                                    <div className="flex-1">
                                                        <h4 className="font-bold text-gray-800">{dev.name}</h4>
                                                        <p className="text-xs text-gray-500">Adicionado em: {new Date(dev.addedAt).toLocaleDateString()}</p>
                                                    </div>
                                                    <button 
                                                        onClick={() => handleDisconnect(dev.id)} 
                                                        className="px-3 py-1 bg-red-100 text-red-700 hover:bg-red-200 text-xs font-bold rounded-full transition-colors"
                                                    >
                                                        Desconectar
                                                    </button>
                                                </div>
                                                {dev.unlockedChats && Object.keys(dev.unlockedChats).length > 0 && (
                                                    <div className="mt-2 pt-2 border-t border-gray-200">
                                                        <p className="text-xs font-bold text-gray-500 mb-2">Chats liberados para esta TV:</p>
                                                        <div className="flex flex-wrap gap-2">
                                                            {Object.keys(dev.unlockedChats).map(chatId => (
                                                                <div key={chatId} className="flex items-center gap-1 bg-white border border-gray-200 px-2 py-1 rounded text-xs text-gray-700">
                                                                    <span>{chatId.substring(0,6)}...</span>
                                                                    <button onClick={async () => {
                                                                        const uid = window.currentUserData.uid || window.currentUserData.userKey;
                                                                        await window.firebaseDB.ref(`users/${uid}/devices/${dev.id}/unlockedChats/${chatId}`).remove();
                                                                    }} className="text-red-500 hover:text-red-700 ml-1"><div className="icon-x"></div></button>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-center text-gray-500 py-4">Nenhum dispositivo conectado.</p>
                                )}
                            </div>
                        </div>
                    )}

                    {scannerActive && (
                        <div className="fixed inset-0 z-[130] bg-black flex flex-col">
                            <div className="p-4 flex justify-between items-center bg-gradient-to-b from-black/80 to-transparent z-10 absolute top-0 left-0 right-0">
                                <h3 className="font-bold text-white">Aponte para o QR Code</h3>
                                <button 
                                    onClick={() => setScannerActive(false)}
                                    className="p-2 bg-white/20 hover:bg-white/30 rounded-full text-white backdrop-blur-sm"
                                >
                                    <div className="icon-x text-xl"></div>
                                </button>
                            </div>
                            <div className="w-full h-full flex-1 relative flex items-center justify-center bg-black">
                                <video id="qr-video" className="w-full h-full object-cover"></video>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

window.DeviceManager = DeviceManager;