class SyncManager {
    constructor(userId, deviceType, onSyncData) {
        this.userId = userId;
        this.deviceType = deviceType; // 'mobile' or 'tv'
        this.onSyncData = onSyncData;
        this.peer = null;
        this.peerId = `${userId}_${deviceType}_${Math.random().toString(36).substr(2,5)}`;
        
        this.initPeer();
    }

    initPeer() {
        this.peer = new Peer(this.peerId, { debug: 1 });
        
        this.peer.on('open', (id) => {
            console.log(`[SyncManager] Conectado como ${id}`);
            this.registerDevice();
            
            if (this.deviceType === 'tv') {
                this.findAndConnectToMobile();
            } else {
                this.findAndConnectToTV();
            }
        });

        this.peer.on('connection', (conn) => {
            this.setupConnection(conn);
        });
    }

    setupConnection(conn) {
        conn.on('data', (data) => {
            if (data.type === 'sync_request' && this.deviceType === 'mobile') {
                this.sendLocalHistory(conn);
            } else if (data.type === 'sync_data') {
                if (this.onSyncData) this.onSyncData(data.payload);
            }
        });
    }

    registerDevice() {
        if (!window.firebaseDB) return;
        const ref = window.firebaseDB.ref(`users/${this.userId}/activeSyncDevices/${this.deviceType}`);
        ref.set(this.peerId);
        ref.onDisconnect().remove();
    }

    findAndConnectToMobile() {
        if (!window.firebaseDB) return;
        window.firebaseDB.ref(`users/${this.userId}/activeSyncDevices/mobile`).once('value', snap => {
            const mobilePeerId = snap.val();
            if (mobilePeerId) {
                const conn = this.peer.connect(mobilePeerId);
                conn.on('open', () => {
                    conn.send({ type: 'sync_request' });
                });
                this.setupConnection(conn);
            }
        });
    }
    
    findAndConnectToTV() {
        if (!window.firebaseDB) return;
        window.firebaseDB.ref(`users/${this.userId}/activeSyncDevices/tv`).once('value', snap => {
            const tvPeerId = snap.val();
            if (tvPeerId) {
                const conn = this.peer.connect(tvPeerId);
                this.setupConnection(conn);
            }
        });
    }

    sendLocalHistory(conn) {
        // Collect all local history
        const allHistory = {};
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key.startsWith('local_history_')) {
                try {
                    allHistory[key] = JSON.parse(localStorage.getItem(key));
                } catch(e){}
            }
        }
        
        const historyString = JSON.stringify(allHistory);
        const chunkSize = 16384; // 16KB chunks
        const totalChunks = Math.ceil(historyString.length / chunkSize);
        
        for (let i = 0; i < totalChunks; i++) {
            const chunk = historyString.slice(i * chunkSize, (i + 1) * chunkSize);
            conn.send({
                type: 'sync_chunk',
                index: i,
                total: totalChunks,
                data: chunk
            });
        }
    }

    setupConnection(conn) {
        let incomingChunks = [];
        conn.on('data', (data) => {
            if (data.type === 'sync_request' && this.deviceType === 'mobile') {
                this.sendLocalHistory(conn);
            } else if (data.type === 'sync_data') {
                if (this.onSyncData) this.onSyncData(data.payload);
            } else if (data.type === 'sync_chunk') {
                incomingChunks[data.index] = data.data;
                if (incomingChunks.filter(Boolean).length === data.total) {
                    try {
                        const completeData = incomingChunks.join('');
                        const parsed = JSON.parse(completeData);
                        if (this.onSyncData) this.onSyncData(parsed);
                        incomingChunks = [];
                    } catch(e) {
                        console.error("Erro ao montar os chunks:", e);
                    }
                }
            }
        });
    }
}

window.SyncManager = SyncManager;