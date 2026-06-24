function AdminAuth({ onSuccess, onFail }) {
  const [statusMsg, setStatusMsg] = React.useState('Iniciando verificações de segurança...');
  
  const ALLOWED_IP = '200.193.63.92';
  const REQUIRED_CITY = 'Itajaí';
  const REQUIRED_STATE = 'Santa Catarina';

  React.useEffect(() => {
    runSecurityChecks();
  }, []);

  const runSecurityChecks = async () => {
    try {
      // 1. Verificando IP
      setStatusMsg('Verificando endereço IP...');
      const ipRes = await fetch('https://api.ipify.org?format=json');
      const ipData = await ipRes.json();
      
      if (ipData.ip !== ALLOWED_IP) {
         console.warn(`IP Bloqueado: ${ipData.ip}`);
         onFail();
         return;
      }

      // 2. Solicitando Localização
      setStatusMsg('Aguardando permissão de localização...');
      if (!navigator.geolocation) {
        onFail();
        return;
      }

      navigator.geolocation.getCurrentPosition(async (position) => {
        try {
          const lat = position.coords.latitude;
          const lon = position.coords.longitude;
          setStatusMsg('Analisando coordenadas...');
          
          // Reverse geocoding via Nominatim
          const geoRes = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`);
          const geoData = await geoRes.json();
          
          const city = geoData.address.city || geoData.address.town || geoData.address.village;
          const state = geoData.address.state;

          if (city !== REQUIRED_CITY || state !== REQUIRED_STATE) {
            console.warn(`Localização Bloqueada: ${city}, ${state}`);
            onFail();
            return;
          }

          // 3. Verificando Registro do Dispositivo no Firebase
          setStatusMsg('Verificando registro do dispositivo...');
          let deviceId = localStorage.getItem('admin_device_id');
          if (!deviceId) {
            deviceId = 'adm_' + Math.random().toString(36).substr(2, 9) + Date.now();
          }

          if (window.firebaseDB) {
            const adminRef = window.firebaseDB.ref('system_config/admin_device');
            const snap = await adminRef.once('value');
            const registeredDevice = snap.val();

            if (!registeredDevice) {
              // Primeiro acesso, registrar este dispositivo permanentemente
              setStatusMsg('Registrando este dispositivo como administrador permanente...');
              await adminRef.set(deviceId);
              localStorage.setItem('admin_device_id', deviceId);
              onSuccess();
            } else {
              // Já existe um admin registrado, comparar
              if (registeredDevice === deviceId) {
                 localStorage.setItem('admin_device_id', deviceId); // Garantir que está setado
                 onSuccess();
              } else {
                 console.warn('Dispositivo não autorizado. Outro dispositivo já é o administrador.');
                 onFail();
              }
            }
          } else {
            onFail();
          }

        } catch (err) {
          console.error('Erro na geolocalização remota:', err);
          onFail();
        }
      }, (error) => {
        console.error('Permissão de geolocalização negada ou falha:', error);
        onFail();
      }, {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      });

    } catch (error) {
      console.error('Erro nas verificações de segurança:', error);
      onFail();
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      <div className="icon-shield text-6xl text-indigo-500 mb-6 animate-pulse"></div>
      <h2 className="text-xl font-bold mb-4 text-white">Autenticação Restrita</h2>
      <div className="flex items-center gap-3 text-gray-400">
        <div className="icon-loader animate-spin"></div>
        <span>{statusMsg}</span>
      </div>
      <p className="mt-6 text-xs text-gray-600 max-w-sm text-center">
        O sistema requer o IP 200.193.63.92, localização em Itajaí/SC e dispositivo registrado de forma única no banco de dados.
      </p>
    </div>
  );
}
window.AdminAuth = AdminAuth;