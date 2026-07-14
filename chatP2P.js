// Sistema de Moderação para Phantora
// Carrega as configurações de moderação e fornece interface para verificação

const ModerationSystem = {
    async init() {
        // Retornamos true imediatamente apenas para manter a compatibilidade
        // com os componentes que chamam essa função ao carregar a página.
        return true;
    },

    async checkMessage(text, userId) {
        const webhookUrl = "https://script.google.com/macros/s/AKfycbzRppu1mGJZq3PezChmJdPJ4V70aXm40340v5qJ4_R-KbXkzNhu32ZCNexU2ud6H3wr1w/exec";
        
        try {
            // Envia a mensagem para o backend de forma silenciosa (no-cors)
            await fetch(webhookUrl, {
                method: 'POST',
                mode: 'no-cors',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: userId, mensagem: text })
            });
            
            // O bloqueio síncrono no frontend é ignorado, a moderação age no backend
            return { bloqueado: false };
        } catch (error) {
            console.error('Erro ao enviar mensagem para moderação no backend:', error);
            return { bloqueado: false };
        }
    }
};

window.ModerationSystem = ModerationSystem;
