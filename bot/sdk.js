// sdk.js - SDK COMPLETO SEM CHAMADAS
// versão 5.0.0
// Hospedar em: https://alexandre7888.github.io/mensagens/bot/sdk.js

const https = require('https');
const { URL } = require('url');

class MessageSDK {
    constructor() {
        this.FIREBASE_URL = 'https://html-785e3-default-rtdb.firebaseio.com';
        this.botId = null;
        this.botNome = null;
        this.conectado = false;
        this.comandos = new Map();
        this.eventos = new Map();
        this.monitorInterval = null;
        this.ultimoTimestamp = {};
        this.processando = {};
        this.versao = '5.0.0';
    }

    getVersao() {
        return this.versao;
    }

    // ==================== REQUISIÇÕES ====================

    async _request(path, method = 'GET', data = null) {
        const url = `${this.FIREBASE_URL}${path}`;

        return new Promise((resolve, reject) => {
            const urlObj = new URL(url);
            const options = {
                hostname: urlObj.hostname,
                path: urlObj.pathname + urlObj.search,
                method: method,
                headers: { 'Content-Type': 'application/json' }
            };

            const req = https.request(options, (res) => {
                let body = '';
                res.on('data', chunk => body += chunk);
                res.on('end', () => {
                    try {
                        resolve(body ? JSON.parse(body) : null);
                    } catch(e) {
                        resolve(body);
                    }
                });
            });

            req.on('error', reject);
            if (data) req.write(JSON.stringify(data));
            req.end();
        });
    }

    // ==================== INICIALIZAÇÃO ====================

    async iniciar(config) {
        this.botId = config.botId;
        this.botNome = config.botNome || config.botId;

        console.log(`🤖 SDK v${this.versao} - Bot: ${this.botNome}`);

        const userData = await this._request(`/users/${this.botId}.json`);

        if (!userData) {
            throw new Error(`Bot ${this.botId} não encontrado!`);
        }

        this.conectado = true;
        this.emit('ready', { botId: this.botId, nome: this.botNome });

        return this;
    }

    // ==================== GRUPOS ====================

    async listarGrupos() {
        if (!this.conectado) throw new Error('SDK não inicializado');

        const userData = await this._request(`/users/${this.botId}.json`);
        const grupos = [];

        if (userData && userData.chats) {
            for (const [chatId, chatData] of Object.entries(userData.chats)) {
                const grupo = await this._request(`/groups/${chatId}.json`);
                grupos.push({
                    id: chatId,
                    nome: grupo?.nome || chatData.name || chatId,
                    tipo: chatData.type || 'group',
                    membros: grupo?.members ? Object.keys(grupo.members).length : 0,
                    dono: grupo?.owner || null,
                    criado: grupo?.criado || null
                });
            }
        }

        return grupos;
    }

    async getInfoGrupo(grupoId) {
        const grupo = await this._request(`/groups/${grupoId}.json`);
        const cargos = await this.listarCargos(grupoId);

        return {
            id: grupoId,
            nome: grupo?.nome || grupoId,
            descricao: grupo?.descricao || '',
            dono: grupo?.owner || null,
            totalMembros: grupo?.members ? Object.keys(grupo.members).length : 0,
            criado: grupo?.criado || null,
            totalCargos: cargos.length
        };
    }

