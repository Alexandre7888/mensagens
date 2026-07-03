// ================================================================
// MODERACAO.JS - SISTEMA DE MODERAÇÃO (CORRIGIDO)
// ================================================================

const FIREBASE_URL = 'https://html-785e3-default-rtdb.firebaseio.com';
const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyAJYuSOdIa2ijOToQy0X_ZgM7N7e3lH5fPYORipXumqFw9OaNQ7CbYlz8oefsaL7qu/exec';
const ADMIN_ID = '75da7f5d-3208-4b64-b008-7ee4e2a3c59e';

let palavrasProibidas = [];
let configCarregada = false;

// ================================================================
// MAPEAMENTO DE SUBSTITUIÇÕES
// ================================================================

const substituicoes = {
    '@': ['a', 'o'],
    '$': ['s', 'a', 'z'],
    '&': ['e', 'a', ''],
    'ç': ['c'],
    'ã': ['a'],
    'õ': ['o'],
    'á': ['a'],
    'é': ['e'],
    'í': ['i'],
    'ó': ['o'],
    'ú': ['u'],
    'â': ['a'],
    'ê': ['e'],
    'ô': ['o'],
    'à': ['a'],
    'è': ['e'],
    'ì': ['i'],
    'ò': ['o'],
    'ù': ['u'],
    'ü': ['u'],
    'ñ': ['n'],
    'ä': ['a'],
    'ë': ['e'],
    'ï': ['i'],
    'ö': ['o'],
    'ÿ': ['y'],
    '0': ['o'],
    '1': ['i', 'l'],
    '2': ['z', 'r'],
    '3': ['e'],
    '4': ['a'],
    '5': ['s'],
    '6': ['g'],
    '7': ['t'],
    '8': ['b'],
    '9': ['g'],
    '+': ['t', ''],
    '-': ['', ' '],
    '_': ['', ' '],
    '=': ['', ' '],
    '*': ['', ' '],
    '#': ['', ' '],
    '%': ['', ' '],
    '!': ['i', ''],
    '?': ['', ' '],
    '.': ['', ' '],
    ',': ['', ' '],
    ';': ['', ' '],
    ':': ['', ' '],
    '/': ['', ' '],
    '\\': ['', ' '],
    '|': ['i', 'l', ''],
    '~': ['', ' '],
    '`': ['', ' '],
    '´': ['', ' '],
    '^': ['', ' '],
    '¨': ['', ' '],
    '(': ['', ' '],
    ')': ['', ' '],
    '[': ['', ' '],
    ']': ['', ' '],
    '{': ['', ' '],
    '}': ['', ' '],
    '<': ['', ' '],
    '>': ['', ' '],
    '"': ['', ' '],
    "'": ['', ' ']
};

// ================================================================
// FUNÇÃO 1: CARREGAR PALAVRAS DO JSON
// ================================================================

async function carregarPalavras() {
    try {
        console.log('📥 Carregando palavras.json...');
        const resposta = await fetch('palavras.json');
        
        if (!resposta.ok) {
            throw new Error(`Erro HTTP: ${resposta.status} - Arquivo palavras.json não encontrado`);
        }
        
        const dados = await resposta.json();
        console.log('📄 Dados recebidos:', dados);
        
        if (Array.isArray(dados)) {
            palavrasProibidas = dados;
        } else if (dados.palavrasProibidas && Array.isArray(dados.palavrasProibidas)) {
            palavrasProibidas = dados.palavrasProibidas;
        } else {
            throw new Error('Formato inválido do JSON. Deve ser um array de palavras.');
        }
        
        if (palavrasProibidas.length === 0) {
            throw new Error('Nenhuma palavra encontrada no JSON');
        }
        
        configCarregada = true;
        console.log('✅ Palavras carregadas do JSON:', palavrasProibidas.length);
        console.log('📝 Palavras:', palavrasProibidas);
        return palavrasProibidas;
    } catch (erro) {
        console.error('❌ Erro ao carregar palavras:', erro.message);
        console.error('⚠️ Verifique se o arquivo palavras.json existe e está no formato correto');
        palavrasProibidas = [];
        configCarregada = false;
        return [];
    }
}

// ================================================================
// FUNÇÃO 2: LIMPAR TEXTO (CONVERTE PARA MINÚSCULO)
// ================================================================

function limparTexto(texto) {
    if (!texto) return '';
    // Converte para minúsculo e remove tudo que não é letra
    return texto.toLowerCase().replace(/[^a-zA-ZÀ-ÿ]/g, '');
}

