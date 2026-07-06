function ProfileSetup({ userData, onComplete }) {
  const [loading, setLoading] = React.useState(false);
  const [preview, setPreview] = React.useState(null);
  const [base64Image, setBase64Image] = React.useState(null);
  const [username, setUsername] = React.useState("");
  const [usernameStatus, setUsernameStatus] = React.useState("idle"); // idle, typing, checking, available, taken, invalid
  const [usernameMessage, setUsernameMessage] = React.useState("");
  const [birthdate, setBirthdate] = React.useState("");
  const [cropModalOpen, setCropModalOpen] = React.useState(false);
  const [imageToCrop, setImageToCrop] = React.useState(null);
  const [processingState, setProcessingState] = React.useState({ isProcessing: false, progress: 0 });
  
  const imageRef = React.useRef(null);
  const cropperRef = React.useRef(null);
  const checkTimeoutRef = React.useRef(null);

  const BAD_WORDS = ["palavrao", "admin", "root", "suporte", "puta", "merda", "caralho", "foda"]; // Exemplo simples

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Por favor, selecione uma imagem válida.');
      return;
    }

    try {
        const objectUrl = URL.createObjectURL(file);
        setImageToCrop(objectUrl);
        setCropModalOpen(true);
    } catch (err) {
        console.error("Erro ao carregar imagem:", err);
        // Fallback for older browsers
        const reader = new FileReader();
        reader.onload = (event) => {
            setImageToCrop(event.target.result);
            setCropModalOpen(true);
        };
        reader.readAsDataURL(file);
    }
    
    e.target.value = '';
  };

  React.useEffect(() => {
    if (cropModalOpen && imageRef.current) {
      if (cropperRef.current) {
        cropperRef.current.destroy();
      }
      cropperRef.current = new Cropper(imageRef.current, {
        aspectRatio: 1,
        viewMode: 1,
        autoCropArea: 1,
        background: false,
        guides: true,
        highlight: false,
        dragMode: 'move',
        cropBoxMovable: true,
        cropBoxResizable: true,
      });
    }
    return () => {
      if (cropperRef.current) {
        cropperRef.current.destroy();
        cropperRef.current = null;
      }
    };
  }, [cropModalOpen, imageToCrop]);

  const handleCrop = () => {
    if (cropperRef.current) {
      const canvas = cropperRef.current.getCroppedCanvas({
        width: 400,
        height: 400,
        fillColor: '#fff',
        imageSmoothingEnabled: true,
        imageSmoothingQuality: 'high',
      });
      
      const base64 = canvas.toDataURL('image/jpeg', 0.6);
      
      setPreview(base64);
      setBase64Image(base64);
      closeCropModal();
    }
  };

  const closeCropModal = () => {
    setCropModalOpen(false);
    if (imageToCrop && imageToCrop.startsWith('blob:')) {
      URL.revokeObjectURL(imageToCrop);
    }
    setImageToCrop(null);
  };

  const validateUsernameFormat = (user) => {
    if (!user || user.length < 6) return "O @arroba deve ter no mínimo 6 caracteres.";
    if (user.includes('@')) return "O @arroba não deve conter o caractere @ duplicado.";
    if (/[^a-zA-Z0-9_]/i.test(user)) return "O @arroba só pode conter letras, números e underline (_).";
    if (!/\d/.test(user)) return "O @arroba deve conter pelo menos um número.";
    if (!/[A-Z]/.test(user)) return "O @arroba deve conter pelo menos uma letra maiúscula.";
    
    for (let i = 0; i < user.length - 2; i++) {
        const c1 = user.charCodeAt(i);
        const c2 = user.charCodeAt(i+1);
        const c3 = user.charCodeAt(i+2);
        if (c1 >= 48 && c1 <= 57 && c2 === c1 + 1 && c3 === c2 + 1) {
            return "O @arroba não pode conter sequências numéricas (ex: 123).";
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

  const checkUsernameAvailability = async (user) => {
    try {
      const uid = userData.uid || userData.userKey;
      const response = await fetch(`https://html-785e3-default-rtdb.firebaseio.com/users.json?orderBy="username"&equalTo="${user.toLowerCase()}"`);
      const data = await response.json();
      
      // Fallback caso o Firebase recuse a busca por falta de ".indexOn" no Realtime Database
      if (data && data.error) {
        console.warn("Erro de índice no Firebase, usando fallback manual:", data.error);
        const allResp = await fetch(`https://html-785e3-default-rtdb.firebaseio.com/users.json`);
        const allData = await allResp.json();
        if (allData) {
            for (let key in allData) {
                if (allData[key].username === user.toLowerCase() && key !== uid) {
                    return false;
                }
            }
        }
        return true;
      }

      // Se retornou dados, verifica se o dono do @ é o próprio usuário editando o perfil
      if (data && Object.keys(data).length > 0) {
        const keys = Object.keys(data);
        if (keys.length === 1 && keys[0] === uid) {
            return true; // O usuário já é o dono desse @
        }
        return false;
      }
      return true;
    } catch (error) {
      console.error("Error checking username:", error);
      // Fallback em caso de falha de rede
      return true; 
    }
  };

  const handleUsernameChange = (e) => {
    const val = e.target.value.replace(/[^a-zA-Z0-9_]/g, '');
    setUsername(val);
    
    if (checkTimeoutRef.current) {
      clearTimeout(checkTimeoutRef.current);
    }

    if (!val) {
      setUsernameStatus("idle");
      setUsernameMessage("");
      return;
    }

    setUsernameStatus("typing");
    setUsernameMessage("");

    checkTimeoutRef.current = setTimeout(async () => {
      const formatError = validateUsernameFormat(val);
      if (formatError) {
        setUsernameStatus("invalid");
        setUsernameMessage(formatError);
        return;
      }

      setUsernameStatus("checking");
      setUsernameMessage("Verificando disponibilidade...");

      const isAvailable = await checkUsernameAvailability(val);
      if (isAvailable) {
        setUsernameStatus("available");
        setUsernameMessage("Nome de usuário disponível!");
      } else {
        setUsernameStatus("taken");
        setUsernameMessage("Este nome de usuário já está em uso.");
      }
    }, 3000); // 3 segundos
  };

  const handleSave = async () => {
      if (usernameStatus !== "available") {
        alert("Por favor, escolha um nome de usuário válido e disponível.");
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
      <div className="bg-white p-8 rounded-xl shadow-lg max-w-md w-full relative mt-10 sm:mt-0">
        <button 
          onClick={handleSave}
          disabled={loading || !base64Image || usernameStatus !== "available" || !birthdate}
          className={`absolute top-36 right-4 md:-right-6 w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-colors z-10 
            ${loading || !base64Image || usernameStatus !== "available" || !birthdate ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 text-white'}`}
        >
          {loading ? <div className="icon-loader animate-spin text-2xl"></div> : <div className="icon-arrow-right text-2xl"></div>}
        </button>
        <h2 className="text-2xl font-bold text-center text-gray-800 mb-6 mt-2">Configure seu Perfil</h2>
        <p className="text-center text-gray-500 mb-8">Adicione uma foto de perfil para continuar</p>

        <div className="flex flex-col items-center mb-8">
          <div className="relative w-32 h-32 mb-4 group">
            {processingState.isProcessing ? (
               <div className="w-full h-full rounded-full bg-gray-100 flex flex-col items-center justify-center border-4 border-gray-200 shadow-inner">
                  <div className="text-[10px] font-bold text-gray-500 mb-2">O arquivo está sendo processado...</div>
                  <div className="w-20 h-2 bg-gray-200 rounded-full overflow-hidden">
                     <div className="h-full bg-blue-500 transition-all duration-200" style={{ width: `${processingState.progress}%` }}></div>
                  </div>
               </div>
            ) : preview ? (
              <img src={preview} alt="Preview" className="w-full h-full object-cover rounded-full border-4 border-indigo-100 shadow-sm" />
            ) : (
              <div className="w-full h-full rounded-full bg-gray-200 flex items-center justify-center border-4 border-dashed border-gray-300">
                <div className="icon-camera text-4xl text-gray-400"></div>
              </div>
            )}
            
            {!processingState.isProcessing && (
              <label className="absolute inset-0 w-full h-full bg-black bg-opacity-50 text-white flex flex-col items-center justify-center rounded-full opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity">
                <div className="icon-upload text-2xl mb-1"></div>
                <span className="text-xs font-medium">Alterar</span>
                <input type="file" accept="image/*" className="hidden" onChange={handleImageChange} onClick={(e) => e.stopPropagation()} />
              </label>
            )}
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
                  onChange={handleUsernameChange}
                  placeholder="seu_arroba" 
                  className={`w-full pl-8 pr-10 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-colors
                    ${usernameStatus === 'invalid' || usernameStatus === 'taken' ? 'border-red-500 bg-red-50' : 
                      usernameStatus === 'available' ? 'border-green-500 bg-green-50' : 'border-gray-300'}`}
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  {usernameStatus === 'checking' && <div className="icon-loader animate-spin text-indigo-500"></div>}
                  {usernameStatus === 'available' && <div className="icon-check text-green-500 font-bold"></div>}
                  {(usernameStatus === 'taken' || usernameStatus === 'invalid') && <div className="icon-x text-red-500 font-bold"></div>}
                </div>
              </div>
              <p className={`text-xs mt-1 ${
                usernameStatus === 'invalid' || usernameStatus === 'taken' ? 'text-red-500' :
                usernameStatus === 'available' ? 'text-green-600' :
                usernameStatus === 'checking' ? 'text-indigo-500' : 'text-gray-500'
              }`}>
                {usernameMessage || "Apenas letras, números e underline (_)."}
              </p>
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

      </div>

      {cropModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-90 p-4">
          <div className="bg-white rounded-xl overflow-hidden max-w-lg w-full flex flex-col max-h-[90vh]">
            <div className="p-4 border-b flex justify-between items-center bg-gray-50">
              <h3 className="font-bold text-gray-800">Ajustar Foto</h3>
              <button onClick={closeCropModal} className="text-gray-500 hover:text-gray-800">
                <div className="icon-x text-2xl"></div>
              </button>
            </div>
            <div className="flex-1 bg-black overflow-hidden flex items-center justify-center p-2 min-h-[300px]">
              <img ref={imageRef} src={imageToCrop} alt="Crop preview" className="max-w-full max-h-full block" />
            </div>
            <div className="p-4 border-t flex justify-end gap-3 bg-gray-50">
              <button 
                onClick={closeCropModal}
                className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 font-medium hover:bg-gray-100"
              >
                Cancelar
              </button>
              <button 
                onClick={handleCrop}
                className="px-6 py-2 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 shadow-md"
              >
                Salvar Foto
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
window.ProfileSetup = ProfileSetup;