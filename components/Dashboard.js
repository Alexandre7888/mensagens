function Dashboard({ userData, onLogout }) {
  const [suggestions, setSuggestions] = React.useState([]);
  const [loadingSuggestions, setLoadingSuggestions] = React.useState(true);
  const [highlights, setHighlights] = React.useState([]);
  const [credits, setCredits] = React.useState(0);
  const [isHighlighting, setIsHighlighting] = React.useState(false);

  React.useEffect(() => {
    if (!userData.userKey && !userData.uid) return;
    const uid = userData.userKey || userData.uid;
    const creditsRef = window.firebaseDB.ref(`users/${uid}/credits`);
    
    const listener = creditsRef.on('value', snap => {
      setCredits(snap.val() || 0);
    });

    return () => creditsRef.off('value', listener);
  }, [userData.userKey, userData.uid]);

  React.useEffect(() => {
    // Algoritmo de Haversine para calcular distância em km
    const getDistance = (lat1, lon1, lat2, lon2) => {
      if (!lat1 || !lon1 || !lat2 || !lon2) return null;
      const R = 6371; // Raio da Terra em km
      const dLat = (lat2 - lat1) * (Math.PI / 180);
      const dLon = (lon2 - lon1) * (Math.PI / 180);
      const a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * 
        Math.sin(dLon/2) * Math.sin(dLon/2); 
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
      return R * c;
    };

    // Listener em tempo real para os Destaques (Highlights)
    const now = Date.now();
    const highlightsRef = window.firebaseDB.ref('users').orderByChild('highlightUntil').startAt(now);
    
    const handleHighlights = (snap) => {
      const data = snap.val() || {};
      let validHighlights = [];
      const currentTime = Date.now();
      
      Object.keys(data).forEach(uid => {
        const u = data[uid];
        if (u.highlightUntil && u.highlightUntil > currentTime) {
          validHighlights.push({...u, uid});
        }
      });
      
      validHighlights.sort((a, b) => {
        if (a.uid === (userData.uid || userData.userKey)) return -1;
        if (b.uid === (userData.uid || userData.userKey)) return 1;
        return b.highlightUntil - a.highlightUntil; // mais tempo restante primeiro
      });
      
      setHighlights(validHighlights);
    };

    highlightsRef.on('value', handleHighlights);

    const fetchSuggestions = async () => {
      try {
        setLoadingSuggestions(true);
        const usersSnap = await window.firebaseDB.ref('users').once('value');
        const allUsers = usersSnap.val() || {};
        
        let validSuggestions = [];
        
        const myVisibility = window.SettingsManager ? (window.SettingsManager.getSettings().suggestionVisibility || 'global') : 'global';
        const myLocation = userData.location;

        Object.keys(allUsers).forEach(uid => {
          const u = allUsers[uid];

          // Lógica de Sugestões
          if (uid === userData.uid || uid === userData.userKey) return; 
          
          const theirVisibility = u.suggestionVisibility || 'global';
          
          if (theirVisibility === 'hidden' || myVisibility === 'hidden') return;
          
          let distance = null;
          if (myLocation && u.location) {
             distance = getDistance(myLocation.lat, myLocation.lng, u.location.lat, u.location.lng);
          }

          // Se a configuração for 'nearby' e não tiver localização, não mostra nas sugestões
          if (myVisibility === 'nearby' && !myLocation) return;

          if (myVisibility === 'nearby' || theirVisibility === 'nearby') {
            if (distance !== null && distance <= 10) {
              validSuggestions.push({...u, uid, distance});
            }
          } else if (myVisibility === 'global' && theirVisibility === 'global') {
            validSuggestions.push({...u, uid, distance});
          }
        });

        validSuggestions.sort((a, b) => {
          if (a.distance === null && b.distance === null) return 0;
          if (a.distance === null) return 1;
          if (b.distance === null) return -1;
          return a.distance - b.distance;
        });
        
        setSuggestions(validSuggestions.slice(0, 15));
        
      } catch(e) {
        console.error("Erro ao buscar dados", e);
      } finally {
        setLoadingSuggestions(false);
      }
    };

    fetchSuggestions();

    return () => {
        highlightsRef.off('value', handleHighlights);
    };
  }, [userData.location, userData.uid, userData.userKey]);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col" data-name="dashboard" data-file="components/Dashboard.js">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200 px-6 py-4 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-indigo-600 rounded flex items-center justify-center text-white font-bold">
            C
          </div>
          <h1 className="text-xl font-bold text-gray-800">mensagensHUB</h1>
        </div>
        
        <div className="flex items-center gap-4">
          <a href="credits.html" className="flex items-center gap-1.5 bg-amber-100 hover:bg-amber-200 transition-colors py-1.5 px-3 rounded-full cursor-pointer shadow-sm border border-amber-200" title="Ver Créditos">
             <div className="icon-coins text-amber-600 text-lg"></div>
             <span className="text-sm font-bold text-amber-700">{credits}</span>
          </a>

          <div className="flex items-center gap-3 bg-gray-100 py-1.5 px-3 rounded-full">
            <img 
              src={userData.profilePicture} 
              alt="Profile" 
              className="w-8 h-8 rounded-full object-cover border border-gray-300"
            />
            <span className="text-sm font-medium text-gray-700 mr-2">{userData.nome || 'Usuário'}</span>
          </div>
          
          <div className="relative group">
            <button 
              className="p-2 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-full transition-colors"
              title="Menu"
            >
              <div className="icon-more-vertical text-xl"></div>
            </button>
            <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-xl border border-gray-100 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
              <div className="p-2">
                <button 
                  onClick={async () => {
                    if (window.confirm('Deseja atualizar o aplicativo? Isso apagará o código em cache e baixará a versão mais recente do servidor.')) {
                        if ('caches' in window) {
                            try {
                                const cacheNames = await caches.keys();
                                await Promise.all(cacheNames.map(name => caches.delete(name)));
                            } catch(e) {}
                        }
                        // Limpa registros de cache mas mantém configurações do usuário e mídias
                        const chavesParaManter = ['userkey', 'tutorialCompleted'];
                        for (let i = 0; i < localStorage.length; i++) {
                            const key = localStorage.key(i);
                            if (key && !chavesParaManter.includes(key) && !key.startsWith('media_')) {
                                // Pode limpar outras se necessário, mas vamos manter simples
                            }
                        }
                        window.location.reload(true);
                    }
                  }}
                  className="w-full text-left px-4 py-3 rounded-lg hover:bg-gray-50 flex items-center gap-3 text-gray-700 font-medium"
                >
                  <div className="icon-refresh-cw text-indigo-500"></div>
                  Atualizar Aplicativo
                </button>
                <div className="h-px bg-gray-100 my-1"></div>
                <button 
                  onClick={onLogout}
                  className="w-full text-left px-4 py-3 rounded-lg hover:bg-red-50 flex items-center gap-3 text-red-600 font-medium"
                >
                  <div className="icon-log-out text-red-500"></div>
                  Sair
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-5xl w-full mx-auto p-6 mt-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
          <div className="text-center py-12">
            <div className="w-24 h-24 mx-auto bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-6">
              <div className="icon-check text-5xl"></div>
            </div>
            <h2 className="text-3xl font-bold text-gray-800 mb-4">Login e Perfil Configurados!</h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto mb-8">
              Você logou com sucesso usando a CodeHUB e sua foto de perfil foi salva no Firebase em formato Base64.
            </p>
            
            <div className="bg-gray-50 rounded-lg p-6 text-left max-w-lg mx-auto border border-gray-200 relative overflow-hidden">
              <div className="flex items-center justify-between mb-4 border-b border-gray-200 pb-4">
                <h3 className="font-semibold text-gray-700 flex items-center gap-2">
                  <div className="icon-user text-indigo-500"></div>
                  Seus Dados
                </h3>
                
                <button 
                  onClick={async () => {
                    const cost = 30;
                    if (credits < cost) {
                        alert(`Você precisa de ${cost} créditos para destacar o perfil!`);
                        return;
                    }
                    if (window.confirm(`Deseja destacar seu perfil por 1 hora utilizando ${cost} créditos?`)) {
                        setIsHighlighting(true);
                        try {
                            const uid = userData.uid || userData.userKey;
                            const updates = {};
                            updates[`users/${uid}/credits`] = credits - cost;
                            updates[`users/${uid}/highlightUntil`] = Date.now() + (60 * 60 * 1000); // +1 hour
                            await window.firebaseDB.ref().update(updates);
                            alert("Perfil destacado com sucesso! Você já está visível no topo.");
                        } catch (e) {
                            console.error(e);
                            alert("Erro ao destacar perfil.");
                        } finally {
                            setIsHighlighting(false);
                        }
                    }
                  }}
                  disabled={isHighlighting}
                  className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-400 to-orange-500 hover:from-amber-500 hover:to-orange-600 text-white text-sm font-bold rounded-lg shadow-sm transition-all"
                >
                  {isHighlighting ? (
                    <div className="icon-loader animate-spin"></div>
                  ) : (
                    <div className="icon-star"></div>
                  )}
                  Destacar Perfil (30 Créditos)
                </button>
              </div>
              
              <div className="space-y-3 text-sm">
                <p><span className="font-medium text-gray-500 w-20 inline-block">Nome:</span> {userData.nome}</p>
                <p><span className="font-medium text-gray-500 w-20 inline-block">Email:</span> {userData.email}</p>
                <p><span className="font-medium text-gray-500 w-20 inline-block">UID:</span> <code className="bg-gray-200 px-1 rounded">{userData.uid || userData.userKey}</code></p>
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <p className="font-medium text-gray-500 mb-2">Foto (Base64) - Primeiros 50 caracteres:</p>
                  <code className="text-xs text-gray-400 break-all bg-gray-100 p-2 rounded block">
                    {userData.profilePicture.substring(0, 50)}...
                  </code>
                </div>
              </div>
            </div>

            {/* Highlights Section */}
            {!loadingSuggestions && highlights.length > 0 && (
              <div className="mt-8 mb-12 text-left">
                <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                  <div className="icon-star text-amber-500"></div>
                  Perfis em Destaque
                </h3>
                <div className="flex overflow-x-auto gap-4 pb-4 snap-x snap-mandatory hide-scrollbar" style={{ scrollbarWidth: 'none' }}>
                  {highlights.map(h => (
                    <div key={h.uid} className="snap-start shrink-0 w-64 bg-gradient-to-b from-amber-50 to-white border border-amber-200 rounded-2xl p-5 flex flex-col items-center text-center shadow-sm relative overflow-hidden">
                      <div className="absolute top-0 w-full h-1 bg-gradient-to-r from-amber-400 to-orange-500"></div>
                      <div className="relative mb-3">
                        <img src={h.profilePicture || 'https://via.placeholder.com/150'} alt="Profile" className="w-20 h-20 rounded-full object-cover border-4 border-white shadow-md" />
                        <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-amber-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full border-2 border-white shadow-sm">
                          PRO
                        </div>
                      </div>
                      <h4 className="font-bold text-gray-900 text-lg w-full truncate">{h.nome || h.username || 'Usuário'}</h4>
                      <p className="text-sm text-gray-500 mb-4 w-full truncate">@{h.username || 'user'}</p>
                      <button className="w-full py-2 bg-indigo-600 text-white rounded-xl font-bold text-sm hover:bg-indigo-700 transition-colors">
                        Ver Perfil
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Suggestions Section */}
            <div className="mt-8 text-left">
              <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                <div className="icon-users text-indigo-500"></div>
                Sugestões para você
              </h3>
              
              {loadingSuggestions ? (
                <div className="text-center p-8 bg-gray-50 border border-gray-200 rounded-xl">
                  <div className="icon-loader text-3xl text-indigo-500 animate-spin mx-auto mb-2"></div>
                  <p className="text-gray-500">O algoritmo está mapeando sua região e buscando pessoas próximas...</p>
                </div>
              ) : (
                <>
                  {suggestions.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                      {suggestions.map(s => (
                        <div key={s.uid} className="bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-4 hover:shadow-md transition-shadow">
                          <img src={s.profilePicture || 'https://via.placeholder.com/150'} alt="Profile" className="w-12 h-12 rounded-full object-cover" />
                          <div className="flex-1 min-w-0">
                            <h4 className="font-bold text-gray-900 truncate">{s.name || s.username}</h4>
                            <p className="text-sm text-gray-500 truncate">@{s.username}</p>
                            {s.distance !== null && (
                              <p className="text-xs font-semibold text-emerald-600 mt-1 flex items-center gap-1">
                                <div className="icon-map-pin text-[12px]"></div>
                                {s.distance < 1 ? 'Muito perto (Seu bairro)' : `A aprox. ${s.distance.toFixed(1)} km`}
                              </p>
                            )}
                          </div>
                          <button className="p-2 text-indigo-600 bg-indigo-50 rounded-full hover:bg-indigo-100 transition-colors">
                            <div className="icon-user-plus text-xl"></div>
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center p-8 bg-gray-50 border border-gray-200 rounded-xl">
                      <div className="icon-search text-3xl text-gray-400 mx-auto mb-2"></div>
                      <p className="text-gray-500">O algoritmo não encontrou ninguém próximo no seu bairro no momento.</p>
                    </div>
                  )}
                </>
              )}
            </div>

          </div>
        </div>
      </main>
      
      <footer className="py-6 text-center text-sm text-gray-500">
        &copy; 2026 mensagensHUB.
      </footer>
    </div>
  );
}
window.Dashboard = Dashboard;