// ================================================================
// FUNÇÃO 3: GERAR VARIAÇÕES
// ================================================================

function gerarVariacoes(texto) {
    if (!texto || texto.length === 0) return [''];
    
    const resultados = new Set();
    const textoOriginal = texto.toLowerCase();
    
    const apenasLetras = limparTexto(textoOriginal);
    if (apenasLetras.length > 0) {
        resultados.add(apenasLetras);
    }
    
    const chars = textoOriginal.split('');
    const opcoesPorChar = chars.map(char => {
        const opcoes = substituicoes[char] || [char];
        const filtradas = opcoes.filter(opt => opt !== '');
        if (!filtradas.includes(char) && char !== '') {
            filtradas.push(char);
        }
        return filtradas.length > 0 ? filtradas : [char];
    });
    
    function combinar(indice, atual) {
        if (indice === opcoesPorChar.length) {
            const resultado = atual.join('');
            if (resultado.length > 0) {
                resultados.add(resultado);
            }
            return;
        }
        for (const opcao of opcoesPorChar[indice]) {
            combinar(indice + 1, [...atual, opcao]);
        }
    }
    
    combinar(0, []);
    
    const semRepetidos = textoOriginal.replace(/(.)\1+/g, '$1');
    if (semRepetidos !== textoOriginal) {
        const limpoRepetidos = limparTexto(semRepetidos);
        if (limpoRepetidos.length > 0) {
            resultados.add(limpoRepetidos);
        }
    }
    
    const letrasNaOrdem = textoOriginal.match(/[a-zA-ZÀ-ÿ]/g) || [];
    if (letrasNaOrdem.length > 0) {
        const ordemLetras = letrasNaOrdem.join('');
        if (ordemLetras.length > 0 && ordemLetras !== apenasLetras) {
            resultados.add(ordemLetras);
        }
    }
    
    return Array.from(resultados);
}

// ================================================================
// FUNÇÃO 4: VERIFICAR LETRAS ESPALHADAS
// ================================================================

function verificarLetrasEspalhadas(texto, palavra) {
    let indice = 0;
    for (const char of palavra) {
        const pos = texto.indexOf(char, indice);
        if (pos === -1) return false;
        indice = pos + 1;
    }
    return true;
}

// ================================================================
// FUNÇÃO 5: CALCULAR SIMILARIDADE
// ================================================================

function calcularSimilaridade(str1, str2) {
    if (str1.length === 0) return str2.length === 0 ? 1 : 0;
    if (str2.length === 0) return 0;
    
    const matriz = [];
    for (let i = 0; i <= str1.length; i++) {
        matriz[i] = [i];
    }
    for (let j = 0; j <= str2.length; j++) {
        matriz[0][j] = j;
    }
    
    for (let i = 1; i <= str1.length; i++) {
        for (let j = 1; j <= str2.length; j++) {
            const custo = str1[i-1] === str2[j-1] ? 0 : 1;
            matriz[i][j] = Math.min(
                matriz[i-1][j] + 1,
                matriz[i][j-1] + 1,
                matriz[i-1][j-1] + custo
            );
        }
    }
    
    const distancia = matriz[str1.length][str2.length];
    const maxLen = Math.max(str1.length, str2.length);
    return 1 - (distancia / maxLen);
}

// ================================================================
// FUNÇÃO 6: VERIFICAR PALAVRA PROIBIDA (CORRIGIDA)
// ================================================================

