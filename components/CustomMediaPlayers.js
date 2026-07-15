window.CustomAudioPlayer = ({ src, isOwn }) => {
    const audioRef = React.useRef(null);
    const [isPlaying, setIsPlaying] = React.useState(false);
    const [progress, setProgress] = React.useState(0);
    const [duration, setDuration] = React.useState(0);
    const [currentTime, setCurrentTime] = React.useState(0);

    React.useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;

        const handleTimeUpdate = () => {
            setCurrentTime(audio.currentTime);
            setProgress((audio.currentTime / audio.duration) * 100 || 0);
        };

        const handleLoadedMetadata = () => {
            setDuration(audio.duration);
        };

        const handleEnded = () => {
            setIsPlaying(false);
            setProgress(0);
            setCurrentTime(0);
        };

        audio.addEventListener('timeupdate', handleTimeUpdate);
        audio.addEventListener('loadedmetadata', handleLoadedMetadata);
        audio.addEventListener('ended', handleEnded);

        return () => {
            audio.removeEventListener('timeupdate', handleTimeUpdate);
            audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
            audio.removeEventListener('ended', handleEnded);
        };
    }, []);

    const togglePlay = (e) => {
        e.stopPropagation();
        const audio = audioRef.current;
        if (isPlaying) {
            audio.pause();
        } else {
            audio.play();
        }
        setIsPlaying(!isPlaying);
    };

    const handleSeek = (e) => {
        e.stopPropagation();
        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const clickedValue = x / rect.width;
        if (audioRef.current && duration) {
            audioRef.current.currentTime = clickedValue * duration;
        }
    };

    const formatTime = (time) => {
        if (!time || isNaN(time)) return '0:00';
        const m = Math.floor(time / 60);
        const s = Math.floor(time % 60);
        return `${m}:${s < 10 ? '0' : ''}${s}`;
    };

    return (
        <div className={`flex items-center gap-3 w-64 ${isOwn ? 'text-white' : 'text-gray-800'}`}>
            <audio ref={audioRef} src={src} preload="metadata" className="hidden" />
            <button 
                onClick={togglePlay}
                className={`flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-full transition-transform ${isPlaying ? 'scale-95' : 'hover:scale-105'} ${isOwn ? 'bg-white text-indigo-600' : 'bg-indigo-600 text-white'}`}
            >
                <div className={isPlaying ? 'icon-pause' : 'icon-play ml-1'} style={{fontSize: '1.25rem'}}></div>
            </button>
            <div className="flex-1">
                <div 
                    className={`h-1.5 rounded-full cursor-pointer relative overflow-hidden ${isOwn ? 'bg-indigo-400' : 'bg-gray-200'}`}
                    onClick={handleSeek}
                >
                    <div 
                        className={`absolute top-0 left-0 h-full rounded-full transition-all duration-100 ${isOwn ? 'bg-white' : 'bg-indigo-600'}`}
                        style={{ width: `${progress}%` }}
                    ></div>
                </div>
                <div className="flex justify-between mt-1 text-xs opacity-80">
                    <span>{formatTime(currentTime)}</span>
                    <span>{formatTime(duration)}</span>
                </div>
            </div>
            {isPlaying && (
                <div className="flex items-end gap-0.5 h-4 ml-1">
                    <div className="w-1 bg-current animate-pulse h-full" style={{ animationDelay: '0ms' }}></div>
                    <div className="w-1 bg-current animate-pulse h-2/3" style={{ animationDelay: '150ms' }}></div>
                    <div className="w-1 bg-current animate-pulse h-4/5" style={{ animationDelay: '300ms' }}></div>
                </div>
            )}
        </div>
    );
};