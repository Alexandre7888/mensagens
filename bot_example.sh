#!/bin/bash

# ==============================================================================
# mensagensHUB - Exemplo de Bot em Shell Script (.sh)
# ==============================================================================
# Este script demonstra como conectar seu bot à API do Firebase Realtime Database
# usando o Token gerado no Portal de Desenvolvedores.
#
# Pré-requisitos: curl e jq (para processar JSON, se necessário)
# ==============================================================================

# Configurações do Bot
FIREBASE_URL="https://html-785e3-default-rtdb.firebaseio.com"
BOT_ID="COLOQUE_O_ID_DO_BOT_AQUI"        # Ex: bot_123456789_abcde
BOT_TOKEN_PLAIN="COLOQUE_O_TOKEN_AQUI"   # Ex: bot_XYZ123... (o token puro)
GROUP_ID="COLOQUE_O_ID_DO_GRUPO_AQUI"    # O ID do grupo para escutar

# 1. Função para verificar a autenticação do Bot (usando SHA-256)
verificar_autenticacao() {
    echo "Verificando autenticação do bot..."
    
    # Gera o hash SHA-256 local do token puro fornecido
    HASH_GERADO=$(echo -n "$BOT_TOKEN_PLAIN" | sha256sum | awk '{print $1}')
    
    # Busca os dados do bot no Firebase
    RESPOSTA=$(curl -s "${FIREBASE_URL}/users/${BOT_ID}.json")
    
    # Extrai o hash salvo no banco e o nome do bot
    HASH_SALVO=$(echo "$RESPOSTA" | grep -o '"botTokenHash":"[^"]*' | cut -d'"' -f4)
    NOME_BOT=$(echo "$RESPOSTA" | grep -o '"name":"[^"]*' | cut -d'"' -f4)

    if [ "$HASH_SALVO" == "$HASH_GERADO" ]; then
        echo "Autenticação bem-sucedida! Conectado como: $NOME_BOT"
        return 0
    else
        echo "Falha na autenticação. Verifique o BOT_ID e o BOT_TOKEN."
        return 1
    fi
}

# 2. Função para enviar uma mensagem para um grupo ou chat direto
enviar_mensagem() {
    local TEXTO="$1"
    local TIMESTAMP=$(date +%s%3N)
    
    echo "Enviando mensagem: '$TEXTO'"
    
    # Monta o JSON da mensagem
    JSON_MSG="{\"senderId\":\"${BOT_ID}\",\"senderName\":\"Bot\",\"type\":\"text\",\"text\":\"${TEXTO}\",\"timestamp\":${TIMESTAMP}}"
    
    # Envia para a rota de mensagens do grupo (se for grupo)
    # Se for chat direto, a rota seria chats/ID_DO_CHAT/messages
    ROTA="${FIREBASE_URL}/groups/${CHAT_ID}/messages.json"
    
    curl -s -X POST -H "Content-Type: application/json" -d "$JSON_MSG" "$ROTA" > /dev/null
    
    echo "Mensagem enviada com sucesso!"
}

# 3. Função para ler as últimas mensagens de um grupo
ler_mensagens() {
    echo "Lendo últimas mensagens..."
    ROTA="${FIREBASE_URL}/groups/${CHAT_ID}/messages.json?orderBy=\"timestamp\"&limitToLast=5"
    
    MENSAGENS=$(curl -s "$ROTA")
    echo "Mensagens recebidas:"
    echo "$MENSAGENS"
}

# ==============================================================================
# Execução Principal
# ==============================================================================

if verificar_autenticacao; then
    echo "----------------------------------------"
    # Exemplo: Enviar uma mensagem de saudação
    enviar_mensagem "Olá! Eu sou um bot funcionando via Shell Script! 🤖"
    
    # Exemplo: Ler as últimas mensagens
    ler_mensagens
else
    exit 1
fi