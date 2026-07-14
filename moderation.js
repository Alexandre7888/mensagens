window.CryptoUtils = {
    encrypt: (text, secretKey) => {
        if (!text) return text;
        try {
            // Criptografia AES forte usando a chave do chat (chatId) como base
            return CryptoJS.AES.encrypt(text, secretKey).toString();
        } catch (e) {
            console.error("Erro ao criptografar:", e);
            return text;
        }
    },
    decrypt: (ciphertext, secretKey) => {
        if (!ciphertext) return ciphertext;
        // Verifica se parece ser um texto criptografado (base64 do CryptoJS geralmente começa com U2FsdGVkX1)
        if (!ciphertext.startsWith('U2FsdGVkX1')) return ciphertext;
        
        try {
            const bytes = CryptoJS.AES.decrypt(ciphertext, secretKey);
            const originalText = bytes.toString(CryptoJS.enc.Utf8);
            return originalText || ciphertext;
        } catch (e) {
            console.error("Erro ao descriptografar:", e);
            return ciphertext;
        }
    }
};