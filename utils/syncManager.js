class SyncManager {
    constructor(userId, deviceType, onSyncData) {
        this.userId = userId;
        this.deviceType = deviceType; // 'mobile' or 'tv'
        this.onSyncData = onSyncData;
        this.peer = null;
        this.isConnected = false;
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
        const updateStatus = (status) => {
            this.isConnected = status;
            if (window.dispatchEvent) {
                window.dispatchEvent(new CustomEvent('sync_status_changed', { detail: { connected: status } }));
            }
        };

        conn.on('open', () => {
            updateStatus(true);
            console.log(`[SyncManager] Conexão P2P estabelecida com ${conn.peer}`);
        });

        conn.on('close', () => {
            updateStatus(false);
            console.log(`[SyncManager] Conexão P2P fechada com ${conn.peer}`);
        });

        conn.on('error', () => {
            updateStatus(false);
        });

        if (conn.open) {
            updateStatus(true);
        }

        let incomingChunks = [];
        conn.on('data', (data) => {
            if (data.type === 'sync_request' && this.deviceType === 'mobile') {
                this.sendLocalHistory(conn);
            } else if (data.type === 'sync_data') {
                if (this.onSyncData) this.onSyncData(data.payload);
            } else if (data.type === 'realtime_msg') {
                // Mensagem em tempo real entre os dispositivos do mesmo usuário
                if (window.dispatchEvent) {
                    window.dispatchEvent(new CustomEvent('sync_realtime_msg', { detail: data.payload }));
                }
            } else if (data.type === 'sync_chunk') {
                incomingChunks[data.index] = data.data;
                if (incomingChunks.filter(Boolean).length === data.total) {
                    try {
                        const completeData = incomingChunks.join('');
                        const parsed = JSON.parse(completeData);
                        
                        Object.keys(parsed).forEach(k => {
                            try { localStorage.setItem(k, parsed[k]); } catch(e) {}
                        });

                        if (this.onSyncData) this.onSyncData(parsed);
                        
                        if (window.dispatchEvent) {
                            window.dispatchEvent(new CustomEvent('sync_completed'));
                        }
                        
                        incomingChunks = [];
                    } catch(e) {
                        console.error("Erro ao montar os chunks:", e);
                    }
                }
            }
        });
    }

    broadcastMessage(chatId, message) {
        const payload = { chatId, message };
        // Broadcast localmente também caso haja outros listeners
        if (window.dispatchEvent) {
            window.dispatchEvent(new CustomEvent('sync_realtime_msg', { detail: payload }));
        }
        // Envia para o outro dispositivo (se estivermos na TV enviamos para o mobile, e vice-versa)
        if (this.peer) {
            const conns = Object.values(this.peer.connections);
            conns.forEach(connArray => {
                connArray.forEach(conn => {
                    if (conn.open) {
                        conn.send({ type: 'realtime_msg', payload });
                    }
                });
            });
        }
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
        // Coleta todo o histórico local, mídias e caches relevantes
        const allHistory = {};
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && (key.startsWith('local_history_') || key.startsWith('chat_') || key.startsWith('media_'))) {
                try {
                    allHistory[key] = localStorage.getItem(key); // Send raw string to avoid parse/stringify overhead for base64
                } catch(e){}
            }
        }
        
        const historyString = JSON.stringify(allHistory);
        const chunkSize = 65536; // 64KB chunks para mídias maiores
        const totalChunks = Math.ceil(historyString.length / chunkSize);
        
        // Dispara evento global de início de sincronização
        if (window.dispatchEvent) {
            window.dispatchEvent(new CustomEvent('sync_started', { detail: { total: totalChunks } }));
        }
        
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


}

window.SyncManager = SyncManager;