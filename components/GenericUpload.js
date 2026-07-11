function GenericUpload({ user, contentType, config, onClose, onUploadComplete }) {
    const [file, setFile] = React.useState(null);
    const [previewUrl, setPreviewUrl] = React.useState('');
    const [title, setTitle] = React.useState('');
    const [description, setDescription] = React.useState('');
    const [isUploading, setIsUploading] = React.useState(false);
    const [uploadProgress, setUploadProgress] = React.useState(0);
    const [uploadStatus, setUploadStatus] = React.useState('');
    const [toast, setToast] = React.useState(null);

    const showToast = (msg) => {
        setToast(msg);
        setTimeout(() => setToast(null), 3000);
    };

    const handleFileChange = (e) => {
        const selected = e.target.files[0];
        if (!selected) return;
        
        // Basic validation
        if (config.accept && !selected.type.match(config.acceptRegex)) {
            showToast(`Por favor, selecione um arquivo válido (${config.accept}).`);
            return;
        }
        
        setFile(selected);
        setPreviewUrl(URL.createObjectURL(selected));
    };

    const uploadToBackend = async () => {
        if (!file) {
            showToast("Selecione um arquivo primeiro.");
            return;
        }
        if (!title.trim()) {
            showToast("O título é obrigatório.");
            return;
        }

        setIsUploading(true);
        setUploadStatus('Lendo arquivo...');
        setUploadProgress(20);

        try {
            await new Promise(r => setTimeout(r, 1000));
            setUploadStatus('Enviando para o servidor...');
            setUploadProgress(60);
            
            await new Promise(r => setTimeout(r, 1000));
            setUploadProgress(90);
            setUploadStatus('Salvando publicação...');

            await new Promise(r => setTimeout(r, 500));

            setUploadProgress(100);
            setUploadStatus('Concluído!');
            showToast("Conteúdo publicado com sucesso!");
            
            setTimeout(() => {
                onUploadComplete();
            }, 1500);

        } catch (error) {
            console.error(error);
            setUploadStatus('Erro no upload.');
            showToast("Falha ao publicar o conteúdo.");
            setIsUploading(false);
        }
    };

    const renderPreview = () => {
        if (!previewUrl) return null;
        if (contentType === 'video' || contentType === 'story') {
            return <video src={previewUrl} className="w-full h-full object-cover rounded-xl" controls />;
        }
        if (contentType === 'photo') {
            return <img src={previewUrl} className="w-full h-full object-cover rounded-xl" />;
        }
        if (contentType === 'audio') {
            return (
                <div className="w-full h-full bg-gray-800 flex items-center justify-center rounded-xl p-4">
                    <audio src={previewUrl} controls className="w-full" />
                </div>
            );
        }
        return (
            <div className="w-full h-full bg-gray-800 flex flex-col items-center justify-center rounded-xl text-indigo-400">
                <div className={`icon-${config.icon} text-6xl mb-2`}></div>
                <span>{file?.name}</span>
            </div>
        );
    };

    return (
        <div className="fixed inset-0 bg-gray-900 z-[100] flex text-white overflow-hidden" data-name="generic-upload">
            {toast && (
                <div className="fixed top-10 left-1/2 transform -translate-x-1/2 z-[110] bg-gray-800 text-white px-4 py-2 rounded-full shadow-lg text-sm flex items-center gap-2">
                    <div className="icon-info text-indigo-400"></div>
                    {toast}
                </div>
            )}
            
            <div className="flex-1 flex flex-col p-8 overflow-y-auto">
                <div className="flex items-center justify-between mb-8">
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <div className={`icon-${config.icon}`}></div> Upload de {config.label}
                    </h1>
                    <button onClick={onClose} className="p-2 hover:bg-gray-800 rounded-full"><div className="icon-x text-2xl"></div></button>
                </div>

                <div className="max-w-4xl mx-auto w-full flex gap-8">
                    <div className="flex-1 space-y-6">
                        {!previewUrl ? (
                            <div 
                                className="border-2 border-dashed border-gray-600 rounded-2xl p-10 flex flex-col items-center justify-center bg-gray-800/50 hover:bg-gray-800 transition cursor-pointer"
                                onClick={() => document.getElementById('generic-input-desktop').click()}
                            >
                                <div className={`icon-${config.icon} text-6xl text-gray-400 mb-4`}></div>
                                <h3 className="text-xl font-bold mb-2">Clique para selecionar</h3>
                                <p className="text-gray-500 text-sm text-center">Formatos: {config.accept}. Máx {config.maxSize}.</p>
                                <input id="generic-input-desktop" type="file" accept={config.accept} className="hidden" onChange={handleFileChange} />
                                
                                <button className="mt-6 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-xl font-bold transition">
                                    Selecionar Arquivo
                                </button>
                            </div>
                        ) : (
                            <div className="aspect-video bg-black rounded-xl overflow-hidden shadow-lg border border-gray-800 flex items-center justify-center">
                                {renderPreview()}
                            </div>
                        )}
                        
                        {previewUrl && (
                            <button onClick={() => { setFile(null); setPreviewUrl(''); }} className="text-red-400 text-sm hover:underline flex items-center gap-1">
                                <div className="icon-trash"></div> Remover Arquivo
                            </button>
                        )}
                    </div>

                    <div className="w-96 space-y-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-400 mb-1">Título *</label>
                            <input 
                                type="text" 
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                placeholder="Digite um título..." 
                                className="w-full bg-gray-800 border border-gray-700 rounded-xl p-3 outline-none focus:border-indigo-500 transition"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-400 mb-1">Descrição</label>
                            <textarea 
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="Adicione mais detalhes..." 
                                className="w-full bg-gray-800 border border-gray-700 rounded-xl p-3 outline-none focus:border-indigo-500 transition h-32 resize-none"
                            />
                        </div>

                        {previewUrl && (
                            <button 
                                onClick={uploadToBackend}
                                disabled={isUploading}
                                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white p-4 rounded-xl font-bold transition flex justify-center items-center gap-2 mt-4"
                            >
                                {isUploading ? (
                                    <><div className="icon-loader animate-spin"></div> {uploadStatus} {uploadProgress}%</>
                                ) : (
                                    <><div className="icon-upload"></div> Publicar {config.label}</>
                                )}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

window.GenericUpload = GenericUpload;