function verificarPalavraProibida(texto) {
    if (!texto || texto.length === 0) return null;
    if (!Array.isArray(palavrasProibidas) || palavrasProibidas.length === 0) {
        return null;
    }
    
    // Converte para minúsculo para comparação
    const textoLimpo = texto.toLowerCase().trim();
    
    for (const palavraProibida of palavrasProibidas) {
        if (!palavraProibida) continue;
        const pLower = palavraProibida.toLowerCase().trim();
        
        // 1: Palavra exata (compara minúsculo)
        if (textoLimpo === pLower) {
            console.log(`✅ Detectado: "${textoLimpo}" == "${pLower}"`);
            return palavraProibida;
        }
        
        // 2: Contém a palavra (case insensitive)
        if (textoLimpo.includes(pLower)) {
            console.log(`✅ Detectado: "${textoLimpo}" contém "${pLower}"`);
            return palavraProibida;
        }
        
        // 3: Sem caracteres especiais
        const semEspeciais = limparTexto(textoLimpo);
        if (semEspeciais === pLower) {
            console.log(`✅ Detectado: "${semEspeciais}" == "${pLower}"`);
            return palavraProibida;
        }
        if (semEspeciais.includes(pLower)) {
            console.log(`✅ Detectado: "${semEspeciais}" contém "${pLower}"`);
            return palavraProibida;
        }
        
        // 4: Letras espalhadas
        if (verificarLetrasEspalhadas(textoLimpo, pLower)) {
            console.log(`✅ Detectado: Letras espalhadas "${pLower}" em "${textoLimpo}"`);
            return palavraProibida;
        }
        
        // 5: Similaridade
        const similaridade = calcularSimilaridade(textoLimpo, pLower);
        if (similaridade > 0.75) {
            console.log(`✅ Detectado: Similaridade ${similaridade} entre "${textoLimpo}" e "${pLower}"`);
            return palavraProibida;
        }
    }
    
    return null;
}

// ================================================================
// FUNÇÃO 7: ENVIAR NOTIFICAÇÃO PARA ADMIN
// ================================================================

async function enviarNotificacaoAdmin(mensagem, userId, palavraDetectada) {
    try {
        const titulo = encodeURIComponent(`🚫 Mensagem Bloqueada - ${new Date().toLocaleString()}`);
        const mensagemNotificacao = encodeURIComponent(
            `Usuário: ${userId}\n` +
            `Mensagem: ${mensagem}\n` +
            `Palavra Detectada: ${palavraDetectada}\n` +
            `Data: ${new Date().toLocaleString()}`
        );
        
        const url = `${GOOGLE_SCRIPT_URL}?ids=${ADMIN_ID}&titulo=${titulo}&mensagem=${mensagemNotificacao}`;
        
        console.log('📤 Enviando notificação para ADMIN:', ADMIN_ID);
        
        const resposta = await fetch(url, {
            method: 'GET',
            mode: 'no-cors'
        });
        
        console.log('✅ Notificação enviada com sucesso!');
        return true;
    } catch (erro) {
        console.error('❌ Erro ao enviar notificação:', erro);
        return false;
    }
}

// ================================================================
// FUNÇÃO 8: SALVAR NO FIREBASE (SÓ BLOQUEADOS)
// ================================================================

async function salvarModeracaoFirebase(dados) {
    if (!dados.bloqueado) {
        console.log('⏭️ Mensagem aprovada, não salva no Firebase');
        return null;
    }
    
    try {
        const resposta = await fetch(`${FIREBASE_URL}/moderacoes.json`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(dados)
        });
        
        if (!resposta.ok) {
            throw new Error(`Erro HTTP: ${resposta.status}`);
        }
        
        const resultado = await resposta.json();
        console.log('✅ Dados salvos no Firebase (bloqueado)');
        return resultado;
    } catch (erro) {
        console.error('❌ Erro ao salvar no Firebase:', erro);
        return null;
    }
}

// ================================================================
// FUNÇÃO 9: MODERAR MENSAGEM
// ================================================================

function moderarMensagem(mensagem, userId) {
    // Validação
    if (!mensagem || mensagem.trim().length === 0) {
        return {
            bloqueado: false,
            usuarioId: userId || 'desconhecido',
            mensagemOriginal: mensagem || '',
            erro: 'Mensagem vazia',
            timestamp: new Date().toISOString()
        };
    }
    
    if (!userId || userId.trim().length === 0) {
        return {
            bloqueado: false,
            usuarioId: 'desconhecido',
            mensagemOriginal: mensagem,
            erro: 'ID do usuário não fornecido',
            timestamp: new Date().toISOString()
        };
    }
    
    if (!Array.isArray(palavrasProibidas) || palavrasProibidas.length === 0) {
        return {
            bloqueado: false,
            usuarioId: userId,
            mensagemOriginal: mensagem,
            erro: 'Nenhuma palavra proibida carregada do JSON',
            timestamp: new Date().toISOString()
        };
    }
    
    console.log('🔍 Moderando mensagem:', mensagem);
    console.log('📝 Palavras disponíveis:', palavrasProibidas);
    
    // ESTRATÉGIA 1: Verificar a mensagem inteira
    const palavraDetectada = verificarPalavraProibida(mensagem);
    if (palavraDetectada) {
        return {
            bloqueado: true,
            usuarioId: userId,
            mensagemOriginal: mensagem,
            palavraDetectada: palavraDetectada,
            metodo: 'mensagem_completa',
            timestamp: new Date().toISOString()
        };
    }
    
    // ESTRATÉGIA 2: Verificar palavra por palavra
    const palavrasChave = mensagem.split(/\s+/).filter(p => p.length > 0);
    for (const palavra of palavrasChave) {
        const proibida = verificarPalavraProibida(palavra);
        if (proibida) {
            return {
                bloqueado: true,
                usuarioId: userId,
                mensagemOriginal: mensagem,
                palavraDetectada: proibida,
                metodo: 'palavra_chave',
                timestamp: new Date().toISOString()
            };
        }
    }
    
    // ESTRATÉGIA 3: Variações
    const variacoes = gerarVariacoes(mensagem);
    for (const variacao of variacoes) {
        const proibida = verificarPalavraProibida(variacao);
        if (proibida) {
            return {
                bloqueado: true,
                usuarioId: userId,
                mensagemOriginal: mensagem,
                palavraDetectada: proibida,
                metodo: 'variacao',
                variacaoEncontrada: variacao,
                timestamp: new Date().toISOString()
            };
        }
    }
    
    // APROVADO
    return {
        bloqueado: false,
        usuarioId: userId,
        mensagemOriginal: mensagem,
        timestamp: new Date().toISOString()
    };
}

