function TVAccountSelect({ accounts, selectAccount, listenForAuth, deviceId, navigateTo }) {
    return (
        <div className="flex h-screen flex-col items-center justify-start pt-[30vh] bg-gray-900 text-white">
            <h1 className="text-5xl font-bold mb-12">Quem está assistindo?</h1>
            <div className="flex flex-wrap gap-8 justify-center max-w-5xl">
                {accounts.map((acc) => (
                    <div key={acc.uid} className="tv-focusable flex flex-col items-center gap-4 p-4 rounded-2xl cursor-pointer transition-transform" onClick={() => selectAccount(acc)}>
                        {acc.foto ? <img src={acc.foto} className="w-32 h-32 rounded-full object-cover border-4 border-transparent bg-gray-800" /> : <div className="w-32 h-32 rounded-full bg-indigo-600 flex items-center justify-center border-4 border-transparent text-5xl font-bold">{(acc.nome || '?').charAt(0).toUpperCase()}</div>}
                        <span className="text-2xl font-semibold">{acc.nome}</span>
                    </div>
                ))}
                {accounts.length < 5 && (
                    <div className="tv-focusable flex flex-col items-center gap-4 p-4 rounded-2xl cursor-pointer transition-transform" onClick={() => { listenForAuth(deviceId); navigateTo('auth'); }}>
                        <div className="w-32 h-32 rounded-full bg-gray-800 flex items-center justify-center border-4 border-transparent"><div className="icon-plus text-5xl text-gray-400"></div></div>
                        <span className="text-2xl font-semibold text-gray-400">Adicionar</span>
                    </div>
                )}
            </div>
        </div>
    );
}
window.TVAccountSelect = TVAccountSelect;