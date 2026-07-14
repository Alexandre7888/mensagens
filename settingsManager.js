class SpamController {
    constructor() {
        this.messageTimestamps = [];
        this.audioTimestamps = [];
        this.isBanned = false;
        this.banUntil = 0;
    }

    checkSpam(type) {
        const now = Date.now();
        
        // Verifica se está banido
        if (this.isBanned && now < this.banUntil) {
            const remaining = Math.ceil((this.banUntil - now) / 1000);
            return { blocked: true, message: `Você está bloqueado por spam. Aguarde ${remaining} segundos.` };
        } else if (this.isBanned && now >= this.banUntil) {
            this.isBanned = false; // Remove o ban
        }

        if (type === 'audio') {
            // Regra: Máximo 3 áudios por 5 segundos
            this.audioTimestamps = this.audioTimestamps.filter(t => now - t < 5000);
            if (this.audioTimestamps.length >= 3) {
                this.banUser(15); // Bane por 15 segundos
                this.audioTimestamps = [];
                return { blocked: true, message: "Muitos áudios enviados rapidamente! Bloqueado por 15s." };
            }
            this.audioTimestamps.push(now);
        } else {
            // Regra: Máximo 5 mensagens por 5 segundos
            this.messageTimestamps = this.messageTimestamps.filter(t => now - t < 5000);
            if (this.messageTimestamps.length >= 5) {
                this.banUser(15);
                this.messageTimestamps = [];
                return { blocked: true, message: "Muitas mensagens enviadas rapidamente! Bloqueado por 15s." };
            }
            this.messageTimestamps.push(now);
        }

        return { blocked: false };
    }

    banUser(seconds) {
        this.isBanned = true;
        this.banUntil = Date.now() + (seconds * 1000);
    }
}

window.spamController = new SpamController();