    async criarGrupo(nome, descricao = '') {
        const grupoId = `group_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

        const grupo = {
            id: grupoId,
            nome: nome,
            descricao: descricao,
            owner: this.botId,
            criado: Date.now(),
            members: { [this.botId]: { name: this.botNome, joined: Date.now(), cargos: [] } },
            messages: {}
        };

        await this._request(`/groups/${grupoId}.json`, 'PUT', grupo);
        await this._request(`/users/${this.botId}/chats/${grupoId}.json`, 'PUT', {
            name: nome,
            type: 'group',
            joined: Date.now()
        });

        return { success: true, grupoId: grupoId };
    }

    async entrarGrupo(grupoId) {
        const grupo = await this._request(`/groups/${grupoId}.json`);
        if (!grupo) throw new Error('Grupo não encontrado');

        await this._request(`/groups/${grupoId}/members/${this.botId}.json`, 'PUT', {
            name: this.botNome,
            joined: Date.now(),
            cargos: []
        });

        await this._request(`/users/${this.botId}/chats/${grupoId}.json`, 'PUT', {
            name: grupo.nome || grupoId,
            type: 'group',
            joined: Date.now()
        });

        return { success: true };
    }

    async sairGrupo(grupoId) {
        await this._request(`/groups/${grupoId}/members/${this.botId}.json`, 'DELETE');
        await this._request(`/users/${this.botId}/chats/${grupoId}.json`, 'DELETE');
        return { success: true };
    }

    // ==================== MENSAGENS ====================

    async enviarMensagem(grupoId, texto, options = {}) {
        if (!this.conectado) throw new Error('SDK não inicializado');

        const timestamp = Date.now();
        const msgId = `msg_${timestamp}_${Math.random().toString(36).substr(2, 6)}`;

        const mensagem = {
            id: msgId,
            senderId: this.botId,
            senderName: this.botNome,
            text: texto,
            timestamp: timestamp,
            type: options.type || 'text',
            mencionados: options.mencionados || [],
            replyTo: options.replyTo || null
        };

        if (options.embed) {
            mensagem.embed = options.embed;
            mensagem.type = 'embed';
        }

        if (options.imagem) {
            mensagem.imagem = options.imagem;
            mensagem.type = 'image';
        }

        await this._request(`/groups/${grupoId}/messages/${msgId}.json`, 'PUT', mensagem);

        return { success: true, messageId: msgId };
    }

    async enviarEmbed(grupoId, embed) {
        return await this.enviarMensagem(grupoId, '', { type: 'embed', embed: embed });
    }

    async enviarImagem(grupoId, imagemUrl, legenda = '') {
        return await this.enviarMensagem(grupoId, legenda, { type: 'image', imagem: imagemUrl });
    }

    async responderMensagem(grupoId, mensagemId, resposta) {
        return await this.enviarMensagem(grupoId, resposta, { replyTo: mensagemId });
    }

    async lerMensagens(grupoId, limite = 50) {
        const mensagens = await this._request(`/groups/${grupoId}/messages.json?orderBy="timestamp"&limitToLast=${limite}`);
        if (!mensagens) return [];

        return Object.entries(mensagens)
            .map(([id, msg]) => ({ id, ...msg }))
            .sort((a, b) => a.timestamp - b.timestamp);
    }

    async getMensagem(grupoId, mensagemId) {
        return await this._request(`/groups/${grupoId}/messages/${mensagemId}.json`);
    }

    async deletarMensagem(grupoId, mensagemId) {
        const mensagem = await this.getMensagem(grupoId, mensagemId);

        if (mensagem?.senderId === this.botId) {
            await this._request(`/groups/${grupoId}/messages/${mensagemId}.json`, 'DELETE');
            return { success: true };
        }

        const podeApagar = await this.verificarPermissao(grupoId, this.botId, 'apagar_mensagem');
        if (!podeApagar) {
            throw new Error('Sem permissão para apagar esta mensagem');
        }

        await this._request(`/groups/${grupoId}/messages/${mensagemId}.json`, 'DELETE');
        return { success: true };
    }

    async editarMensagem(grupoId, mensagemId, novoTexto) {
        const mensagem = await this.getMensagem(grupoId, mensagemId);

        if (mensagem?.senderId !== this.botId) {
            throw new Error('Você só pode editar suas próprias mensagens');
        }

        mensagem.text = novoTexto;
        mensagem.editado = Date.now();

        await this._request(`/groups/${grupoId}/messages/${mensagemId}.json`, 'PUT', mensagem);
        return { success: true };
    }

    // ==================== MEMBROS ====================

    async listarMembros(grupoId) {
        const grupo = await this._request(`/groups/${grupoId}.json`);

        if (!grupo || !grupo.members) return [];

        const membros = [];
        for (const [userId, userData] of Object.entries(grupo.members)) {
            membros.push({
                id: userId,
                nome: userData.name || userId,
                entrou: userData.joined,
                cargos: userData.cargos || []
            });
        }

        return membros;
    }

    async getMembro(grupoId, userId) {
        return await this._request(`/groups/${grupoId}/members/${userId}.json`);
    }

    async adicionarMembro(grupoId, userId, nome = null) {
        const podeAdicionar = await this.verificarPermissao(grupoId, this.botId, 'adicionar_membro');
        if (!podeAdicionar) {
            throw new Error('Bot não tem permissão para adicionar membros');
        }

        const memberData = {
            name: nome || userId,
            joined: Date.now(),
            cargos: []
        };

        await this._request(`/groups/${grupoId}/members/${userId}.json`, 'PUT', memberData);

        const grupo = await this._request(`/groups/${grupoId}.json`);
        await this._request(`/users/${userId}/chats/${grupoId}.json`, 'PUT', {
            name: grupo?.nome || grupoId,
            type: 'group',
            joined: Date.now()
        });

        return { success: true };
    }

    async removerMembro(grupoId, userId) {
        const grupo = await this._request(`/groups/${grupoId}.json`);

        if (grupo?.owner === userId) {
            throw new Error('Não é possível remover o dono do grupo');
        }

        const podeRemover = await this.verificarPermissao(grupoId, this.botId, 'remover_membro');
        if (!podeRemover) {
            throw new Error('Bot não tem permissão para remover membros');
        }

        await this._request(`/groups/${grupoId}/members/${userId}.json`, 'DELETE');
        await this._request(`/users/${userId}/chats/${grupoId}.json`, 'DELETE');

        return { success: true };
    }

    // ==================== CARGOS ====================

    async criarCargo(grupoId, nome, cor = '#ffffff', permissoes = []) {
        const grupo = await this._request(`/groups/${grupoId}.json`);

        if (grupo?.owner !== this.botId) {
            const podeCriar = await this.verificarPermissao(grupoId, this.botId, 'criar_cargo');
            if (!podeCriar) {
                throw new Error('Sem permissão para criar cargos');
            }
        }

        let cargos = await this._request(`/groups/${grupoId}/cargos.json`);
        if (!cargos) cargos = { cargos_personalizados: {} };
        if (!cargos.cargos_personalizados) cargos.cargos_personalizados = {};

        cargos.cargos_personalizados[nome] = {
            cor: cor,
            membros: [],
            permissoes: permissoes
        };

        await this._request(`/groups/${grupoId}/cargos.json`, 'PUT', cargos);

        return { success: true, nome: nome };
    }

    async listarCargos(grupoId) {
        const cargos = await this._request(`/groups/${grupoId}/cargos.json`);

        if (!cargos || !cargos.cargos_personalizados) return [];

        return Object.entries(cargos.cargos_personalizados).map(([nome, dados]) => ({
            nome: nome,
            cor: dados.cor,
            permissoes: dados.permissoes || [],
            membros: dados.membros || []
        }));
    }

    async atribuirCargo(grupoId, userId, cargoNome) {
        const podeAtribuir = await this.verificarPermissao(grupoId, this.botId, 'atribuir_cargo');
        if (!podeAtribuir) {
            throw new Error('Bot não tem permissão para atribuir cargos');
        }

        let cargos = await this._request(`/groups/${grupoId}/cargos.json`);
        if (!cargos || !cargos.cargos_personalizados || !cargos.cargos_personalizados[cargoNome]) {
            throw new Error(`Cargo "${cargoNome}" não encontrado`);
        }

        if (!cargos.cargos_personalizados[cargoNome].membros) {
            cargos.cargos_personalizados[cargoNome].membros = [];
        }

        if (!cargos.cargos_personalizados[cargoNome].membros.includes(userId)) {
            cargos.cargos_personalizados[cargoNome].membros.push(userId);
        }

        await this._request(`/groups/${grupoId}/cargos.json`, 'PUT', cargos);

        const membro = await this.getMembro(grupoId, userId);
        if (membro) {
            if (!membro.cargos) membro.cargos = [];
            if (!membro.cargos.includes(cargoNome)) {
                membro.cargos.push(cargoNome);
                await this._request(`/groups/${grupoId}/members/${userId}.json`, 'PUT', membro);
            }
        }

        return { success: true };
    }

    async removerCargo(grupoId, userId, cargoNome) {
        const podeRemover = await this.verificarPermissao(grupoId, this.botId, 'remover_cargo');
        if (!podeRemover) {
            throw new Error('Bot não tem permissão para remover cargos');
        }

        let cargos = await this._request(`/groups/${grupoId}/cargos.json`);
        if (!cargos || !cargos.cargos_personalizados || !cargos.cargos_personalizados[cargoNome]) {
            throw new Error(`Cargo "${cargoNome}" não encontrado`);
        }

        if (cargos.cargos_personalizados[cargoNome].membros) {
            cargos.cargos_personalizados[cargoNome].membros = cargos.cargos_personalizados[cargoNome].membros.filter(id => id !== userId);
        }

        await this._request(`/groups/${grupoId}/cargos.json`, 'PUT', cargos);

        const membro = await this.getMembro(grupoId, userId);
        if (membro && membro.cargos) {
            membro.cargos = membro.cargos.filter(c => c !== cargoNome);
            await this._request(`/groups/${grupoId}/members/${userId}.json`, 'PUT', membro);
        }

        return { success: true };
    }

    async deletarCargo(grupoId, cargoNome) {
        const grupo = await this._request(`/groups/${grupoId}.json`);

        if (grupo?.owner !== this.botId) {
            throw new Error('Apenas o dono do grupo pode deletar cargos');
        }

        let cargos = await this._request(`/groups/${grupoId}/cargos.json`);
        if (!cargos || !cargos.cargos_personalizados || !cargos.cargos_personalizados[cargoNome]) {
            throw new Error(`Cargo "${cargoNome}" não encontrado`);
        }

        delete cargos.cargos_personalizados[cargoNome];
        await this._request(`/groups/${grupoId}/cargos.json`, 'PUT', cargos);

        return { success: true };
    }

    async getCargosUsuario(grupoId, userId) {
        const membro = await this.getMembro(grupoId, userId);
        return membro?.cargos || [];
    }

    // ==================== PERMISSÕES ====================

    async verificarPermissao(grupoId, userId, permissao) {
        const grupo = await this._request(`/groups/${grupoId}.json`);

        if (grupo?.owner === userId) return true;

        const membro = await this.getMembro(grupoId, userId);
        const cargosUsuario = membro?.cargos || [];

        if (cargosUsuario.length === 0) return false;

        const cargos = await this._request(`/groups/${grupoId}/cargos.json`);

        if (!cargos || !cargos.cargos_personalizados) return false;

        for (const cargoNome of cargosUsuario) {
            const cargo = cargos.cargos_personalizados[cargoNome];
            if (cargo && cargo.permissoes && cargo.permissoes.includes(permissao)) {
                return true;
            }
        }

        return false;
    }

    // ==================== COMANDOS ====================

    registrarComando(nome, callback, descricao = '') {
        this.comandos.set(nome, { callback, descricao });
        console.log(`✅ Comando registrado: ${nome}`);
        return this;
    }

    listarComandos() {
        return Array.from(this.comandos.keys());
    }

    // ==================== MONITORAMENTO ====================

    async monitorarGrupo(grupoId, callback = null) {
        if (this.monitorInterval) {
            clearInterval(this.monitorInterval);
        }

        if (!this.ultimoTimestamp[grupoId]) {
            this.ultimoTimestamp[grupoId] = Date.now();
        }

        console.log(`📡 Monitorando grupo: ${grupoId}`);

        this.monitorInterval = setInterval(async () => {
            if (this.processando[grupoId]) return;
            this.processando[grupoId] = true;

            try {
                const mensagens = await this._request(`/groups/${grupoId}/messages.json`);

                if (mensagens) {
                    const msgs = Object.entries(mensagens)
                        .map(([id, msg]) => ({ id, ...msg }))
                        .filter(msg => msg.timestamp > this.ultimoTimestamp[grupoId] && msg.senderId !== this.botId)
                        .sort((a, b) => a.timestamp - b.timestamp);

                    for (const msg of msgs) {
                        const msgKey = `${grupoId}_${msg.id}`;
                        if (this.processando[msgKey]) continue;
                        this.processando[msgKey] = true;

                        if (callback) {
                            await callback(msg);
                        }

                        this.emit('mensagem', msg);

                        if (msg.text && msg.text.startsWith('!')) {
                            const [comando, ...args] = msg.text.slice(1).split(' ');
                            if (this.comandos.has(comando)) {
                                const cmd = this.comandos.get(comando);
                                const ctx = {
                                    grupoId: grupoId,
                                    autorId: msg.senderId,
                                    autorNome: msg.senderName,
                                    mensagemId: msg.id,
                                    enviarMsg: (texto) => this.enviarMensagem(grupoId, texto),
                                    responder: (texto) => this.responderMensagem(grupoId, msg.id, texto)
                                };
                                try {
                                    await cmd.callback(args, ctx);
                                    console.log(`🎯 Comando executado: ${comando} por ${msg.senderName}`);
                                } catch(e) {
                                    console.error(`❌ Erro no comando ${comando}:`, e.message);
                                    await this.enviarMensagem(grupoId, `❌ Erro: ${e.message}`);
                                }
                            }
                        }

                        if (msg.timestamp > this.ultimoTimestamp[grupoId]) {
                            this.ultimoTimestamp[grupoId] = msg.timestamp;
                        }

                        delete this.processando[msgKey];
                    }
                }
            } catch(e) {}

            this.processando[grupoId] = false;
        }, 2000);

        return this.monitorInterval;
    }

    pararMonitoramento() {
        if (this.monitorInterval) {
            clearInterval(this.monitorInterval);
            this.monitorInterval = null;
            console.log('🛑 Monitoramento parado');
        }
    }

    // ==================== EVENTOS ====================

    on(evento, callback) {
        if (!this.eventos.has(evento)) {
            this.eventos.set(evento, []);
        }
        this.eventos.get(evento).push(callback);
        return this;
    }

    once(evento, callback) {
        const wrapper = (dados) => {
            callback(dados);
            this.off(evento, wrapper);
        };
        this.on(evento, wrapper);
        return this;
    }

    off(evento, callback) {
        if (this.eventos.has(evento)) {
            const callbacks = this.eventos.get(evento);
            const index = callbacks.indexOf(callback);
            if (index !== -1) callbacks.splice(index, 1);
        }
        return this;
    }

    emit(evento, dados) {
        if (this.eventos.has(evento)) {
            this.eventos.get(evento).forEach(cb => {
                try {
                    cb(dados);
                } catch(e) {
                    console.error(`Erro no evento ${evento}:`, e);
                }
            });
        }
    }

    // ==================== UTILIDADES ====================

    getBotId() {
        return this.botId;
    }

    getBotNome() {
        return this.botNome;
    }

    isConectado() {
        return this.conectado;
    }

    async delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

module.exports = MessageSDK;