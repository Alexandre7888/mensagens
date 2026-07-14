window.CensorUtils = {
    censor: (text) => {
        if (!text || typeof text !== 'string') return text;
        // Substitui qualquer palavra que comece com bot_ (case insensitive) por ***
        return text.replace(/\bbot_\S*/gi, '***');
    }
};