// ================================================================
// FUNÇÃO 10: PROCESSAR MENSAGEM COMPLETA
// ================================================================

async function processarMensagem(mensagem, userId) {
    if (!configCarregada) {
        await carregarPalavras();
    }
    
    const resultado = moderarMensagem(mensagem, userId);
    
    if (resultado.bloqueado) {
        console.log('🚫 Mensagem BLOQUEADA! Notificando admin...');
        await salvarModeracaoFirebase(resultado);
        await enviarNotificacaoAdmin(
            resultado.mensagemOriginal,
            resultado.usuarioId,
            resultado.palavraDetectada
        );
    } else {
        console.log('✅ Mensagem APROVADA (não salva, não notifica)');
    }
    
    return resultado;
}

// ================================================================
// FUNÇÃO 11: BUSCAR HISTÓRICO (SÓ BLOQUEADOS)
// ================================================================

async function buscarHistoricoFirebase() {
    try {
        const resposta = await fetch(`${FIREBASE_URL}/moderacoes.json`);
        if (!resposta.ok) {
            throw new Error(`Erro HTTP: ${resposta.status}`);
        }
        const dados = await resposta.json();
        return dados;
    } catch (erro) {
        console.error('❌ Erro ao buscar histórico:', erro);
        return null;
    }
}

// ================================================================
// FUNÇÃO 12: LISTAR PALAVRAS
// ================================================================

function listarPalavrasProibidas() {
    if (!Array.isArray(palavrasProibidas)) {
        return [];
    }
    return [...palavrasProibidas].sort();
}

// ================================================================
// FUNÇÃO 13: VERIFICAR SISTEMA
// ================================================================

function isConfigCarregada() {
    return configCarregada && Array.isArray(palavrasProibidas) && palavrasProibidas.length > 0;
}

// ================================================================
// EXPORTAÇÃO
// ================================================================

window.moderacao = {
    carregarPalavras,
    processarMensagem,
    moderarMensagem,
    salvarModeracaoFirebase,
    buscarHistoricoFirebase,
    listarPalavrasProibidas,
    isConfigCarregada,
    getPalavrasProibidas: () => {
        return Array.isArray(palavrasProibidas) ? [...palavrasProibidas] : [];
    },
    enviarNotificacaoAdmin,
    ADMIN_ID: ADMIN_ID
};

// ================================================================
// INICIALIZAÇÃO
// ================================================================

console.log('🛡️ Sistema de Moderação carregado!');
console.log(`👤 Admin ID: ${ADMIN_ID}`);
console.log('📝 As palavras são carregadas do palavras.json');

carregarPalavras().then(() => {
    if (configCarregada && palavrasProibidas.length > 0) {
        console.log('✅ Sistema pronto! Palavras carregadas:', palavrasProibidas.length);
    } else {
        console.error('❌ Falha ao carregar palavras! Verifique o arquivo palavras.json');
    }
});

setTimeout(() => {
    if (!configCarregada || palavrasProibidas.length === 0) {
        console.log('⏳ Tentando carregar palavras novamente...');
        carregarPalavras();
    }
}, 2000);