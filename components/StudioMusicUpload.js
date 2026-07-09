function StudioMusicUpload({ onClose, onSuccess }) {
    const [loading, setLoading] = React.useState(false);
    const [formData, setFormData] = React.useState({
        title: '',
        description: '',
        youtubeUrl: '',
        spotifyUrl: '',
        customAppUrl: '',
        customIconUrl: ''
    });
    const [audioFile, setAudioFile] = React.useState(null);
    const [bannerFile, setBannerFile] = React.useState(null);
    const [bannerPreview, setBannerPreview] = React.useState('');

    const handleBannerChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setBannerFile(file);
            const reader = new FileReader();
            reader.onloadend = () => {
                setBannerPreview(reader.result);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleAudioChange = (e) => {
        const file = e.target.files[0];
        if (file && file.type.includes('audio')) {
            setAudioFile(file);
        } else {
            alert('Por favor, selecione um arquivo de áudio válido (MP3).');
            e.target.value = '';
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (!formData.title || !audioFile || !bannerFile) {
            alert('Título, áudio e banner são obrigatórios!');
            return;
        }

        setLoading(true);

        try {
            const musicId = 'music_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            
            // Função auxiliar para converter arquivo em base64 (Data URL)
            const toBase64 = (file) => new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.readAsDataURL(file);
                reader.onload = () => resolve(reader.result);
                reader.onerror = error => reject(error);
            });

            // Converter arquivos para Base64
            const bannerUrl = await toBase64(bannerFile);
            const audioUrl = await toBase64(audioFile);

            const userData = JSON.parse(localStorage.getItem('user') || '{}');
            const authorName = userData.name || 'Usuário';
            
            // Save to Database directly in Base64
            await firebase.database().ref(`studio_musics/${musicId}`).set({
                title: formData.title,
                description: formData.description,
                artistName: authorName,
                youtubeUrl: formData.youtubeUrl,
                spotifyUrl: formData.spotifyUrl,
                customAppUrl: formData.customAppUrl,
                customIconUrl: formData.customIconUrl,
                bannerUrl: bannerUrl,
                audioUrl: audioUrl,
                createdAt: new Date().toISOString()
            });

            onSuccess();
        } catch (error) {
            console.error('Erro no upload:', error);
            alert('Ocorreu um erro ao enviar a música. Verifique sua conexão e configurações.');
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-[var(--dark-surface)] border border-[var(--dark-border)] rounded-2xl w-full max-w-2xl my-8 overflow-hidden shadow-2xl relative">
                {/* Header */}
                <div className="px-6 py-4 border-b border-[var(--dark-border)] flex justify-between items-center bg-gray-800/50 sticky top-0 z-10">
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <div className="icon-cloud-upload text-indigo-400"></div>
                        Upload de Música
                    </h2>
                    <button onClick={onClose} className="p-2 hover:bg-gray-700 rounded-lg text-gray-400 hover:text-white transition-colors">
                        <div className="icon-x text-xl"></div>
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                    {/* Upload Areas */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Banner Upload */}
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">Capa / Banner *</label>
                            <label className="block w-full aspect-video rounded-xl border-2 border-dashed border-gray-600 hover:border-indigo-500 bg-gray-800/50 cursor-pointer overflow-hidden group transition-colors relative">
                                <input type="file" accept="image/*" className="hidden" onChange={handleBannerChange} />
                                {bannerPreview ? (
                                    <div className="relative w-full h-full">
                                        <img src={bannerPreview} alt="Preview" className="w-full h-full object-cover" />
                                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                            <div className="icon-pencil text-white text-2xl"></div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center justify-center h-full text-gray-400 group-hover:text-indigo-400 transition-colors">
                                        <div className="icon-image text-3xl mb-2"></div>
                                        <span className="text-sm font-medium">Escolher imagem</span>
                                    </div>
                                )}
                            </label>
                        </div>

                        {/* Audio Upload */}
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">Arquivo MP3 *</label>
                            <label className={`block w-full aspect-video rounded-xl border-2 border-dashed ${audioFile ? 'border-green-500 bg-green-500/10' : 'border-gray-600 hover:border-indigo-500 bg-gray-800/50'} cursor-pointer group transition-colors flex flex-col items-center justify-center p-4 text-center`}>
                                <input type="file" accept="audio/*" className="hidden" onChange={handleAudioChange} />
                                {audioFile ? (
                                    <>
                                        <div className="w-12 h-12 rounded-full bg-green-500/20 text-green-500 flex items-center justify-center mb-2">
                                            <div className="icon-check text-2xl"></div>
                                        </div>
                                        <span className="text-sm font-medium text-green-400 line-clamp-1">{audioFile.name}</span>
                                        <span className="text-xs text-gray-400 mt-1">{(audioFile.size / 1024 / 1024).toFixed(2)} MB</span>
                                    </>
                                ) : (
                                    <>
                                        <div className="icon-music text-3xl mb-2 text-gray-400 group-hover:text-indigo-400 transition-colors"></div>
                                        <span className="text-sm font-medium text-gray-400 group-hover:text-indigo-400">Selecionar arquivo de áudio</span>
                                        <span className="text-xs text-gray-500 mt-1">MP3, WAV</span>
                                    </>
                                )}
                            </label>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-1">Título da Música *</label>
                            <input 
                                type="text" 
                                required
                                value={formData.title}
                                onChange={e => setFormData({...formData, title: e.target.value})}
                                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                                placeholder="Ex: Lofi Chill Beats"
                            />
                        </div>
                        
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-1">Descrição</label>
                            <textarea 
                                value={formData.description}
                                onChange={e => setFormData({...formData, description: e.target.value})}
                                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 h-24 resize-none"
                                placeholder="Conte um pouco sobre essa faixa..."
                            ></textarea>
                        </div>
                    </div>

                    {/* External Links Section */}
                    <div className="bg-gray-900/50 p-4 rounded-xl border border-gray-800 space-y-4">
                        <h3 className="font-medium text-white flex items-center gap-2 mb-2">
                            <div className="icon-link text-gray-400"></div>
                            Links Externos (Opcional)
                        </h3>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-medium text-gray-400 mb-1">URL do YouTube</label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <div className="icon-youtube text-red-500"></div>
                                    </div>
                                    <input 
                                        type="url" 
                                        value={formData.youtubeUrl}
                                        onChange={e => setFormData({...formData, youtubeUrl: e.target.value})}
                                        className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-10 pr-4 py-2 text-sm text-white focus:border-red-500 focus:ring-1 focus:ring-red-500"
                                        placeholder="https://youtube.com/watch?v=..."
                                    />
                                </div>
                            </div>
                            
                            <div>
                                <label className="block text-xs font-medium text-gray-400 mb-1">URL do Spotify</label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <div className="icon-headphones text-[#1DB954]"></div>
                                    </div>
                                    <input 
                                        type="url" 
                                        value={formData.spotifyUrl}
                                        onChange={e => setFormData({...formData, spotifyUrl: e.target.value})}
                                        className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-10 pr-4 py-2 text-sm text-white focus:border-[#1DB954] focus:ring-1 focus:ring-[#1DB954]"
                                        placeholder="https://open.spotify.com/track/..."
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="border-t border-gray-800 pt-4 mt-4">
                            <label className="block text-xs font-medium text-gray-400 mb-2">App Personalizado</label>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <input 
                                    type="url" 
                                    value={formData.customAppUrl}
                                    onChange={e => setFormData({...formData, customAppUrl: e.target.value})}
                                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-sm text-white focus:border-indigo-500"
                                    placeholder="URL do App"
                                />
                                <input 
                                    type="url" 
                                    value={formData.customIconUrl}
                                    onChange={e => setFormData({...formData, customIconUrl: e.target.value})}
                                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-sm text-white focus:border-indigo-500"
                                    placeholder="URL do Ícone do App"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex justify-end gap-3 pt-4 border-t border-[var(--dark-border)]">
                        <button 
                            type="button"
                            onClick={onClose}
                            disabled={loading}
                            className="px-5 py-2.5 rounded-lg text-gray-300 hover:text-white hover:bg-gray-800 font-medium transition-colors"
                        >
                            Cancelar
                        </button>
                        <button 
                            type="submit"
                            disabled={loading}
                            className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-2.5 rounded-lg font-medium flex items-center gap-2 transition-colors shadow-lg shadow-indigo-500/20"
                        >
                            {loading ? (
                                <>
                                    <div className="icon-loader animate-spin"></div>
                                    Enviando...
                                </>
                            ) : (
                                <>
                                    <div className="icon-upload"></div>
                                    Publicar Música
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}