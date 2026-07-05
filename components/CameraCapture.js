function CameraCapture({ onCapture, onClose, photoOnly = false }) {
    const videoRef = React.useRef(null);
    const canvasRef = React.useRef(null);
    const arCanvasRef = React.useRef(null);
    const streamRef = React.useRef(null);
    const mediaRecorderRef = React.useRef(null);
    const recordedChunksRef = React.useRef([]);
    const holdTimerRef = React.useRef(null);
    const recordingDurationRef = React.useRef(null);
    const animationFrameRef = React.useRef(null);
    const faceLandmarkerRef = React.useRef(null);
    const lastVideoTimeRef = React.useRef(-1);

    const [hasPermission, setHasPermission] = React.useState(null);
    const [facingMode, setFacingMode] = React.useState('user'); // default to user for AR
    const [isRecording, setIsRecording] = React.useState(false);
    const [recordingTime, setRecordingTime] = React.useState(0);
    const [previewMedia, setPreviewMedia] = React.useState(null); // { type: 'image' | 'video', url: string, blob: Blob }
    const [showFlash, setShowFlash] = React.useState(false);
    const [gridVisible, setGridVisible] = React.useState(false);
    const [zoom, setZoom] = React.useState(1);
    const [capabilities, setCapabilities] = React.useState(null);
    const [arEnabled, setArEnabled] = React.useState(false);
    const [filters, setFilters] = React.useState([
        { id: 'none', name: 'Nenhum', type: 'none', url: '' },
        { id: 'glasses_thug', name: 'Óculos Thug', type: 'eyes', url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e8/Sunglasses_icon.svg/512px-Sunglasses_icon.svg.png' },
        { id: 'mask_anon', name: 'Máscara', type: 'face', url: 'https://cdn-icons-png.flaticon.com/512/2821/2821035.png' },
        { id: 'hat_crown', name: 'Coroa', type: 'head', url: 'https://cdn-icons-png.flaticon.com/512/1004/1004733.png' }
    ]);
    const [selectedFilter, setSelectedFilter] = React.useState('none');
    const filterImageRef = React.useRef(new Image());
    const [showFilterMenu, setShowFilterMenu] = React.useState(false);

    // Initialize MediaPipe FaceLandmarker
    React.useEffect(() => {
        let isMounted = true;
        const initAR = async () => {
            try {
                if (!window.FaceLandmarker) {
                    const module = await import("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14");
                    window.FaceLandmarker = module.FaceLandmarker;
                    window.FilesetResolver = module.FilesetResolver;
                }
                const vision = await window.FilesetResolver.forVisionTasks(
                    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm"
                );
                const landmarker = await window.FaceLandmarker.createFromOptions(
                    vision,
                    {
                        baseOptions: {
                            modelAssetPath: "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/latest/face_landmarker.task",
                            delegate: "GPU"
                        },
                        runningMode: "VIDEO",
                        numFaces: 1
                    }
                );
                if (isMounted) {
                    faceLandmarkerRef.current = landmarker;
                    setArEnabled(true);
                }
            } catch (e) {
                console.error("Error initializing AR:", e);
            }
        };

        initAR();

        return () => { 
            isMounted = false; 
            if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
            if (faceLandmarkerRef.current) faceLandmarkerRef.current.close();
        };
    }, []);

    React.useEffect(() => {
        const filter = filters.find(f => f.id === selectedFilter);
        if (filter && filter.url) {
            filterImageRef.current.src = filter.url;
            filterImageRef.current.crossOrigin = "anonymous";
        }
    }, [selectedFilter, filters]);

    const playShutterSound = () => {
        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            const ctx = new AudioContext();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.type = 'square';
            osc.frequency.setValueAtTime(800, ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.1);
            gain.gain.setValueAtTime(0.5, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
            osc.start();
            osc.stop(ctx.currentTime + 0.1);
        } catch (e) {
            console.error("Audio error", e);
        }
    };

    const vibrate = (duration = 50) => {
        if ('vibrate' in navigator) navigator.vibrate(duration);
    };

    const startCamera = async () => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
        }

        try {
            const constraints = {
                video: {
                    facingMode,
                    width: { ideal: 640, max: 1280 }, // Very compressed resolution
                    height: { ideal: 480, max: 720 },
                    frameRate: { ideal: 24, max: 30 }
                },
                audio: true
            };
            
            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            streamRef.current = stream;
            
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                // Wait for video to be ready before playing to avoid DOM exceptions
                videoRef.current.onloadedmetadata = () => {
                    videoRef.current.play().catch(e => console.error("Error playing video:", e));
                    setHasPermission(true);
                };
            }

            // Get capabilities for zoom etc
            const track = stream.getVideoTracks()[0];
            if (track.getCapabilities) {
                setCapabilities(track.getCapabilities());
            }
        } catch (err) {
            console.error("Camera access denied or error:", err);
            setHasPermission(false);
        }
    };

    React.useEffect(() => {
        startCamera();
        return () => {
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(track => track.stop());
            }
            clearInterval(recordingDurationRef.current);
        };
    }, [facingMode]);

    // AR Rendering loop
    const predictWebcam = () => {
        const video = videoRef.current;
        const arCanvas = arCanvasRef.current;
        if (!video || !arCanvas || !faceLandmarkerRef.current) return;

        const filter = filters.find(f => f.id === selectedFilter);
        
        arCanvas.width = video.videoWidth;
        arCanvas.height = video.videoHeight;
        
        const ctx = arCanvas.getContext("2d");
        ctx.clearRect(0, 0, arCanvas.width, arCanvas.height);

        // Se usar a câmera frontal, queremos o modo "espelho" no render do video.
        // O MediaPipe retorna coordenadas já considerando a imagem normal, mas como a exibimos espelhada,
        // vamos desenhar os efeitos também espelhados ou adequar as coordenadas.
        if (facingMode === 'user') {
            ctx.translate(arCanvas.width, 0);
            ctx.scale(-1, 1);
        }

        if (filter.id !== 'none' && video.currentTime !== lastVideoTimeRef.current) {
            lastVideoTimeRef.current = video.currentTime;
            
            try {
                const startTimeMs = performance.now();
                const results = faceLandmarkerRef.current.detectForVideo(video, startTimeMs);

                if (results.faceLandmarks && results.faceLandmarks.length > 0) {
                    const face = results.faceLandmarks[0];
                    const img = filterImageRef.current;

                    if (img.complete && img.naturalHeight !== 0) {
                        if (filter.type === 'eyes') {
                            const leftEye = face[33];
                            const rightEye = face[263];
                            const x1 = leftEye.x * arCanvas.width;
                            const y1 = leftEye.y * arCanvas.height;
                            const x2 = rightEye.x * arCanvas.width;
                            const y2 = rightEye.y * arCanvas.height;
                            
                            const centerX = (x1 + x2) / 2;
                            const centerY = (y1 + y2) / 2;
                            const eyeDistance = Math.hypot(x2 - x1, y2 - y1);
                            const angle = Math.atan2(y2 - y1, x2 - x1);
                            
                            const width = eyeDistance * 2.2;
                            const height = width * 0.55;

                            ctx.save();
                            ctx.translate(centerX, centerY);
                            ctx.rotate(angle);
                            ctx.drawImage(img, -width / 2, -height / 2, width, height);
                            ctx.restore();
                        } else if (filter.type === 'face' || filter.type === 'head') {
                            // Simplified logic for face/head
                            const top = face[10];
                            const bottom = face[152];
                            const left = face[234];
                            const right = face[454];

                            const faceWidth = Math.abs((right.x - left.x) * arCanvas.width);
                            const centerX = face[1].x * arCanvas.width;
                            const centerY = (filter.type === 'head' ? face[10].y : face[1].y) * arCanvas.height;
                            
                            const width = faceWidth * 1.5;
                            const height = width * (img.naturalHeight / img.naturalWidth);
                            
                            // Adjust Y if it's a hat
                            let finalY = centerY - height / 2;
                            if(filter.type === 'head') {
                                finalY -= height / 2;
                            }

                            ctx.save();
                            ctx.translate(centerX, finalY + height/2);
                            ctx.drawImage(img, -width / 2, -height / 2, width, height);
                            ctx.restore();
                        }
                    }
                }
            } catch (e) {
                console.error("Error detecting face", e);
            }
        }

        animationFrameRef.current = requestAnimationFrame(predictWebcam);
    };

    React.useEffect(() => {
        if (hasPermission) {
            predictWebcam();
        }
        return () => {
            if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
        };
    }, [hasPermission, selectedFilter, facingMode]);

    const handleZoomChange = (e) => {
        const newZoom = parseFloat(e.target.value);
        setZoom(newZoom);
        const track = streamRef.current?.getVideoTracks()[0];
        if (track && capabilities?.zoom) {
            track.applyConstraints({ advanced: [{ zoom: newZoom }] }).catch(console.error);
        }
    };

    const takePhoto = () => {
        if (!videoRef.current || !canvasRef.current) return;
        
        playShutterSound();
        vibrate(50);
        setShowFlash(true);
        setTimeout(() => setShowFlash(false), 150);

        const video = videoRef.current;
        const canvas = canvasRef.current;
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        
        const ctx = canvas.getContext('2d');
        if (facingMode === 'user') {
            ctx.translate(canvas.width, 0);
            ctx.scale(-1, 1);
        }
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        // Draw AR Canvas over it
        if (arCanvasRef.current && selectedFilter !== 'none') {
            // we already mirrored the arCanvas rendering logic, so if the camera is mirrored, we might need to be careful
            // actually, since ctx is mirrored for drawing the video, and arCanvas is NOT mirrored internally but mirrored during predict, 
            // we should draw the arCanvas with mirror inverted so it places correctly.
            ctx.save();
            if (facingMode === 'user') {
                 // reset scale for AR canvas because it was already rendered mirrored
                 ctx.scale(-1, 1);
                 ctx.translate(-canvas.width, 0);
            }
            ctx.drawImage(arCanvasRef.current, 0, 0);
            ctx.restore();
        }
        
        canvas.toBlob((blob) => {
            if(blob) {
                const url = URL.createObjectURL(blob);
                setPreviewMedia({ type: 'image', url, blob });
            }
        }, 'image/jpeg', 0.8);
    };

    const startRecording = () => {
        if (!streamRef.current) return;
        
        vibrate(50);
        recordedChunksRef.current = [];
        
        // Determinar o melhor mimeType suportado
        let mimeType = '';
        if (MediaRecorder.isTypeSupported('video/webm; codecs=vp9')) {
            mimeType = 'video/webm; codecs=vp9';
        } else if (MediaRecorder.isTypeSupported('video/webm')) {
            mimeType = 'video/webm';
        } else if (MediaRecorder.isTypeSupported('video/mp4')) {
            mimeType = 'video/mp4';
        }
        
        const options = mimeType ? { mimeType, videoBitsPerSecond: 250000, audioBitsPerSecond: 16000 } : { videoBitsPerSecond: 250000, audioBitsPerSecond: 16000 };
        
        try {
            mediaRecorderRef.current = new MediaRecorder(streamRef.current, options);
        } catch (e) {
            mediaRecorderRef.current = new MediaRecorder(streamRef.current, { videoBitsPerSecond: 250000, audioBitsPerSecond: 16000 });
        }

        mediaRecorderRef.current.ondataavailable = (e) => {
            if (e.data.size > 0) recordedChunksRef.current.push(e.data);
        };

        mediaRecorderRef.current.onstop = () => {
            clearInterval(recordingDurationRef.current);
            const actualMimeType = mediaRecorderRef.current.mimeType || mimeType || 'video/mp4';
            const blob = new Blob(recordedChunksRef.current, { type: actualMimeType });
            const url = URL.createObjectURL(blob);
            setPreviewMedia({ type: 'video', url, blob, mimeType: actualMimeType });
            setIsRecording(false);
            setRecordingTime(0);
        };

        mediaRecorderRef.current.start();
        setIsRecording(true);
        
        recordingDurationRef.current = setInterval(() => {
            setRecordingTime(prev => {
                if (prev >= 59) {
                    stopRecording();
                    return 60;
                }
                return prev + 1;
            });
        }, 1000);
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            vibrate(50);
            mediaRecorderRef.current.stop();
        }
    };

    const handleButtonPress = () => {
        if (photoOnly) return;
        holdTimerRef.current = setTimeout(() => {
            startRecording();
        }, 500); // 500ms hold to record video
    };

    const handleButtonRelease = () => {
        if (!photoOnly && holdTimerRef.current) {
            clearTimeout(holdTimerRef.current);
        }
        if (!photoOnly && isRecording) {
            stopRecording();
        } else {
            // Tap
            takePhoto();
        }
    };

    const handleSend = () => {
        if (previewMedia) {
            // Convert to File object
            const isMp4 = previewMedia.mimeType && previewMedia.mimeType.includes('mp4');
            const ext = previewMedia.type === 'image' ? 'jpg' : (isMp4 ? 'mp4' : 'webm');
            const type = previewMedia.type === 'image' ? 'image/jpeg' : (previewMedia.mimeType || 'video/mp4');
            const file = new File([previewMedia.blob], `capture_${Date.now()}.${ext}`, { type });
            onCapture(file, previewMedia.type);
        }
    };

    const handleSave = () => {
        if (previewMedia) {
            const a = document.createElement('a');
            a.href = previewMedia.url;
            const isMp4 = previewMedia.mimeType && previewMedia.mimeType.includes('mp4');
            const ext = previewMedia.type === 'image' ? 'jpg' : (isMp4 ? 'mp4' : 'webm');
            a.download = `capture_${Date.now()}.${ext}`;
            a.click();
            vibrate(50);
        }
    };

    if (hasPermission === false) {
        return (
            <div className="fixed inset-0 bg-black z-[100] flex flex-col items-center justify-center text-white" data-name="camera-denied" data-file="components/CameraCapture.js">
                <div className="icon-camera-off text-6xl text-red-500 mb-4"></div>
                <h2 className="text-xl font-bold mb-4">Acesso Negado</h2>
                <button onClick={onClose} className="px-6 py-2 bg-gray-800 rounded-full">Fechar</button>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 bg-black z-[100] flex flex-col select-none" data-name="camera-capture" data-file="components/CameraCapture.js">
            {/* Top Bar */}
            <div className={`absolute top-0 left-0 right-0 h-16 bg-gradient-to-b from-black/50 to-transparent z-20 flex items-center justify-between px-4 ${previewMedia ? 'hidden' : ''}`}>
                <button onClick={onClose} className="p-2 text-white">
                    <div className="icon-x text-2xl"></div>
                </button>
                <div className="flex gap-4">
                    <button onClick={() => setGridVisible(!gridVisible)} className={`p-2 ${gridVisible ? 'text-yellow-400' : 'text-white'}`}>
                        <div className="icon-grid-3x3 text-2xl"></div>
                    </button>
                    <button onClick={() => setFacingMode(prev => prev === 'user' ? 'environment' : 'user')} className="p-2 text-white">
                        <div className="icon-camera text-2xl"></div>
                    </button>
                </div>
            </div>

            {/* Video View */}
            <div className={`flex-1 relative overflow-hidden bg-black flex items-center justify-center ${previewMedia ? 'hidden' : ''}`}>
                {!hasPermission && <div className="absolute inset-0 flex items-center justify-center text-white"><div className="icon-loader animate-spin text-4xl"></div></div>}
                <video 
                    ref={videoRef} 
                    autoPlay 
                    playsInline 
                    muted 
                    className={`absolute w-full h-full object-cover ${facingMode === 'user' ? '-scale-x-100' : ''}`}
                />
                
                {/* AR Canvas */}
                <canvas 
                    ref={arCanvasRef} 
                    className="absolute w-full h-full object-cover pointer-events-none z-10" 
                />

                <canvas ref={canvasRef} className="hidden" />

                {/* Grid Overlay */}
                {gridVisible && (
                    <div className="absolute inset-0 pointer-events-none flex flex-col justify-between z-10">
                        <div className="w-full h-1/3 border-b border-white/30"></div>
                        <div className="w-full h-1/3 border-b border-white/30"></div>
                        <div className="absolute inset-0 flex justify-between">
                            <div className="h-full w-1/3 border-r border-white/30"></div>
                            <div className="h-full w-1/3 border-r border-white/30"></div>
                        </div>
                    </div>
                )}

                {/* Flash Animation */}
                {showFlash && <div className="absolute inset-0 bg-white z-30 animate-fade-out"></div>}
                
                {/* Recording Timer */}
                {!photoOnly && isRecording && (
                    <div className="absolute top-20 left-1/2 -translate-x-1/2 z-20 bg-red-500/80 px-4 py-1 rounded-full flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-white animate-pulse"></div>
                        <span className="text-white font-mono font-bold tracking-wider">
                            00:{recordingTime.toString().padStart(2, '0')}
                        </span>
                    </div>
                )}

                {/* Filter Menu Toggle (Oculto temporariamente) */}
                {false && arEnabled && (
                    <div className="absolute right-4 bottom-24 z-20">
                        <button 
                            onClick={() => setShowFilterMenu(!showFilterMenu)}
                            className={`w-12 h-12 rounded-full flex items-center justify-center bg-black/50 text-white border-2 transition-colors ${selectedFilter !== 'none' ? 'border-yellow-400' : 'border-white/50'}`}
                        >
                            <div className="icon-wand-sparkles text-xl"></div>
                        </button>
                    </div>
                )}

                {/* Filter Carousel (Oculto temporariamente) */}
                {false && showFilterMenu && (
                    <div className="absolute bottom-36 left-0 right-0 z-20 px-4 py-2 flex gap-4 overflow-x-auto no-scrollbar pb-2 items-end animate-fade-in-up">
                        {filters.map(filter => (
                            <div 
                                key={filter.id}
                                onClick={() => setSelectedFilter(filter.id)}
                                className={`flex-shrink-0 flex flex-col items-center gap-2 cursor-pointer transition-transform ${selectedFilter === filter.id ? 'scale-110' : 'scale-100 opacity-80'}`}
                            >
                                <div className={`w-16 h-16 rounded-full border-2 bg-black/60 flex items-center justify-center overflow-hidden ${selectedFilter === filter.id ? 'border-yellow-400' : 'border-white/50'}`}>
                                    {filter.url ? (
                                        <img src={filter.url} alt={filter.name} className="w-10 h-10 object-contain" />
                                    ) : (
                                        <div className="icon-x text-2xl text-white"></div>
                                    )}
                                </div>
                                <span className="text-[10px] text-white font-bold bg-black/50 px-2 py-0.5 rounded-full">{filter.name}</span>
                            </div>
                        ))}
                    </div>
                )}

                {/* Zoom Slider */}
                {capabilities?.zoom && (
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 h-48 flex items-center z-20">
                        <input 
                            type="range" 
                            min={capabilities.zoom.min} 
                            max={capabilities.zoom.max} 
                            step={capabilities.zoom.step || 0.1}
                            value={zoom}
                            onChange={handleZoomChange}
                            className="h-48 w-1 appearance-none bg-white/30 rounded-full outline-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full"
                            style={{ writingMode: 'bt-lr', WebkitAppearance: 'slider-vertical' }}
                        />
                    </div>
                )}
            </div>

            {/* Bottom Controls */}
            <div className={`h-32 bg-black flex items-center justify-center relative pb-4 z-20 ${previewMedia ? 'hidden' : ''}`}>
                <div 
                    className="relative flex items-center justify-center cursor-pointer"
                    onMouseDown={handleButtonPress}
                    onMouseUp={handleButtonRelease}
                    onMouseLeave={handleButtonRelease}
                    onTouchStart={handleButtonPress}
                    onTouchEnd={handleButtonRelease}
                >
                    {/* Outer Ring */}
                    <div className={`w-[86px] h-[86px] rounded-full border-4 flex items-center justify-center transition-all ${isRecording ? 'border-red-500 scale-110' : 'border-white'}`}>
                        {/* Inner Button */}
                        <div className={`rounded-full transition-all ${isRecording ? 'w-8 h-8 bg-red-500 rounded-lg' : 'w-[70px] h-[70px] bg-white'}`}></div>
                    </div>
                    
                    {/* Progress Circle (if recording) */}
                    {!photoOnly && isRecording && (
                        <svg className="absolute inset-0 w-[86px] h-[86px] -rotate-90 pointer-events-none">
                            <circle 
                                cx="43" cy="43" r="41" 
                                fill="none" stroke="red" strokeWidth="4" 
                                strokeDasharray="257" 
                                strokeDashoffset={257 - (recordingTime / 60) * 257}
                                className="transition-all duration-1000 ease-linear"
                            />
                        </svg>
                    )}
                </div>
            </div>

            {/* Preview Media Overlay */}
            {previewMedia && (
                <div className="absolute inset-0 bg-black z-[110] flex flex-col" data-name="camera-preview">
                    <div className="flex-1 relative flex items-center justify-center overflow-hidden">
                        {previewMedia.type === 'image' ? (
                            <img src={previewMedia.url} className="w-full h-full object-contain" />
                        ) : (
                            <video src={previewMedia.url} controls autoPlay loop className="w-full h-full object-contain" />
                        )}
                    </div>
                    <div className="h-24 bg-black flex items-center justify-between px-8">
                        <button onClick={() => setPreviewMedia(null)} className="flex flex-col items-center text-white">
                            <div className="w-12 h-12 rounded-full bg-gray-800 flex items-center justify-center hover:bg-gray-700">
                                <div className="icon-x text-2xl"></div>
                            </div>
                            <span className="text-xs mt-1">Refazer</span>
                        </button>
                        
                        <button onClick={handleSave} className="flex flex-col items-center text-white">
                            <div className="w-12 h-12 rounded-full bg-gray-800 flex items-center justify-center hover:bg-gray-700">
                                <div className="icon-download text-2xl"></div>
                            </div>
                            <span className="text-xs mt-1">Salvar</span>
                        </button>

                        <button onClick={handleSend} className="flex flex-col items-center text-white">
                            <div className="w-14 h-14 rounded-full bg-green-500 flex items-center justify-center hover:bg-green-600">
                                <div className="icon-send text-2xl ml-1"></div>
                            </div>
                            <span className="text-xs mt-1">Enviar</span>
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

window.CameraCapture = CameraCapture;