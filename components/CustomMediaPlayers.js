function CustomAudioPlayer({ src, isOwn }) {
    const audioRef = React.useRef(null);
    const [isPlaying, setIsPlaying] = React.useState(false);
    const [progress, setProgress] = React.useState(0);
    const [timeDisplay, setTimeDisplay] = React.useState("0:00");

    const togglePlay = () => {
        if (!audioRef.current) return;
        if (audioRef.current.paused) {
            audioRef.current.play();
            setIsPlaying(true);
        } else {
            audioRef.current.pause();
            setIsPlaying(false);
        }
    };

    const onTimeUpdate = () => {
        if (!audioRef.current) return;
        const current = audioRef.current.currentTime;
        const total = audioRef.current.duration || 1;
        setProgress((current / total) * 100);
        
        const mins = Math.floor(current / 60);
        const secs = Math.floor(current % 60).toString().padStart(2, '0');
        setTimeDisplay(`${mins}:${secs}`);
    };

    const onEnded = () => {
        setIsPlaying(false);
        setProgress(0);
        setTimeDisplay("0:00");
    };

    const handleSeek = (e) => {
        if (!audioRef.current) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const percentage = Math.max(0, Math.min(1, x / rect.width));
        const newTime = percentage * (audioRef.current.duration || 0);
        if (isFinite(newTime)) {
            audioRef.current.currentTime = newTime;
            setProgress(percentage * 100);
        }
    };

    return (
        <div className={`flex items-center gap-3 rounded-full p-2 mt-2 w-[250px] sm:w-[300px] ${isOwn ? 'bg-white/20' : 'bg-black/5'}`}>
            <audio ref={audioRef} src={src} onTimeUpdate={onTimeUpdate} onEnded={onEnded} preload="metadata" />
            
            <button onClick={togglePlay} className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-transform hover:scale-105 shadow-sm ${isOwn ? 'bg-white text-indigo-600' : 'bg-indigo-500 text-white'}`}>
                <div className={`icon-${isPlaying ? 'pause' : 'play'} text-xl ${!isPlaying ? 'ml-1' : ''}`}></div>
            </button>
            
            <div className="flex-1 h-2.5 rounded-full cursor-pointer relative" onClick={handleSeek} style={{ backgroundColor: isOwn ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.1)' }}>
                <div className={`absolute top-0 left-0 bottom-0 rounded-full pointer-events-none transition-all duration-100 ${isOwn ? 'bg-white' : 'bg-indigo-500'}`} style={{ width: `${progress}%` }}></div>
            </div>
            
            <div className={`text-[11px] font-mono shrink-0 w-8 tracking-wider ${isOwn ? 'text-indigo-100' : 'text-gray-500'}`}>
                {timeDisplay}
            </div>
        </div>
    );
}

function CustomVideoPlayer({ src }) {
    const videoRef = React.useRef(null);
    const [isPlaying, setIsPlaying] = React.useState(false);
    const [progress, setProgress] = React.useState(0);
    const [timeDisplay, setTimeDisplay] = React.useState("0:00");

    const togglePlay = (e) => {
        if (e) e.stopPropagation();
        if (!videoRef.current) return;
        if (videoRef.current.paused) {
            videoRef.current.play();
            setIsPlaying(true);
        } else {
            videoRef.current.pause();
            setIsPlaying(false);
        }
    };

    const onTimeUpdate = () => {
        if (!videoRef.current) return;
        const current = videoRef.current.currentTime;
        const total = videoRef.current.duration || 1;
        setProgress((current / total) * 100);
        
        const mins = Math.floor(current / 60);
        const secs = Math.floor(current % 60).toString().padStart(2, '0');
        setTimeDisplay(`${mins}:${secs}`);
    };

    const onEnded = () => {
        setIsPlaying(false);
        setProgress(0);
        setTimeDisplay("0:00");
    };

    const handleSeek = (e) => {
        if (e) e.stopPropagation();
        if (!videoRef.current) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const percentage = Math.max(0, Math.min(1, x / rect.width));
        const newTime = percentage * (videoRef.current.duration || 0);
        if (isFinite(newTime)) {
            videoRef.current.currentTime = newTime;
            setProgress(percentage * 100);
        }
    };

    const toggleFullscreen = (e) => {
        if (e) e.stopPropagation();
        if (!videoRef.current) return;
        if (videoRef.current.requestFullscreen) {
            videoRef.current.requestFullscreen();
        } else if (videoRef.current.webkitRequestFullscreen) {
            videoRef.current.webkitRequestFullscreen();
        }
    };

    return (
        <div className="relative mt-2 mb-1 rounded-xl overflow-hidden group max-w-sm bg-black shadow-md border border-black/10">
            <video 
                ref={videoRef} 
                src={src} 
                className="w-full max-h-[300px] object-contain cursor-pointer" 
                onClick={togglePlay} 
                onTimeUpdate={onTimeUpdate} 
                onEnded={onEnded}
                playsInline
                preload="metadata"
            />
            
            {!isPlaying && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/30 cursor-pointer pointer-events-none">
                    <div className="w-14 h-14 bg-white/90 rounded-full flex items-center justify-center text-indigo-600 backdrop-blur-sm shadow-xl pointer-events-auto cursor-pointer hover:scale-110 transition-transform" onClick={togglePlay}>
                        <div className="icon-play text-2xl ml-1"></div>
                    </div>
                </div>
            )}
            
            <div className="absolute bottom-0 left-0 right-0 p-3 pt-8 bg-gradient-to-t from-black/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-3">
                <button onClick={togglePlay} className="text-white hover:text-indigo-400 transition-colors">
                    <div className={`icon-${isPlaying ? 'pause' : 'play'} text-xl`}></div>
                </button>
                
                <div className="flex-1 h-1.5 bg-white/30 rounded-full cursor-pointer relative" onClick={handleSeek}>
                    <div className="absolute top-0 left-0 bottom-0 bg-indigo-500 rounded-full pointer-events-none transition-all duration-100" style={{ width: `${progress}%` }}></div>
                </div>
                
                <div className="text-white text-xs font-mono tracking-wider">{timeDisplay}</div>
                
                <button onClick={toggleFullscreen} className="text-white hover:text-indigo-400 transition-colors ml-1">
                    <div className="icon-maximize text-lg"></div>
                </button>
            </div>
        </div>
    );
}

function UniversalVideoPlayer({ src }) {
    const getYouTubeId = (url) => {
        const regExp = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|e(?:mbed)?)\/|\S*?[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
        const match = url.match(regExp);
        return match ? match[1] : null;
    };

    const ytId = getYouTubeId(src);

    if (ytId) {
        return (
            <div className="relative mt-2 mb-1 rounded-xl overflow-hidden max-w-sm w-full bg-black shadow-md border border-black/10 aspect-video">
                <iframe
                    className="w-full h-full"
                    src={`https://www.youtube.com/embed/${ytId}?rel=0&modestbranding=1`}
                    title="YouTube video player"
                    frameBorder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                ></iframe>
            </div>
        );
    }

    return <CustomVideoPlayer src={src} />;
}

window.CustomAudioPlayer = CustomAudioPlayer;
window.CustomVideoPlayer = CustomVideoPlayer;
window.UniversalVideoPlayer = UniversalVideoPlayer;
