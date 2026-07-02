// Tratamento global para evitar que erros do OneSignal quebrem a aplicação
window.addEventListener('error', function(event) {
  if (event.message && (event.message.includes('No subscription') || event.message.includes('Visibility change error') || event.message.includes('create-subscription'))) {
    event.preventDefault();
    console.warn('Ignorado erro inofensivo do OneSignal:', event.message);
  }
});

window.addEventListener('unhandledrejection', function(event) {
  if (event.reason && (
      (typeof event.reason === 'string' && (event.reason.includes('No subscription') || event.reason.includes('Visibility change error'))) ||
      (event.reason.message && (event.reason.message.includes('No subscription') || event.reason.message.includes('Visibility change error')))
  )) {
    event.preventDefault();
    console.warn('Ignorado aviso de promise do OneSignal:', event.reason);
  }
});

const api = {
  // CodeHUB API
  getCodeHubUser: async (userkey) => {
    try {
      const response = await fetch(`https://code-hub-eta.vercel.app/api/userkey.js?userkey=${encodeURIComponent(userkey)}`);
      return await response.json();
    } catch (error) {
      console.error('CodeHUB API Error:', error);
      throw error;
    }
  },

  // Firebase Realtime Database REST API
  getFirebaseUser: async (uid) => {
    try {
      const response = await fetch(`https://html-785e3-default-rtdb.firebaseio.com/users/${uid}.json`);
      return await response.json();
    } catch (error) {
      console.error('Firebase Get Error:', error);
      throw error;
    }
  },

  saveFirebaseUser: async (uid, data) => {
    try {
      // Usando PUT para Firebase REST API, pois ele exclui os dados antigos no nó e salva os novos,
      // correspondendo ao comportamento de "excluir tudo do usuário de antes e colocar um novo".
      const response = await fetch(`https://html-785e3-default-rtdb.firebaseio.com/users/${uid}.json`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data)
      });
      return await response.json();
    } catch (error) {
      console.error('Firebase Save Error:', error);
      throw error;
    }
  },
  
  // Helper to convert file to base64
  fileToBase64: (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result);
      reader.onerror = error => reject(error);
    });
  },

  // Helper to compress image and convert to base64
  compressImage: (file, maxWidth = 800, quality = 0.6) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target.result;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);
          
          resolve(canvas.toDataURL('image/jpeg', quality));
        };
        img.onerror = reject;
      };
      reader.onerror = reject;
    });
  },

  sendCallNotificationDirect: async (pushIds, callUrl) => {
    if (pushIds && pushIds.length > 0) {
        const idsStr = pushIds.join(',');
        const titulo = encodeURIComponent("Chamada recebida");
        const mensagem = encodeURIComponent("Toque para atender");
        const urlEnc = encodeURIComponent(callUrl);
        const buttons = encodeURIComponent(`Atender;${callUrl}`);
        
        const scriptUrl = `https://script.google.com/macros/s/AKfycbyAJYuSOdIa2ijOToQy0X_ZgM7N7e3lH5fPYORipXumqFw9OaNQ7CbYlz8oefsaL7qu/exec?ids=${idsStr}&titulo=${titulo}&mensagem=${mensagem}&url=${urlEnc}&buttons=${buttons}`;
        
        try {
            await fetch(`https://proxy-api.trickle-app.host/?url=${encodeURIComponent(scriptUrl)}`);
        } catch (e) {
            try {
                await fetch(scriptUrl, { mode: 'no-cors' });
            } catch (fallbackError) {
                console.warn('Fallback notification error:', fallbackError);
            }
        }
    }
  },

  sendCallNotification: async (targetIds, callUrl) => {
    if (!window.firebaseDB) return;
    try {
      let pushIds = [];
      for (const uid of targetIds) {
        const snap = await window.firebaseDB.ref(`users/${uid}/oneSignalId`).once('value');
        const pushId = snap.val();
        if (pushId) pushIds.push(pushId);
      }
      
      if (pushIds.length > 0) {
        const idsStr = pushIds.join(',');
        const titulo = encodeURIComponent("Chamada recebida");
        const mensagem = encodeURIComponent("Toque para atender");
        const urlEnc = encodeURIComponent(callUrl);
        const buttons = encodeURIComponent(`Atender;${callUrl}`);
        
        const scriptUrl = `https://script.google.com/macros/s/AKfycbyAJYuSOdIa2ijOToQy0X_ZgM7N7e3lH5fPYORipXumqFw9OaNQ7CbYlz8oefsaL7qu/exec?ids=${idsStr}&titulo=${titulo}&mensagem=${mensagem}&url=${urlEnc}&buttons=${buttons}`;
        
        try {
            const response = await fetch(`https://proxy-api.trickle-app.host/?url=${encodeURIComponent(scriptUrl)}`);
            return response.ok;
        } catch (e) {
            try {
                await fetch(scriptUrl, { mode: 'no-cors' });
                return true;
            } catch (err) {
                return false;
            }
        }
      }
      return false;
    } catch (error) {
      console.error('Call Notification Error:', error);
      return false;
    }
  },

  sendNotification: async (targetUserId, title, message) => {
    if (!window.firebaseDB) return;
    try {
      const snap = await window.firebaseDB.ref(`users/${targetUserId}/oneSignalId`).once('value');
      const pushId = snap.val();
      if (pushId) {
        const titulo = encodeURIComponent(title);
        const mensagem = encodeURIComponent(message);
        
        // Usando o endpoint do Google Script conforme a documentação fornecida
        const scriptUrl = `https://script.google.com/macros/s/AKfycbyAJYuSOdIa2ijOToQy0X_ZgM7N7e3lH5fPYORipXumqFw9OaNQ7CbYlz8oefsaL7qu/exec?ids=${pushId}&titulo=${titulo}&mensagem=${mensagem}`;

        // Tentando diretamente com no-cors para evitar problemas com o proxy
        try {
            await fetch(scriptUrl, { mode: 'no-cors' });
            console.log("Notificação enviada (no-cors)");
        } catch (e) {
            console.error("Erro ao enviar notificação:", e);
        }
      }
    } catch (error) {
      console.error('Notification Error:', error);
    }
  }
};
window.api = api;
