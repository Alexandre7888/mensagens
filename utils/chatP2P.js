// Lógica para WebRTC P2P (Mensagens, Digitando, Online Status)
window.ChatP2P = {
    peers: {},
    connections: {},
    
    initPeer: (userId, onMessage, onTyping, onStatusChange) => {
        window.ChatP2P.onMessageCb = onMessage;
        window.ChatP2P.onTypingCb = onTyping;

        if (window.ChatP2P.peers[userId]) {
            if(onStatusChange) onStatusChange('online');
            return window.ChatP2P.peers[userId];
        }
        
        const peer = new Peer(`phantora_user_${userId}`, {
            debug: 1,
            config: {
                'iceServers': [
                    { urls: 'stun:stun.l.google.com:19302' },
                    { urls: 'stun:stun1.l.google.com:19302' }
                ]
            }
        });

        peer.on('open', (id) => {
            console.log('P2P Online com ID: ', id);
            if(onStatusChange) onStatusChange('online');
        });

        peer.on('connection', (conn) => {
            window.ChatP2P.setupConnectionListeners(conn);
        });

        window.ChatP2P.peers[userId] = peer;
        return peer;
    },

    setupConnectionListeners: (conn) => {
        conn.on('open', () => {
            window.ChatP2P.connections[conn.peer] = conn;
        });
        conn.on('data', (data) => {
            if (data.type === 'typing' && window.ChatP2P.onTypingCb) {
                window.ChatP2P.onTypingCb(data.senderId, data.isTyping);
            } else if (data.type === 'message' && window.ChatP2P.onMessageCb) {
                if (!data.message.timestamp) data.message.timestamp = Date.now();
                window.ChatP2P.onMessageCb(data.message);
                if (window.ChatP2P.onTypingCb) window.ChatP2P.onTypingCb(data.message.senderId, false); // clear typing
            }
        });
        conn.on('error', () => {
            delete window.ChatP2P.connections[conn.peer];
        });
        conn.on('close', () => {
            delete window.ChatP2P.connections[conn.peer];
        });
        window.ChatP2P.connections[conn.peer] = conn;
    },

    connectToPeer: (myUserId, targetUserId) => {
        const peer = window.ChatP2P.peers[myUserId];
        if (!peer) return null;

        const targetPeerId = `phantora_user_${targetUserId}`;
        const existingConn = window.ChatP2P.connections[targetPeerId];
        
        if (existingConn && existingConn.open) {
            return existingConn;
        }

        const conn = peer.connect(targetPeerId, { reliable: true });
        window.ChatP2P.setupConnectionListeners(conn);
        return conn;
    },

    sendTyping: (myUserId, targetUserId, isTyping) => {
        const targetPeerId = `phantora_user_${targetUserId}`;
        let conn = window.ChatP2P.connections[targetPeerId];
        if (!conn || !conn.open) {
            conn = window.ChatP2P.connectToPeer(myUserId, targetUserId);
        }
        if (conn && conn.open) {
            conn.send({ type: 'typing', senderId: myUserId, isTyping });
        }
    },

    sendMessage: (myUserId, targetUserId, messageObj) => {
        // Se targetUserId for um array (grupo), envia para múltiplos peers
        if (Array.isArray(targetUserId)) {
            let sentToAtLeastOne = false;
            targetUserId.forEach(uid => {
                if (uid === myUserId) return;
                const peerId = `phantora_user_${uid}`;
                const conn = window.ChatP2P.connections[peerId];
                if (conn && conn.open) {
                    conn.send({ type: 'message', message: messageObj });
                    sentToAtLeastOne = true;
                }
            });
            return sentToAtLeastOne;
        }

        const targetPeerId = `phantora_user_${targetUserId}`;
        const conn = window.ChatP2P.connections[targetPeerId];
        if (conn && conn.open) {
            conn.send({ type: 'message', message: messageObj });
            return true;
        }
        return false;
    }
};