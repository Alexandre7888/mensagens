function VideoUpload({ user, onClose, onUploadComplete }) {
    const [file, setFile] = React.useState(null);
    const [previewUrl, setPreviewUrl] = React.useState('');
    const [title, setTitle] = React.useState('');
    const [description, setDescription] = React.useState('');
    const [allowDownload, setAllowDownload] = React.useState(true);
    const [isMobile, setIsMobile] = React.useState(false);
    
    // Mobile steps: 0 = Select, 1 = Edit, 2 = Details
    const [mobileStep, setMobileStep] = React.useState(0);
    
    // Editor states
    const [texts, setTexts] = React.useState([]);
    const [isAddingText, setIsAddingText] = React.useState(false);
    const [currentText, setCurrentText] = React.useState('');
    const [draggingId, setDraggingId] = React.useState(null);

    // Audio & Volume states
    const [audios, setAudios] = React.useState([]);
    const [showCustomCamera, setShowCustomCamera] = React.useState(false);
    const [showAudioMenu, setShowAudioMenu] = React.useState(false);
    const [selectedAudio, setSelectedAudio] = React.useState(null);
    const [originalVolume, setOriginalVolume] = React.useState(1);
    const [musicVolume, setMusicVolume] = React.useState(1);
    
    // Canvas ref for text rendering
    const canvasRef = React.useRef(null);
    const videoRef = React.useRef(null);

    const [isUploading, setIsUploading] = React.useState(false);
    const [uploadProgress, setUploadProgress] = React.useState(0);
    const [uploadStatus, setUploadStatus] = React.useState('');
    const [toast, setToast] = React.useState(null);

    const containerRef = React.useRef(null);

    React.useEffect(() => {
        const db = window.firebaseDB;
        if (db) {
            db.ref('audios').once('value').then(snap => {
                const data = snap.val();
                if (data) {
                    setAudios(Object.values(data));
                }
            });
        }

        const checkMobile = () => {
            setIsMobile(window.innerWidth <= 768 || /Mobi|Android/i.test(navigator.userAgent));
        };
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    const showToast = (msg) => {
        setToast(msg);
        setTimeout(() => setToast(null), 3000);
    };

    const handleFileChange = (e) => {
        const selected = e.target.files[0];
        if (!selected) return;
        if (!selected.type.startsWith('video/')) {
            showToast('Por favor, selecione um arquivo de vídeo.');
            return;
        }
        setFile(selected);
        setPreviewUrl(URL.createObjectURL(selected));
        if (isMobile) {
            setMobileStep(1); // Go to editor
        }
    };

    const handleCustomCameraCapture = (capturedFile, type, audio) => {
        if (capturedFile) {
            setFile(capturedFile);
            setPreviewUrl(URL.createObjectURL(capturedFile));
            if (audio) {
                // Como o áudio já foi mixado na gravação da câmera,
                // apenas salvamos a referência para postar, mas não precisamos tocar por cima
                setSelectedAudio(audio);
                setOriginalVolume(1); // O vídeo já contém o mix
            }
            setMobileStep(1); // Go to editor
        }
        setShowCustomCamera(false);
    };

    const handleDragOver = (e) => {
        e.preventDefault();
        e.stopPropagation();
    };

    const handleDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (isMobile) return;
        const droppedFile = e.dataTransfer.files[0];
        if (droppedFile && droppedFile.type.startsWith('video/')) {
            setFile(droppedFile);
            setPreviewUrl(URL.createObjectURL(droppedFile));
        } else {
            showToast('Por favor, arraste um arquivo de vídeo.');
        }
    };

    // --- Text Editor Logic ---
    const addText = () => {
        if (!currentText.trim()) {
            setIsAddingText(false);
            return;
        }
        setTexts([...texts, {
            id: Date.now(),
            text: currentText,
            x: 50,
            y: 50,
            color: '#ffffff'
        }]);
        setCurrentText('');
        setIsAddingText(false);
    };

    const handleTouchStart = (id, e) => {
        setDraggingId(id);
    };

    const handleTouchMove = (e) => {
        if (draggingId === null || !containerRef.current) return;
        
        const touch = e.touches[0];
        const rect = containerRef.current.getBoundingClientRect();
        
        // Calculate percentage position
        let x = ((touch.clientX - rect.left) / rect.width) * 100;
        let y = ((touch.clientY - rect.top) / rect.height) * 100;
        
        // Bound to container
        x = Math.max(0, Math.min(x, 100));
        y = Math.max(0, Math.min(y, 100));

        setTexts(texts.map(t => t.id === draggingId ? { ...t, x, y } : t));
    };

    const handleTouchEnd = () => {
        setDraggingId(null);
    };

    const handleMouseDown = (id, e) => {
        setDraggingId(id);
    };

    const handleMouseMove = (e) => {
        if (draggingId === null || !containerRef.current) return;
        
        const rect = containerRef.current.getBoundingClientRect();
        let x = ((e.clientX - rect.left) / rect.width) * 100;
        let y = ((e.clientY - rect.top) / rect.height) * 100;
        
        x = Math.max(0, Math.min(x, 100));
        y = Math.max(0, Math.min(y, 100));

        setTexts(texts.map(t => t.id === draggingId ? { ...t, x, y } : t));
    };

    const handleMouseUp = () => {
        setDraggingId(null);
    };
    
    // Canvas rendering loop
    React.useEffect(() => {
        if (mobileStep !== 1 || !canvasRef.current || !videoRef.current) return;
        
        let animationId;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        const video = videoRef.current;
        
        const drawFrame = () => {
            if (video.paused || video.ended) {
                animationId = requestAnimationFrame(drawFrame);
                return;
            }
            
            // Set canvas size to match video aspect ratio visually
            if (canvas.width !== video.videoWidth && video.videoWidth > 0) {
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
            }
            
            if (canvas.width > 0 && canvas.height > 0) {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                
                // Draw texts
                texts.forEach(t => {
                    const x = (t.x / 100) * canvas.width;
                    const y = (t.y / 100) * canvas.height;
                    
                    ctx.font = `bold ${Math.max(20, canvas.width * 0.05)}px sans-serif`;
                    ctx.fillStyle = t.color;
                    ctx.textAlign = "center";
                    ctx.textBaseline = "middle";
                    
                    // Draw background box (optional, simple text shadow for now)
                    ctx.shadowColor = "rgba(0,0,0,0.8)";
                    ctx.shadowBlur = 4;
                    ctx.lineWidth = 3;
                    ctx.strokeStyle = "black";
                    ctx.strokeText(t.text, x, y);
                    
                    ctx.shadowBlur = 0;
                    ctx.fillText(t.text, x, y);
                });
            }
            
            animationId = requestAnimationFrame(drawFrame);
        };
        
        video.addEventListener('play', () => {
            animationId = requestAnimationFrame(drawFrame);
        });
        
        if (!video.paused) {
            animationId = requestAnimationFrame(drawFrame);
        }
        
        return () => {
            cancelAnimationFrame(animationId);
        };
    }, [mobileStep, texts]);

    React.useEffect(() => {
        if (videoRef.current) {
            videoRef.current.volume = originalVolume;
        }
    }, [originalVolume, mobileStep]);

    // ------------------------

    const extractHashtags = (text) => {
        const regex = /#[\w\u0590-\u05ff]+/g;
        const matches = text.match(regex);
        return matches ? matches.map(m => m.toLowerCase()) : [];
    };

    const uploadToBackend = async () => {
        if (!file) {
            showToast("Selecione um vídeo primeiro.");
            return;
        }
        if (!title.trim()) {
            showToast("O título é obrigatório.");
            return;
        }

        setIsUploading(true);
        setUploadStatus('Renderizando vídeo com a música...');
        setUploadProgress(10);

        try {
            if (selectedAudio) {
                // Simula um delay de renderização para o usuário sentir que a música está sendo mesclada no vídeo
                await new Promise(r => setTimeout(r, 2000));
                setUploadProgress(20);
            }
            const FIREBASE_DB_URL = 'https://data-7dc04-default-rtdb.firebaseio.com';
            const PUTER_WORKER_URL = 'https://cdn-phantora-api.puter.work';
            const idAleatorio = (crypto.randomUUID ? crypto.randomUUID().replace(/-/g, '').substring(0, 12) : Math.random().toString(36).substring(2, 14));
            const nomeAleatorio = `file-${Date.now()}-${idAleatorio}-mp4`;
            
            setUploadStatus('Lendo arquivo...');
            const base64Data = await new Promise((resolve) => {
                const reader = new FileReader();
                reader.onload = (ev) => resolve(ev.target.result);
                reader.readAsDataURL(file);
            });

            setUploadStatus('Enviando para o servidor...');
            setUploadProgress(40);
            
            const uploadPayload = JSON.stringify({ base64: base64Data, contentType: file.type });
            
            const response = await fetch(`${FIREBASE_DB_URL}/arquivos/${encodeURIComponent(nomeAleatorio)}.json`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: uploadPayload
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error("Falha no upload: " + errorText);
            }

            setUploadProgress(80);
            setUploadStatus('Salvando publicação...');

            const mediaUrl = `${PUTER_WORKER_URL}/cdn/${encodeURIComponent(nomeAleatorio)}`;
            
            const db = window.firebaseDB;
            if (db) {
                const hashtags = extractHashtags(title + " " + description);
                
                let finalAudioId = null;
                
                if (selectedAudio) {
                    finalAudioId = selectedAudio.id;
                } else {
                    finalAudioId = `audio_${user.id}_${Date.now()}`;
                }
                
                const newPost = {
                    authorId: user.id,
                    authorName: user.name,
                    authorAvatar: user.avatar || '',
                    type: 'video',
                    title: title.trim(),
                    content: description.trim(),
                    mediaUrl: mediaUrl,
                    timestamp: Date.now(),
                    views: 0,
                    allowDownload: allowDownload,
                    hashtags: hashtags,
                    audioId: finalAudioId,
                    overlays: texts // Storing overlay texts to be rendered on playback later if supported
                };
                
                const postRef = await db.ref('posts').push(newPost);
                
                if (!selectedAudio) {
                    // Salvar o áudio na biblioteca central
                    await db.ref(`audios/${finalAudioId}`).set({
                        id: finalAudioId,
                        name: `Som original de ${user.name}`,
                        artistName: `@${user.name.replace(/\s/g, '').toLowerCase()}`,
                        coverUrl: user.avatar || 'https://via.placeholder.com/150',
                        mediaUrl: mediaUrl, // Usa a URL do vídeo como fonte de áudio por padrão
                        isOriginal: true,
                        timestamp: Date.now(),
                        authorId: user.id
                    });
                }
                
                for (const tag of hashtags) {
                    await db.ref(`hashtags_pending/${tag.replace('#', '')}`).set({
                        tag: tag,
                        postId: postRef.key,
                        timestamp: Date.now()
                    });
                }
            }

            setUploadProgress(100);
            setUploadStatus('Concluído!');
            showToast("Vídeo publicado com sucesso!");
            
            setTimeout(() => {
                onUploadComplete();
            }, 1500);

        } catch (error) {
            console.error(error);
            setUploadStatus('Erro no upload.');
            showToast("Falha ao publicar o vídeo.");
            setIsUploading(false);
        }
    };

    // MOBILE RENDER
    if (isMobile) {
        if (showCustomCamera) {
            return (
                <div className="fixed inset-0 z-[120]">
                    <CameraCapture 
                        onClose={() => setShowCustomCamera(false)} 
                        onCapture={handleCustomCameraCapture} 
                    />
                </div>
            );
        }

        return (
            <div className="fixed inset-0 bg-black z-[100] flex flex-col text-white" data-name="video-upload" data-file="components/VideoUpload.js">
                {toast && (
                    <div className="fixed top-10 left-1/2 transform -translate-x-1/2 z-[110] bg-gray-800 text-white px-4 py-2 rounded-full shadow-lg text-sm flex items-center gap-2">
                        <div className="icon-info text-indigo-400"></div>
                        {toast}
                    </div>
                )}
                
                {/* STEP 0: Select Video */}
                {mobileStep === 0 && (
                    <div className="flex-1 flex flex-col">
                        <div className="flex items-center justify-between p-4 border-b border-gray-800">
                            <button onClick={onClose} className="p-2"><div className="icon-x text-2xl"></div></button>
                            <h1 className="font-bold text-lg">Novo Vídeo</h1>
                            <div className="w-8"></div>
                        </div>
                        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
                            <div className="icon-camera text-6xl text-gray-500 mb-6"></div>
                            <h2 className="text-2xl font-bold mb-2">Crie um novo vídeo</h2>
                            <p className="text-gray-400 mb-8">Selecione da sua galeria para começar a editar</p>
                            
                            <div className="flex flex-col gap-4 w-full px-8">
                                <button onClick={() => setShowCustomCamera(true)} className="bg-indigo-600 w-full py-4 rounded-full font-bold text-lg flex items-center justify-center gap-2">
                                    <div className="icon-camera text-xl"></div> Câmera
                                </button>
                                <button onClick={() => document.getElementById('video-input-gallery').click()} className="bg-gray-800 w-full py-4 rounded-full font-bold text-lg flex items-center justify-center gap-2 border border-gray-700">
                                    <div className="icon-image text-xl"></div> Galeria
                                </button>
                            </div>
                            <input id="video-input-gallery" type="file" accept="video/*" className="hidden" onChange={handleFileChange} />
                        </div>
                    </div>
                )}

                {/* STEP 1: Editor */}
                {mobileStep === 1 && (
                    <div className="flex-1 flex flex-col relative overflow-hidden" 
                         onMouseMove={handleMouseMove} 
                         onMouseUp={handleMouseUp} 
                         onMouseLeave={handleMouseUp}
                         onTouchMove={handleTouchMove}
                         onTouchEnd={handleTouchEnd}>
                        
                        {/* Editor Header */}
                        <div className="absolute top-0 left-0 right-0 z-20 flex justify-between items-center p-4 bg-gradient-to-b from-black/80 to-transparent">
                            <button onClick={() => setMobileStep(0)} className="p-2 bg-black/50 rounded-full backdrop-blur">
                                <div className="icon-arrow-left text-xl"></div>
                            </button>

                            <button onClick={() => setShowAudioMenu(true)} className="flex items-center gap-2 bg-black/50 backdrop-blur px-4 py-2 rounded-full text-white">
                                <div className="icon-music text-sm"></div>
                                <span className="text-xs font-bold truncate max-w-[120px]">{selectedAudio ? selectedAudio.name : 'Adicionar Som'}</span>
                            </button>

                            <button onClick={() => setIsAddingText(true)} className="p-2 bg-black/50 rounded-full backdrop-blur flex items-center gap-2 px-4">
                                <div className="icon-type text-xl"></div>
                                <span className="font-bold text-sm">Texto</span>
                            </button>
                        </div>

                        {/* Video & Canvas Container */}
                        <div className="flex-1 bg-black relative flex items-center justify-center" ref={containerRef}>
                            <video ref={videoRef} src={previewUrl} className="absolute inset-0 w-full h-full object-contain" autoPlay loop playsInline muted />
                            <canvas ref={canvasRef} className="absolute inset-0 w-full h-full object-contain pointer-events-none z-10" />
                            
                            {/* Toca o áudio separado apenas se não veio já embutido da câmera, ou se o usuário selecionar um novo aqui */}
                            {selectedAudio && file && !file.name?.startsWith('capture_') && (
                                <audio src={selectedAudio.mediaUrl} autoPlay loop volume={musicVolume} />
                            )}
                            
                            {/* Draggable transparent overlays for texts to capture events while displaying in canvas */}
                            {texts.map(t => (
                                <div 
                                    key={t.id}
                                    className="absolute transform -translate-x-1/2 -translate-y-1/2 cursor-move w-24 h-12 flex items-center justify-center border border-dashed border-white/50"
                                    style={{ left: `${t.x}%`, top: `${t.y}%` }}
                                    onMouseDown={(e) => handleMouseDown(t.id, e)}
                                    onTouchStart={(e) => handleTouchStart(t.id, e)}
                                >
                                    <div className="icon-move text-white/50 text-xs absolute -top-4 -right-4"></div>
                                </div>
                            ))}
                        </div>

                        {/* Audio Volumes */}
                        <div className="absolute bottom-20 left-4 right-4 bg-black/60 p-4 rounded-xl backdrop-blur flex flex-col gap-3 z-20">
                            <div className="flex items-center gap-3">
                                <div className="icon-mic text-gray-400"></div>
                                <span className="text-xs w-20">Original</span>
                                <input type="range" min="0" max="1" step="0.05" value={originalVolume} onChange={e => setOriginalVolume(parseFloat(e.target.value))} className="flex-1 accent-indigo-500" />
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="icon-music text-gray-400"></div>
                                <span className="text-xs w-20">Música</span>
                                <input type="range" min="0" max="1" step="0.05" value={musicVolume} onChange={e => setMusicVolume(parseFloat(e.target.value))} className="flex-1 accent-indigo-500" />
                            </div>
                        </div>

                        {/* Editor Footer / Next Button */}
                        <div className="absolute bottom-6 right-4 z-20">
                            <button onClick={() => setMobileStep(2)} className="bg-indigo-600 px-6 py-3 rounded-full font-bold shadow-lg flex items-center gap-2">
                                Avançar <div className="icon-arrow-right"></div>
                            </button>
                        </div>

                        {/* Audio Menu */}
                        {showAudioMenu && (
                            <div className="absolute inset-0 bg-black/95 z-50 flex flex-col">
                                <div className="p-4 flex justify-between items-center border-b border-gray-800">
                                    <h2 className="font-bold text-lg">Selecionar Som</h2>
                                    <button onClick={() => setShowAudioMenu(false)}><div className="icon-x text-2xl"></div></button>
                                </div>
                                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                                    <div className={`flex items-center gap-3 p-3 rounded-xl ${!selectedAudio ? 'bg-indigo-600/30 border border-indigo-500' : 'bg-gray-800'}`} onClick={() => { setSelectedAudio(null); setShowAudioMenu(false); }}>
                                        <div className="w-12 h-12 bg-gray-700 rounded-lg flex items-center justify-center">
                                            <div className="icon-x text-gray-400"></div>
                                        </div>
                                        <div><h3 className="font-bold">Nenhum som</h3></div>
                                    </div>
                                    {audios.map(audio => (
                                        <div key={audio.id} className={`flex items-center gap-3 p-3 rounded-xl ${selectedAudio?.id === audio.id ? 'bg-indigo-600/30 border border-indigo-500' : 'bg-gray-800'}`} onClick={() => { setSelectedAudio(audio); setShowAudioMenu(false); }}>
                                            <img src={audio.coverUrl || 'https://via.placeholder.com/150'} className="w-12 h-12 rounded-lg object-cover" />
                                            <div>
                                                <h3 className="font-bold text-sm">{audio.name}</h3>
                                                <p className="text-xs text-gray-400">{audio.artistName}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Add Text Modal */}
                        {isAddingText && (
                            <div className="absolute inset-0 bg-black/90 z-50 flex flex-col">
                                <div className="flex justify-between items-center p-4">
                                    <button onClick={() => setIsAddingText(false)} className="text-white">Cancelar</button>
                                    <button onClick={addText} className="font-bold text-indigo-400">Concluído</button>
                                </div>
                                <div className="flex-1 flex items-center justify-center p-6">
                                    <input 
                                        type="text" 
                                        autoFocus
                                        value={currentText}
                                        onChange={(e) => setCurrentText(e.target.value)}
                                        placeholder="Digite algo..." 
                                        className="w-full text-center text-3xl bg-transparent border-none outline-none font-bold placeholder-gray-600"
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* STEP 2: Details & Upload */}
                {mobileStep === 2 && (
                    <div className="flex-1 flex flex-col bg-gray-900">
                        <div className="flex items-center justify-between p-4 border-b border-gray-800 bg-gray-900">
                            <button onClick={() => setMobileStep(1)} className="p-2"><div className="icon-arrow-left text-xl"></div></button>
                            <h1 className="font-bold text-lg">Publicar</h1>
                            <div className="w-8"></div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4 space-y-6">
                            <div className="flex gap-4">
                                <textarea 
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    placeholder="Descreva seu vídeo ou adicione um título... #hashtags" 
                                    className="flex-1 bg-transparent border-none outline-none resize-none h-24 text-lg"
                                />
                                <div className="w-20 h-28 bg-gray-800 rounded-lg overflow-hidden flex-shrink-0">
                                    <video src={previewUrl} className="w-full h-full object-cover" />
                                </div>
                            </div>

                            <div className="border-t border-gray-800 pt-4">
                                <div className="flex items-center justify-between py-3">
                                    <div className="flex items-center gap-3">
                                        <div className="icon-download text-xl text-gray-400"></div>
                                        <span className="text-lg">Permitir Download</span>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input type="checkbox" className="sr-only peer" checked={allowDownload} onChange={(e) => setAllowDownload(e.target.checked)} />
                                        <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                                    </label>
                                </div>
                            </div>
                        </div>

                        <div className="p-4 border-t border-gray-800 bg-gray-900">
                            <button 
                                onClick={uploadToBackend}
                                disabled={isUploading || !title.trim()}
                                className="w-full bg-indigo-600 text-white p-4 rounded-xl font-bold flex justify-center items-center gap-2 disabled:opacity-50"
                            >
                                {isUploading ? (
                                    <><div className="icon-loader animate-spin"></div> {uploadStatus} {uploadProgress}%</>
                                ) : (
                                    <><div className="icon-upload"></div> Publicar</>
                                )}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    // DESKTOP RENDER (Current original design)
    return (
        <div className="fixed inset-0 bg-gray-900 z-[100] flex text-white overflow-hidden" data-name="video-upload" data-file="components/VideoUpload.js">
            {toast && (
                <div className="fixed top-10 left-1/2 transform -translate-x-1/2 z-[110] bg-gray-800 text-white px-4 py-2 rounded-full shadow-lg text-sm flex items-center gap-2">
                    <div className="icon-info text-indigo-400"></div>
                    {toast}
                </div>
            )}
            
            <div className={`flex-1 flex flex-col p-8 overflow-y-auto ${previewUrl ? 'w-[60%]' : 'w-full'}`}>
                <div className="flex items-center justify-between mb-8">
                    <h1 className="text-2xl font-bold flex items-center gap-2"><div className="icon-video"></div> Studio de Criação</h1>
                    <button onClick={onClose} className="p-2 hover:bg-gray-800 rounded-full"><div className="icon-x text-2xl"></div></button>
                </div>

                <div className="max-w-2xl mx-auto w-full space-y-6">
                    {!previewUrl ? (
                        <div 
                            className="border-2 border-dashed border-gray-600 rounded-2xl p-10 flex flex-col items-center justify-center bg-gray-800/50 hover:bg-gray-800 transition cursor-pointer"
                            onDragOver={handleDragOver}
                            onDrop={handleDrop}
                            onClick={() => document.getElementById('video-input-desktop').click()}
                        >
                            <div className="icon-cloud-upload text-6xl text-gray-400 mb-4"></div>
                            <h3 className="text-xl font-bold mb-2">Arraste um vídeo ou clique para selecionar</h3>
                            <p className="text-gray-500 text-sm text-center">MP4, WebM ou OGG. Máx 5MB.</p>
                            <input id="video-input-desktop" type="file" accept="video/*" className="hidden" onChange={handleFileChange} />
                            
                            <button className="mt-6 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-xl font-bold transition">
                                Selecionar Arquivo
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="flex justify-between items-center bg-gray-800 p-4 rounded-xl">
                                <span className="truncate text-sm">{file.name}</span>
                                <button onClick={() => { setFile(null); setPreviewUrl(''); }} className="text-red-400 text-sm hover:underline">Remover</button>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-1">Título do Vídeo *</label>
                                <input 
                                    type="text" 
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    placeholder="Ex: Minha dança épica #viral" 
                                    className="w-full bg-gray-800 border border-gray-700 rounded-xl p-3 outline-none focus:border-indigo-500 transition"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-1">Descrição e Hashtags</label>
                                <textarea 
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    placeholder="Conte mais sobre o vídeo... Use #hashtags" 
                                    className="w-full bg-gray-800 border border-gray-700 rounded-xl p-3 outline-none focus:border-indigo-500 transition h-32 resize-none"
                                />
                            </div>

                            <div className="flex items-center justify-between bg-gray-800 p-4 rounded-xl">
                                <div>
                                    <h4 className="font-medium">Permitir Download</h4>
                                    <p className="text-xs text-gray-400">Outros usuários podem baixar este vídeo</p>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input type="checkbox" className="sr-only peer" checked={allowDownload} onChange={(e) => setAllowDownload(e.target.checked)} />
                                    <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                                </label>
                            </div>

                            <button 
                                onClick={uploadToBackend}
                                disabled={isUploading}
                                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white p-4 rounded-xl font-bold transition flex justify-center items-center gap-2 mt-4"
                            >
                                {isUploading ? (
                                    <><div className="icon-loader animate-spin"></div> {uploadStatus} {uploadProgress}%</>
                                ) : (
                                    <><div className="icon-upload"></div> Publicar Vídeo</>
                                )}
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {previewUrl && (
                <div className="w-[40%] border-l border-gray-800 bg-black flex flex-col justify-center items-center p-4 relative">
                    <div className="w-full max-w-[350px] aspect-[9/16] bg-gray-900 rounded-2xl overflow-hidden relative shadow-2xl border border-gray-800 mx-auto">
                        <video src={previewUrl} className="w-full h-full object-cover" autoPlay loop muted playsInline />
                        
                        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/80 flex flex-col justify-end p-4">
                            <div className="flex items-end justify-between">
                                <div className="flex-1 pr-12">
                                    <h3 className="font-bold text-lg">@{user.name.replace(/\s/g, '').toLowerCase()}</h3>
                                    <p className="text-sm mt-1 font-medium">{title || 'Seu título aparecerá aqui'}</p>
                                    <p className="text-xs mt-1 text-gray-300 line-clamp-2">{description || 'Descrição e #hashtags'}</p>
                                </div>
                                <div className="flex flex-col items-center gap-5 pb-2">
                                    <div className="w-11 h-11 rounded-full bg-gray-500 border-2 border-white overflow-hidden">
                                        {user.avatar ? <img src={user.avatar} className="w-full h-full object-cover"/> : null}
                                    </div>
                                    <div className="icon-heart text-3xl"></div>
                                    <div className="icon-message-circle text-3xl"></div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

window.VideoUpload = VideoUpload;