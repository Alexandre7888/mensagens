// ================================================================
// MODERACAO.JS - SISTEMA DE MODERAÇÃO COMPLETO
// ================================================================

const FIREBASE_URL = 'https://html-785e3-default-rtdb.firebaseio.com';
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
        const resposta = await fetch('palavras.json');
        if (!resposta.ok) {
            throw new Error('Erro ao carregar palavras.json');
        }
        const dados = await resposta.json();
        
        if (Array.isArray(dados)) {
            palavrasProibidas = dados;
        } else if (dados.palavrasProibidas && Array.isArray(dados.palavrasProibidas)) {
            palavrasProibidas = dados.palavrasProibidas;
        } else {
            throw new Error('Formato inválido do JSON');
        }
        
        configCarregada = true;
        console.log('✅ Palavras carregadas do JSON:', palavrasProibidas.length);
        return palavrasProibidas;
    } catch (erro) {
        console.error('❌ Erro ao carregar palavras:', erro);
        palavrasProibidas = [];
        configCarregada = true;
        return [];
    }
}

// ================================================================
// FUNÇÃO 2: LIMPAR TEXTO
// ================================================================

function limparTexto(texto) {
    if (!texto) return '';
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
// FUNÇÃO 6: VERIFICAR FRASE COMPLETA
// ================================================================

function verificarFraseCompleta(texto) {
    if (!texto || texto.length === 0) return null;
    if (!Array.isArray(palavrasProibidas) || palavrasProibidas.length === 0) {
        return null;
    }
    
    const textoLimpo = texto.toLowerCase();
    
    for (const palavraProibida of palavrasProibidas) {
        if (!palavraProibida) continue;
        const pLower = palavraProibida.toLowerCase();
        
        if (textoLimpo.includes(pLower)) {
            return palavraProibida;
        }
        
        const semEspacos = textoLimpo.replace(/\s/g, '');
        const pSemEspacos = pLower.replace(/\s/g, '');
        if (semEspacos.includes(pSemEspacos)) {
            return palavraProibida;
        }
        
        const semEspeciais = limparTexto(textoLimpo);
        const pSemEspeciais = limparTexto(pLower);
        if (semEspeciais.includes(pSemEspeciais)) {
            return palavraProibida;
        }
    }
    
    return null;
}

// ================================================================
// FUNÇÃO 7: VERIFICAR SE CONTÉM PALAVRA PROIBIDA
// ================================================================

function contemPalavraProibida(texto) {
    if (!texto || texto.length === 0) return null;
    if (!Array.isArray(palavrasProibidas) || palavrasProibidas.length === 0) {
        return null;
    }
    
    const textoLimpo = texto.toLowerCase();
    
    for (const palavraProibida of palavrasProibidas) {
        if (!palavraProibida) continue;
        const pLower = palavraProibida.toLowerCase();
        
        if (textoLimpo.includes(pLower)) {
            return palavraProibida;
        }
        
        const semEspeciais = limparTexto(textoLimpo);
        if (semEspeciais.includes(pLower)) {
            return palavraProibida;
        }
        
        if (verificarLetrasEspalhadas(textoLimpo, pLower)) {
            return palavraProibida;
        }
        
        if (calcularSimilaridade(textoLimpo, pLower) > 0.75) {
            return palavraProibida;
        }
        
        const semNumeros = textoLimpo.replace(/[0-9]/g, '');
        if (semNumeros.includes(pLower)) {
            return palavraProibida;
        }
        
        const semRepetidos = textoLimpo.replace(/(.)\1+/g, '$1');
        if (semRepetidos.includes(pLower)) {
            return palavraProibida;
        }
    }
    
    return null;
}

// ================================================================
// FUNÇÃO 8: EXTRAIR PALAVRAS-CHAVE
// ================================================================

function extrairPalavrasChave(texto) {
    const limpo = texto.replace(/[^a-zA-ZÀ-ÿ\s]/g, ' ');
    const palavras = limpo.split(/\s+/).filter(p => p.length > 1);
    return palavras;
}

// ================================================================
// FUNÇÃO 9: MODERAR MENSAGEM
// ================================================================

function moderarMensagem(mensagem, userId) {
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
    
    // ESTRATÉGIA 0: Frase completa primeiro
    const fraseProibida = verificarFraseCompleta(mensagem);
    if (fraseProibida) {
        return {
            bloqueado: true,
            usuarioId: userId,
            mensagemOriginal: mensagem,
            palavraDetectada: fraseProibida,
            metodo: 'frase_completa',
            timestamp: new Date().toISOString()
        };
    }
    
    // ESTRATÉGIA 1: Palavra por palavra
    const palavrasChave = extrairPalavrasChave(mensagem);
    for (const palavra of palavrasChave) {
        const proibida = contemPalavraProibida(palavra);
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
    
    // ESTRATÉGIA 2: Variações
    const variacoes = gerarVariacoes(mensagem);
    for (const variacao of variacoes) {
        const proibida = contemPalavraProibida(variacao);
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
    
    // ESTRATÉGIA 3: Texto limpo
    const textoLimpo = limparTexto(mensagem);
    if (textoLimpo.length > 0) {
        const proibida = contemPalavraProibida(textoLimpo);
        if (proibida) {
            return {
                bloqueado: true,
                usuarioId: userId,
                mensagemOriginal: mensagem,
                palavraDetectada: proibida,
                metodo: 'texto_limpo',
                timestamp: new Date().toISOString()
            };
        }
    }
    
    // ESTRATÉGIA 4: Similaridade
    const textoSimilaridade = limparTexto(mensagem);
    for (const palavraProibida of palavrasProibidas) {
        if (calcularSimilaridade(textoSimilaridade, palavraProibida) > 0.8) {
            return {
                bloqueado: true,
                usuarioId: userId,
                mensagemOriginal: mensagem,
                palavraDetectada: palavraProibida,
                metodo: 'similaridade',
                timestamp: new Date().toISOString()
            };
        }
    }
    
    return {
        bloqueado: false,
        usuarioId: userId,
        mensagemOriginal: mensagem,
        timestamp: new Date().toISOString()
    };
}

// ================================================================
// FUNÇÃO 10: SALVAR NO FIREBASE
// ================================================================

async function salvarModeracaoFirebase(dados) {
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
        console.log('✅ Dados salvos no Firebase:', resultado);
        return resultado;
    } catch (erro) {
        console.error('❌ Erro ao salvar no Firebase:', erro);
        return null;
    }
}

// ================================================================
// FUNÇÃO 11: BUSCAR HISTÓRICO
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
// FUNÇÃO 12: PROCESSAR MENSAGEM
// ================================================================

async function processarMensagem(mensagem, userId) {
    if (!configCarregada) {
        await carregarPalavras();
    }
    
    const resultado = moderarMensagem(mensagem, userId);
    await salvarModeracaoFirebase(resultado);
    return resultado;
}

// ================================================================
// FUNÇÃO 13: LISTAR PALAVRAS
// ================================================================

function listarPalavrasProibidas() {
    if (!Array.isArray(palavrasProibidas)) {
        return [];
    }
    return [...palavrasProibidas].sort();
}

// ================================================================
// FUNÇÃO 14: VERIFICAR SISTEMA
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
    }
};

// ================================================================
// INICIALIZAÇÃO
// ================================================================

console.log('🛡️ Sistema de Moderação carregado!');

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        carregarPalavras();
    });
} else {
    carregarPalavras();
}