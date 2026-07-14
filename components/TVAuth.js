function TVAuth({ deviceId }) {
    return (
        <div className="flex h-screen items-center justify-center bg-gray-900 p-8 text-white">
            <div className="flex bg-gray-800 rounded-3xl overflow-hidden shadow-2xl max-w-4xl w-full relative mt-[500px]">
                <div style={{"paddingTop":"48px","paddingRight":"48px","paddingBottom":"48px","paddingLeft":"48px","marginTop":"0px","marginRight":"0px","marginBottom":"0px","marginLeft":"0px","fontSize":"1","color":"rgb(255, 255, 255)","backgroundColor":"rgba(0, 0, 0, 0)","textAlign":"start","fontWeight":"400","objectFit":"fill","display":"flex","position":"static","top":"auto","left":"auto","right":"auto","bottom":"auto"}} className="w-1/2 p-12 flex flex-col justify-center">
                    <div className="icon-tv text-6xl text-indigo-500 mb-6"></div>
                    <h1 className="text-4xl font-bold mb-4">Adicionar Conta</h1>
                    <p className="text-gray-400 text-lg mb-8">Abra o Phantora no celular, vá em Configurações &gt; Dispositivos Conectados e escaneie o código QR.</p>
                    <div className="text-sm text-gray-500 font-mono bg-gray-900 p-3 rounded-lg inline-block self-start">ID: {deviceId}</div>
                </div>
                <div className="w-1/2 bg-gray-950 flex flex-col items-center justify-center p-12">
                    <div className="bg-gray-900 p-4 rounded-2xl border-4 border-indigo-500 shadow-[0_0_30px_rgba(99,102,241,0.3)]">
                        <div className="bg-white p-4 rounded-xl">
                            {deviceId && <img src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(`https://app.mensagens.site.je/?tvAuthId=${deviceId}`)}`} className="w-48 h-48 object-contain" />}
                        </div>
                    </div>
                    <p className="mt-8 text-indigo-400 font-semibold animate-pulse">Aguardando conexão...</p>
                </div>
            </div>
        </div>
    );
}
window.TVAuth = TVAuth;