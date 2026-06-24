function GifPicker({ onSelect, isDark }) {
    const API_KEY = "LTbPGPBErCuqyhaS3sRLrVQaxSLpiVXO5M1gBK9Xyg16i5PyNoT9lp2ni6H5eBw1";
    const [gifs, setGifs] = React.useState([]);
    const [searchTerm, setSearchTerm] = React.useState('');
    const [loading, setLoading] = React.useState(false);

    React.useEffect(() => {
        searchGifs('trending');
    }, []);

    const searchGifs = async (query) => {
        if (!query) query = 'trending';
        setLoading(true);
        try {
            const url = `https://api.klipy.com/v2/search?q=${encodeURIComponent(query)}&key=${API_KEY}&limit=20`;
            const resp = await fetch(url);
            const dados = await resp.json();
            setGifs(dados.results || []);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className={`w-80 h-96 flex flex-col rounded-xl shadow-2xl border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`} data-name="gif-picker" data-file="components/GifPicker.js">
            <div className={`p-3 border-b flex gap-2 ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
                <input 
                    type="text" 
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    onKeyPress={e => e.key === 'Enter' && searchGifs(searchTerm)}
                    placeholder="Pesquisar GIFs..."
                    className={`flex-1 px-3 py-2 rounded-lg outline-none text-sm ${isDark ? 'bg-gray-700 text-white placeholder-gray-400' : 'bg-gray-100 text-gray-800'}`}
                />
                <button onClick={() => searchGifs(searchTerm)} className="p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center justify-center">
                    <div className="icon-search"></div>
                </button>
            </div>
            <div className="flex-1 overflow-y-auto p-2 grid grid-cols-2 gap-2">
                {loading ? (
                    <div className="col-span-2 flex justify-center py-4"><div className="icon-loader animate-spin text-indigo-500 text-2xl"></div></div>
                ) : (
                    gifs.map((item, idx) => {
                        const gifUrl = item.media_formats?.gif?.url || item.media_formats?.tinygif?.url;
                        if (!gifUrl) return null;
                        return (
                            <img 
                                key={idx} 
                                src={gifUrl} 
                                alt={item.content_description || "GIF"} 
                                className="w-full h-auto rounded-lg cursor-pointer hover:opacity-80 transition-opacity"
                                onClick={() => onSelect(gifUrl)}
                            />
                        );
                    })
                )}
                {!loading && gifs.length === 0 && (
                    <div className="col-span-2 text-center text-sm text-gray-400 py-4">Nenhum GIF encontrado.</div>
                )}
            </div>
        </div>
    );
}
window.GifPicker = GifPicker;