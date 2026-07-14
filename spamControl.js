class WebRTCManager {
    constructor(userId, onMessageReceived) {
        this.peer = new Peer(userId.replace(/[^a-zA-Z0-9]/g, ''));
        this.connections = {};
        this.chunks = {};
        this.onMessageReceived = onMessageReceived;

        this.peer.on('connection', (conn) => {
            this.setupConnection(conn);
        });
    }

    setupConnection(conn) {
        conn.on('data', (data) => {
            if (data.type === 'text_msg') {
                if (this.onMessageReceived) {
                    this.onMessageReceived(conn.peer, data.content, 'text', data.msgData);
                }
            } else if (data.type === 'chunk') {
                if (!this.chunks[data.id]) this.chunks[data.id] = [];
                this.chunks[data.id][data.index] = data.chunk;
                
                // If all chunks received
                if (data.index === data.total - 1) {
                    const fullBase64 = this.chunks[data.id].join('');
                    delete this.chunks[data.id];
                    if (this.onMessageReceived) {
                        this.onMessageReceived(conn.peer, fullBase64, data.fileType, data.msgData);
                    }
                }
            }
        });
        this.connections[conn.peer] = conn;
    }

    connect(targetId) {
        const cleanId = targetId.replace(/[^a-zA-Z0-9]/g, '');
        if (!this.connections[cleanId]) {
            const conn = this.peer.connect(cleanId);
            this.setupConnection(conn);
        }
        return this.connections[cleanId];
    }

    sendBase64InChunks(targetId, base64Str, fileType, msgData = {}) {
        const cleanId = targetId.replace(/[^a-zA-Z0-9]/g, '');
        const conn = this.connect(cleanId);
        const chunkSize = 16384; // 16kb chunks
        const chunks = [];
        
        for (let i = 0; i < base64Str.length; i += chunkSize) {
            chunks.push(base64Str.slice(i, i + chunkSize));
        }

        const fileId = Date.now().toString();

        const sendNext = (index) => {
            if (index >= chunks.length) return;
            
            const sendPacket = () => {
                conn.send({ 
                    type: 'chunk', 
                    id: fileId, 
                    fileType, 
                    chunk: chunks[index], 
                    index, 
                    total: chunks.length,
                    msgData
                });
                setTimeout(() => sendNext(index + 1), 20); // Delay for buffer
            };

            if (conn.open) {
                sendPacket();
            } else {
                conn.on('open', sendPacket);
            }
        };

        sendNext(0);
    }

    sendTextMessage(targetId, text, msgData = {}) {
        const cleanId = targetId.replace(/[^a-zA-Z0-9]/g, '');
        const conn = this.connect(cleanId);
        
        const sendPacket = () => {
            conn.send({
                type: 'text_msg',
                content: text,
                msgData
            });
        };

        if (conn.open) {
            sendPacket();
        } else {
            conn.on('open', sendPacket);
        }
    }
}
window.WebRTCManager = WebRTCManager;