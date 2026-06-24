function ProfileSetup({ userData, onComplete }) {
  const [loading, setLoading] = React.useState(false);
  const [preview, setPreview] = React.useState(null);
  const [base64Image, setBase64Image] = React.useState(null);
  const [username, setUsername] = React.useState("");
  const [birthdate, setBirthdate] = React.useState("");
  const [location, setLocation] = React.useState(null);

  const BAD_WORDS = ["palavrao", "admin", "root", "suporte", "puta", "merda", "caralho", "foda"]; // Exemplo simples

  React.useEffect(() => {
    // Request location
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
        },
        (error) => {
          console.error("Error getting location:", error);
          // Optional: handle denied location
        }
      );
    }
  }, []);

  const handleImageChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Basic validation
    if (!file.type.startsWith('image/')) {
      alert('Por favor, selecione uma imagem válida.');
      return;
    }
    
    // Check size (e.g., max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      alert('A imagem é muito grande. O tamanho máximo é 2MB.');
      return;
    }

    try {
      const base64 = await api.fileToBase64(file);
      setPreview(base64);
      setBase64Image(base64);
    } catch (error) {
      console.error('Error converting image:', error);
      alert('Erro ao processar imagem.');
    }
  };

  const validateUsername = (user) => {
    if (!user || user.length < 6) return "O @arroba deve ter no mínimo 6 caracteres.";
    if (user.includes('@')) return "O @arroba não deve conter o caractere @ duplicado (já existe um no início).";
    if (/[^a-zA-Z0-9_@]/i.test(user)) return "O @arroba só pode conter letras, números e underline (_).";
    if (!/\d/.test(user)) return "O @arroba deve conter pelo menos um número.";
    if (!/[A-Z]/.test(user)) return "O @arroba não pode ser todo minúsculo (deve conter pelo menos uma letra maiúscula).";
    
    // Verificar sequências de números (ex: 123)
    for (let i = 0; i < user.length - 2; i++) {
        const c1 = user.charCodeAt(i);
        const c2 = user.charCodeAt(i+1);
        const c3 = user.charCodeAt(i+2);
        if (c1 >= 48 && c1 <= 57 && c2 === c1 + 1 && c3 === c2 + 1) {
            return "O @arroba não pode conter sequências numéricas (ex: 123, 234).";
        }
    }

    const lowerUser = user.toLowerCase();
    for (const badWord of BAD_WORDS) {
      if (lowerUser.includes(badWord)) {
        return "Este @arroba contém palavras não permitidas.";
      }
    }
    return null;
  };

    const handleSave = async () => {
      const usernameError = validateUsername(username);
      if (usernameError) {
        alert(usernameError);
        return;
      }

      if (!birthdate) {
        alert('Por favor, insira sua data de nascimento.');
        return;
      }

      // Verificação de idade mínima (13 anos)
      const today = new Date();
      const birthDateObj = new Date(birthdate);
      let age = today.getFullYear() - birthDateObj.getFullYear();
      const m = today.getMonth() - birthDateObj.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < birthDateObj.getDate())) {
        age--;
      }

      if (age < 13) {
        alert('Você precisa ter pelo menos 13 anos para usar este aplicativo.');
        return;
      }

    setLoading(true);
    try {
      const uid = userData.uid || userData.userKey;
      
      const firebaseData = {
        name: userData.nome || 'Usuário',
        username: username.toLowerCase(),
        birthdate: birthdate,
        email: userData.email || '',
        uid: uid,
        profilePicture: base64Image,
        updatedAt: new Date().toISOString(),
        followers: 0,
        following: 0,
        location: location,
        suggestionVisibility: 'global' // 'global', 'nearby', 'hidden'
      };

      await api.saveFirebaseUser(uid, firebaseData);
      
      onComplete({
        ...userData,
        profilePicture: base64Image
      });
    } catch (error) {
      console.error('Error saving profile:', error);
      alert('Erro ao salvar o perfil.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4" data-name="profile-setup" data-file="components/ProfileSetup.js">
      <div className="bg-white p-8 rounded-xl shadow-lg max-w-md w-full">
        <h2 className="text-2xl font-bold text-center text-gray-800 mb-6">Configure seu Perfil</h2>
        <p className="text-center text-gray-500 mb-8">Adicione uma foto de perfil e permita a localização para continuar</p>

        <div className="flex flex-col items-center mb-8">
          <div className="relative w-32 h-32 mb-4 group">
            {preview ? (
              <img src={preview} alt="Preview" className="w-full h-full object-cover rounded-full border-4 border-indigo-100 shadow-sm" />
            ) : (
              <div className="w-full h-full rounded-full bg-gray-200 flex items-center justify-center border-4 border-dashed border-gray-300">
                <div className="icon-camera text-4xl text-gray-400"></div>
              </div>
            )}
            
            <label className="absolute inset-0 w-full h-full bg-black bg-opacity-50 text-white flex flex-col items-center justify-center rounded-full opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity">
              <div className="icon-upload text-2xl mb-1"></div>
              <span className="text-xs font-medium">Alterar</span>
              <input type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
            </label>
          </div>
          
          <h3 className="text-xl font-semibold text-gray-700 mb-1">{userData.nome || 'Usuário'}</h3>
          <p className="text-sm text-gray-500 mb-4">{userData.email}</p>
          
          <div className="w-full space-y-4 text-left">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nome de usuário (@)</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">@</span>
                <input 
                  type="text" 
                  value={username}
                  onChange={(e) => setUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))}
                  placeholder="seu_arroba" 
                  className="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">Apenas letras, números e underline (_).</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Data de Nascimento</label>
              <input 
                type="date" 
                value={birthdate}
                onChange={(e) => setBirthdate(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
          </div>
        </div>

        {!location && (
          <div className="mb-6 p-3 bg-yellow-50 text-yellow-800 rounded-lg text-sm flex items-start gap-2">
            <div className="icon-map-pin mt-0.5"></div>
            <div>Por favor, permita o acesso à sua localização no navegador para ativar as sugestões de pessoas próximas.</div>
          </div>
        )}

        <button 
          onClick={handleSave}
          disabled={loading || !base64Image || !username || !birthdate || !location}
          className={`w-full py-3 rounded-lg font-semibold flex items-center justify-center gap-2 transition duration-200 
            ${loading || !base64Image || !location ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700 text-white'}`}
        >
          {loading ? (
            <><div className="icon-loader animate-spin text-xl"></div> Salvando...</>
          ) : (
            <>Salvar e Continuar <div className="icon-arrow-right text-xl"></div></>
          )}
        </button>
      </div>
    </div>
  );
}
window.ProfileSetup = ProfileSetup;