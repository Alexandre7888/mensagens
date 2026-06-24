const PulseInterface = ({ user }) => {
    const [isCreating, setIsCreating] = React.useState(false);
    const [emoji, setEmoji] = React.useState('💡');
    const [text, setText] = React.useState('');
    const [color, setColor] = React.useState('from-indigo-500 to-purple-600');
    const [pulses, setPulses] = React.useState([]);
    const [myPulse, setMyPulse] = React.useState(null);
    const [loading, setLoading] = React.useState(true);

    // Novos estados
    const [imageUrl, setImageUrl] = React.useState('');
    const [uploadingImage, setUploadingImage] = React.useState(false);
    const [privacy, setPrivacy] = React.useState('public'); // public, link, private
    const [targetUser, setTargetUser] = React.useState('');
    const [maxViews, setMaxViews] = React.useState(0); // 0 = sem limite
    const [viewingPulse, setViewingPulse] = React.useState(null);
    const [showCamera, setShowCamera] = React.useState(false);

    const colors = [
        'from-indigo-500 to-purple-600',
        'from-orange-400 to-red-500',
        'from-blue-400 to-emerald-400',
        'from-pink-500 to-rose-500',
        'from-slate-700 to-slate-900',
        'from-teal-400 to-cyan-600'
    ];

    const emojis = ['💡', '☕', '🎧', '💻', '🚗', '🎮', '😴', '🍿', '🚀', '🍔', '📚', '🏋️', '📷'];

    React.useEffect(() => {
        if (!window.firebaseDB) return;

        const urlParams = new URLSearchParams(window.location.search);
        const pulseIdParam = urlParams.get('pulseId');

        const pulsesRef = window.firebaseDB.ref('pulses');
        
        const listener = pulsesRef.on('value', (snapshot) => {
            const data = snapshot.val();
            const now = Date.now();
            const activePulses = [];
            let myCurrentPulse = null;

            if (data) {
                Object.keys(data).forEach(key => {
                    const pulse = data[key];
                    if (now > pulse.expiresAt) {
                        window.firebaseDB.ref(`pulses/${key}`).remove();
                    } else {
                        pulse.id = key;
                        
                        // Lógica de visualizações e privacidade
                        let canView = false;
                        if (pulse.uid === user.id) {
                            canView = true;
                            myCurrentPulse = pulse;
                        } else if (pulse.privacy === 'public') {
                            canView = true;
                        } else if (pulse.privacy === 'private' && pulse.targetUser === user.id) {
                            canView = true;
                        } else if (pulse.privacy === 'link' && pulseIdParam === key) {
                            canView = true;
                        }

                        // Limite de visualizações
                        if (pulse.maxViews > 0 && pulse.viewers) {
                            const viewersList = Object.keys(pulse.viewers);
                            if (viewersList.length >= pulse.maxViews && !pulse.viewers[user.id] && pulse.uid !== user.id) {
                                canView = false; // Já atingiu limite e eu não sou um dos que já viu
                            }
                        }

                        if (canView) {
                            activePulses.push(pulse);
                        }
                    }
                });
            }

            activePulses.sort((a, b) => b.timestamp - a.timestamp);
            
            setPulses(activePulses.filter(p => p.uid !== user.id));
            setMyPulse(myCurrentPulse);
            setLoading(false);

            // Se acessou por link, tenta abrir direto
            if (pulseIdParam && !viewingPulse) {
                const found = activePulses.find(p => p.id === pulseIdParam);
                if (found) handleViewPulse(found);
            }
        });

        return () => pulsesRef.off('value', listener);
    }, [user.id, viewingPulse]);

    const handleCaptureUpload = async (file) => {
        setUploadingImage(true);
        try {
            const form = new FormData();
            form.append("file", file);

            const resposta = await fetch("https://tmpfiles.org/api/v1/upload", {
                method: "POST",
                body: form
            });

            const json = await resposta.json();
            if (json.status !== "success") throw new Error(JSON.stringify(json));

            const urlDL = json.data.url.replace("https://tmpfiles.org/", "https://tmpfiles.org/dl/");
            setImageUrl(urlDL);
        } catch (error) {
            console.error(error);
            alert("Erro ao enviar arquivo.");
        } finally {
            setUploadingImage(false);
        }
    };

    const handleImageUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        await handleCaptureUpload(file);
    };

    const handlePublish = async () => {
        if (!text.trim() && !imageUrl) return;
        
        setIsCreating(false);
        if(navigator.vibrate) navigator.vibrate([50]);

        const now = Date.now();
        const expiresAt = now + (6 * 60 * 60 * 1000); // 6 horas

        const newPulse = {
            uid: user.id,
            user: user.name,
            emoji: emoji,
            text: text.trim(),
            color: color,
            imageUrl: imageUrl || null,
            timestamp: now,
            expiresAt: expiresAt,
            privacy: privacy,
            targetUser: targetUser || null,
            maxViews: parseInt(maxViews) || 0,
            viewers: {}
        };

        try {
            // Se for link ou private, gera um ID único. Se for público e o user já tem, substitui.
            const ref = privacy === 'public' 
                ? window.firebaseDB.ref(`pulses/${user.id}`) 
                : window.firebaseDB.ref(`pulses`).push();
            
            await ref.set(newPulse);
            
            // Enviar notificações
            if (privacy === 'public') {
                try {
                    const chatsSnap = await window.firebaseDB.ref(`users/${user.id}/chats`).once('value');
                    const chats = chatsSnap.val();
                    if (chats) {
                        Object.keys(chats).forEach(chatId => {
                            if (chats[chatId].type === 'direct') {
                                window.api.sendNotification(chatId, 'Nova Atualização', `${user.name} postou um novo Pulse!`);
                            }
                        });
                    }
                } catch (notifErr) {
                    console.error('Erro ao notificar amigos:', notifErr);
                }
            } else if (privacy === 'private' && targetUser) {
                try {
                    window.api.sendNotification(targetUser, 'Pulse Privado', `${user.name} enviou um Pulse só para você!`);
                } catch (notifErr) {
                    console.error('Erro ao notificar usuário alvo:', notifErr);
                }
            }

            setText('');
            setImageUrl('');
            setPrivacy('public');
            setTargetUser('');
            setMaxViews(0);

            if (privacy === 'link') {
                const link = `${window.location.origin}${window.location.pathname}?pulseId=${ref.key}`;
                alert(`Pulse criado! Link: ${link}`);
            }
        } catch (error) {
            console.error('Erro ao publicar Pulse:', error);
            alert('Erro ao publicar. Tente novamente.');
        }
    };

    const handleViewPulse = async (pulse) => {
        setViewingPulse(pulse);
        
        // Registrar view
        if (pulse.uid !== user.id && pulse.maxViews > 0) {
            const hasViewed = pulse.viewers && pulse.viewers[user.id];
            if (!hasViewed) {
                try {
                    await window.firebaseDB.ref(`pulses/${pulse.id}/viewers/${user.id}`).set(true);
                } catch (e) {
                    console.error(e);
                }
            }
        }
    };

    const handleDeletePulse = async (id) => {
        if (window.confirm("Deseja apagar este Pulse?")) {
            await window.firebaseDB.ref(`pulses/${id}`).remove();
            if (viewingPulse && viewingPulse.id === id) setViewingPulse(null);
        }
    };

    const formatTime = (timestamp) => {
        const diffMs = Date.now() - timestamp;
        const diffMins = Math.floor(diffMs / 60000);
        if (diffMins < 60) return `${diffMins} min`;
        const diffHours = Math.floor(diffMins / 60);
        return `${diffHours}h`;
    };

    return (
        <div className="max-w-md mx-auto h-screen flex flex-col bg-slate-50 relative">
            <header className="bg-white px-4 py-4 flex items-center justify-between shadow-sm z-10 sticky top-0">
                <div className="flex items-center gap-3">
                    <a href="index.html" className="text-gray-600 hover:text-indigo-600 transition-colors">
                        <div className="icon-arrow-left text-2xl"></div>
                    </a>
                    <h1 className="text-xl font-bold text-gray-800">Atualizações</h1>
                </div>
            </header>

            <div className="flex-1 overflow-y-auto p-4 pb-24 space-y-6">
                
                {/* Visualizador de Pulse em Tela Cheia */}
                {viewingPulse && (
                    <div className="fixed inset-0 z-50 bg-black flex flex-col">
                        <div className="flex justify-between items-center p-4 z-10 bg-gradient-to-b from-black/50 to-transparent">
                            <button onClick={() => setViewingPulse(null)} className="text-white p-2">
                                <div className="icon-x text-2xl"></div>
                            </button>
                            <div className="text-white/80 text-sm">{formatTime(viewingPulse.timestamp)}</div>
                            <div className="flex gap-2">
                                <button onClick={() => {
                                    const link = `${window.location.origin}${window.location.pathname}?pulseId=${viewingPulse.id}`;
                                    navigator.clipboard.writeText(link).then(() => alert('Link copiado!'));
                                }} className="text-white p-2" title="Copiar Link">
                                    <div className="icon-link text-xl"></div>
                                </button>
                                {viewingPulse.uid === user.id && (
                                    <button onClick={() => handleDeletePulse(viewingPulse.id)} className="text-red-400 p-2">
                                        <div className="icon-trash text-xl"></div>
                                    </button>
                                )}
                            </div>
                        </div>
                        
                        <div className={`flex-1 flex flex-col items-center justify-center p-6 bg-gradient-to-br ${viewingPulse.color} text-white`}>
                            {viewingPulse.imageUrl ? (
                                <img src={viewingPulse.imageUrl} alt="Pulse Media" className="max-h-[60vh] rounded-xl shadow-2xl mb-6 object-contain" />
                            ) : (
                                <div className="text-8xl drop-shadow-xl mb-6">{viewingPulse.emoji}</div>
                            )}
                            <h3 className="text-2xl font-bold mb-2 drop-shadow-md">{viewingPulse.user}</h3>
                            <p className="text-xl text-center font-medium opacity-90">{viewingPulse.text}</p>
                            
                            {viewingPulse.maxViews > 0 && (
                                <div className="mt-8 bg-black/30 px-4 py-2 rounded-full text-sm backdrop-blur-sm flex items-center gap-2">
                                    <div className="icon-eye"></div> 
                                    {(viewingPulse.viewers ? Object.keys(viewingPulse.viewers).length : 0)} / {viewingPulse.maxViews} views
                                </div>
                            )}
                        </div>
                    </div>
                )}

                <section>
                    <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Seu Status</h2>
                    {!isCreating ? (
                        myPulse ? (
                            <div onClick={() => handleViewPulse(myPulse)} className={`pulse-card bg-gradient-to-br ${myPulse.color} rounded-2xl p-4 text-white relative shadow-md cursor-pointer hover:scale-[1.02] transition-transform`}>
                                {myPulse.imageUrl && <div className="absolute inset-0 bg-cover bg-center opacity-30 mix-blend-overlay" style={{backgroundImage: `url(${myPulse.imageUrl})`}}></div>}
                                <div className="relative z-10">
                                    <div className="text-4xl mb-3 drop-shadow-md">{myPulse.emoji}</div>
                                    <h4 className="font-bold text-sm">Você</h4>
                                    <p className="text-sm font-medium opacity-90 leading-tight mt-1">{myPulse.text}</p>
                                    <div className="text-xs opacity-70 mt-2">Expira em {Math.floor((myPulse.expiresAt - Date.now()) / 3600000)}h</div>
                                </div>
                            </div>
                        ) : (
                            <div 
                                onClick={() => setIsCreating(true)}
                                className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex items-center gap-4 cursor-pointer hover:shadow-md transition-shadow"
                            >
                                <div className="w-14 h-14 rounded-full bg-indigo-50 flex items-center justify-center text-2xl border-2 border-dashed border-indigo-300 text-indigo-500">
                                    <div className="icon-plus"></div>
                                </div>
                                <div>
                                    <h3 className="font-semibold text-gray-800">Compartilhar um Pulse</h3>
                                    <p className="text-sm text-gray-500">Foto, texto, views limitados...</p>
                                </div>
                            </div>
                        )
                    ) : (
                        <div className={`pulse-card rounded-3xl p-6 shadow-xl bg-gradient-to-br ${color} text-white`}>
                            <div className="flex justify-between items-start mb-4">
                                <button onClick={() => setIsCreating(false)} className="bg-black/20 p-2 rounded-full backdrop-blur-sm">
                                    <div className="icon-x"></div>
                                </button>
                                <button onClick={handlePublish} disabled={uploadingImage} className="bg-white text-gray-900 font-bold px-4 py-2 rounded-full text-sm hover:scale-105 transition-transform disabled:opacity-50">
                                    {uploadingImage ? 'Enviando...' : 'Publicar'}
                                </button>
                            </div>
                            
                            <div className="flex flex-col items-center gap-4">
                                {!imageUrl && (
                                    <div className="flex flex-wrap justify-center gap-2 mb-2 max-h-24 overflow-y-auto no-scrollbar">
                                        {emojis.map(e => (
                                            <button 
                                                key={e}
                                                onClick={() => setEmoji(e)}
                                                className={`text-2xl p-2 rounded-xl transition-all ${emoji === e ? 'bg-white/30 scale-110' : 'hover:bg-white/10'}`}
                                            >
                                                {e}
                                            </button>
                                        ))}
                                    </div>
                                )}
                                
                                {imageUrl ? (
                                    <div className="relative group">
                                        <img src={imageUrl} className="h-32 w-32 object-cover rounded-xl shadow-lg border-2 border-white/50" />
                                        <button onClick={() => setImageUrl('')} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-md">
                                            <div className="icon-x text-sm"></div>
                                        </button>
                                    </div>
                                ) : (
                                    <div className="text-6xl drop-shadow-lg mb-2">{emoji}</div>
                                )}
                                
                                <input 
                                    type="text"
                                    maxLength={60}
                                    value={text}
                                    onChange={(e) => setText(e.target.value)}
                                    placeholder="O que está rolando?"
                                    className="bg-transparent border-b-2 border-white/30 text-center text-xl font-medium placeholder-white/60 focus:outline-none focus:border-white w-full py-2 transition-colors"
                                />

                                <div className="w-full bg-black/20 rounded-xl p-3 mt-2 space-y-3">
                                    <div className="flex justify-between items-center gap-2">
                                        <label className="text-sm font-medium text-white/90">Privacidade:</label>
                                        <select value={privacy} onChange={(e) => setPrivacy(e.target.value)} className="bg-black/30 rounded p-1 text-sm outline-none border-none text-white">
                                            <option value="public">Público</option>
                                            <option value="link">Somente Link</option>
                                            <option value="private">Usuário Específico</option>
                                        </select>
                                    </div>
                                    
                                    {privacy === 'private' && (
                                        <input 
                                            type="text" 
                                            placeholder="ID ou @ do Usuário" 
                                            value={targetUser}
                                            onChange={(e) => setTargetUser(e.target.value)}
                                            className="w-full bg-black/30 rounded p-2 text-sm text-center outline-none placeholder-white/50"
                                        />
                                    )}

                                    <div className="flex justify-between items-center gap-2">
                                        <label className="text-sm font-medium text-white/90">Limite Views:</label>
                                        <input 
                                            type="number" 
                                            min="0"
                                            value={maxViews}
                                            onChange={(e) => setMaxViews(e.target.value)}
                                            className="w-20 bg-black/30 rounded p-1 text-sm text-center outline-none"
                                            placeholder="0 = ∞"
                                        />
                                    </div>

                                    <div className="flex justify-between items-center gap-2">
                                        <label className="text-sm font-medium text-white/90">Foto/Vídeo:</label>
                                        <div className="flex gap-2">
                                            <input type="file" id="pulse-img" className="hidden" accept="image/*" onChange={handleImageUpload} />
                                            <label htmlFor="pulse-img" className="bg-black/30 hover:bg-black/50 cursor-pointer rounded px-3 py-1 text-sm flex items-center gap-2 transition-colors" title="Galeria">
                                                <div className="icon-image"></div>
                                            </label>
                                            <button onClick={() => setShowCamera(true)} className="bg-black/30 hover:bg-black/50 cursor-pointer rounded px-3 py-1 text-sm flex items-center gap-2 transition-colors" title="Câmera">
                                                <div className="icon-camera"></div>
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex flex-wrap justify-center gap-2 mt-2">
                                    {colors.map(c => (
                                        <button 
                                            key={c}
                                            onClick={() => setColor(c)}
                                            className={`w-6 h-6 rounded-full bg-gradient-to-br ${c} border-2 ${color === c ? 'border-white scale-125' : 'border-transparent'}`}
                                        />
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </section>

                <hr className="border-gray-200" />

                <section>
                    <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Feed</h2>
                    {loading ? (
                        <div className="flex justify-center p-4">
                            <div className="icon-loader text-2xl text-indigo-500 animate-spin"></div>
                        </div>
                    ) : pulses.length > 0 ? (
                        <div className="grid grid-cols-2 gap-3">
                            {pulses.map(pulse => (
                                <div key={pulse.id} onClick={() => handleViewPulse(pulse)} className={`pulse-card bg-gradient-to-br ${pulse.color} rounded-2xl p-4 text-white relative overflow-hidden shadow-sm cursor-pointer hover:shadow-md transition-all hover:-translate-y-1`}>
                                    {pulse.imageUrl && <div className="absolute inset-0 bg-cover bg-center opacity-30 mix-blend-overlay" style={{backgroundImage: `url(${pulse.imageUrl})`}}></div>}
                                    <div className="absolute top-2 right-2 flex gap-1">
                                        {pulse.privacy === 'private' && <div className="bg-black/30 p-1 rounded backdrop-blur-sm"><div className="icon-lock text-[10px]"></div></div>}
                                        {pulse.maxViews > 0 && <div className="bg-black/30 px-1.5 py-0.5 rounded backdrop-blur-sm text-[10px] font-bold">{(pulse.viewers ? Object.keys(pulse.viewers).length : 0)}/{pulse.maxViews}</div>}
                                    </div>
                                    <div className="relative z-10">
                                        <div className="text-4xl mb-3 drop-shadow-md">{pulse.emoji}</div>
                                        <h4 className="font-bold text-sm truncate">{pulse.user}</h4>
                                        <p className="text-xs font-medium opacity-90 leading-tight mt-1 line-clamp-2">{pulse.text}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center text-gray-500 py-8">
                            <div className="icon-inbox text-4xl mb-2 mx-auto opacity-50"></div>
                            <p>Nenhuma atualização visível para você.</p>
                        </div>
                    )}
                </section>

            </div>

            {showCamera && (
                <window.CameraCapture 
                    onClose={() => setShowCamera(false)} 
                    onCapture={(file, type) => {
                        handleCaptureUpload(file);
                        setShowCamera(false);
                    }} 
                />
            )}

            <nav className="fixed bottom-0 w-full max-w-md bg-white border-t border-gray-200 flex justify-around p-3 pb-safe-area z-20">
                <a href="index.html" className="flex flex-col items-center text-gray-400">
                    <div className="icon-message-circle text-xl mb-1"></div>
                    <span className="text-[10px] font-medium">Chats</span>
                </a>
                <a href="updates.html" className="flex flex-col items-center text-indigo-600">
                    <div className="icon-loader text-xl mb-1"></div>
                    <span className="text-[10px] font-medium">Atualizações</span>
                </a>
                <a href="call.html" className="flex flex-col items-center text-gray-400">
                    <div className="icon-phone text-xl mb-1"></div>
                    <span className="text-[10px] font-medium">Chamadas</span>
                </a>
            </nav>
        </div>
    );
};