function Dashboard({ userData, onLogout }) {
  const [suggestions, setSuggestions] = React.useState([]);
  const [loadingSuggestions, setLoadingSuggestions] = React.useState(true);

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

    const fetchSuggestions = async () => {
      try {
        setLoadingSuggestions(true);
        const usersSnap = await window.firebaseDB.ref('users').once('value');
        const allUsers = usersSnap.val() || {};
        
        let validSuggestions = [];
        
        // Pega a configuração real do usuário (se não configurou, o padrão é 'global')
        const myVisibility = window.SettingsManager ? (window.SettingsManager.getSettings().suggestionVisibility || 'global') : 'global';
        const myLocation = userData.location;

        Object.keys(allUsers).forEach(uid => {
          if (uid === userData.uid || uid === userData.userKey) return; 
          
          const u = allUsers[uid];
          const theirVisibility = u.suggestionVisibility || 'global';
          
          if (theirVisibility === 'hidden' || myVisibility === 'hidden') return;
          
          let distance = null;
          if (myLocation && u.location) {
             distance = getDistance(myLocation.lat, myLocation.lng, u.location.lat, u.location.lng);
          }

          if (myVisibility === 'nearby' || theirVisibility === 'nearby') {
            // Se um dos dois exige proximidade, eles só aparecem se houver distância e for <= 10km
            if (distance !== null && distance <= 10) {
              validSuggestions.push({...u, uid, distance});
            }
          } else if (myVisibility === 'global' && theirVisibility === 'global') {
            // Se ambos são globais, exibe de qualquer forma (com ou sem distância)
            validSuggestions.push({...u, uid, distance});
          }
        });

        // Ordenação flexível: globais próximos primeiro, depois globais sem distância
        validSuggestions.sort((a, b) => {
          if (a.distance === null && b.distance === null) return 0;
          if (a.distance === null) return 1;
          if (b.distance === null) return -1;
          return a.distance - b.distance;
        });
        
        setSuggestions(validSuggestions.slice(0, 15));
      } catch(e) {
        console.error("Erro ao buscar sugestões", e);
      } finally {
        setLoadingSuggestions(false);
      }
    };

    const myVis = window.SettingsManager ? (window.SettingsManager.getSettings().suggestionVisibility || 'global') : 'global';
    
    // Se o usuário quer proximidade, mas ainda não liberou a localização:
    if (myVis === 'nearby' && !userData.location) {
      setSuggestions([]); // Não pode ver ninguém por proximidade sem localização
      setLoadingSuggestions(false);
    } else {
      fetchSuggestions();
    }
  }, [userData.location, userData.uid, userData.userKey]); // Refaz o algoritmo sempre que a localização mudar

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
          <div className="flex items-center gap-3 bg-gray-100 py-1.5 px-3 rounded-full">
            <img 
              src={userData.profilePicture} 
              alt="Profile" 
              className="w-8 h-8 rounded-full object-cover border border-gray-300"
            />
            <span className="text-sm font-medium text-gray-700 mr-2">{userData.nome || 'Usuário'}</span>
          </div>
          
          <button 
            onClick={onLogout}
            className="p-2 text-gray-500 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"
            title="Sair"
          >
            <div className="icon-log-out text-xl"></div>
          </button>
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
            
            <div className="bg-gray-50 rounded-lg p-6 text-left max-w-lg mx-auto border border-gray-200">
              <h3 className="font-semibold text-gray-700 mb-4 flex items-center gap-2">
                <div className="icon-user text-indigo-500"></div>
                Seus Dados
              </h3>
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

            {/* Suggestions Section */}
            <div className="mt-12 text-left">
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