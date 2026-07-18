window.ALGORITHM_DB_PATH = 'users/';

window.getAlgorithmProfile = async (userId) => {
    try {
        if (!userId || !window.firebaseDB) return { interests: {}, interactionHistory: [] };
        
        const snapshot = await window.firebaseDB.ref(`${window.ALGORITHM_DB_PATH}${userId}/algorithmProfile`).once('value');
        if (snapshot.exists()) {
            return snapshot.val();
        }
        return { interests: {}, interactionHistory: [] };
    } catch (e) {
        console.error("Erro ao carregar perfil de algoritmo:", e);
        return { interests: {}, interactionHistory: [] };
    }
};

window.updateAlgorithmProfile = async (userId, type, tags, interactionScore) => {
    if (!userId || !tags || !tags.length || !window.firebaseDB) return;
    
    try {
        const profile = await window.getAlgorithmProfile(userId);
        let interests = profile.interests || {};
        
        tags.forEach(tag => {
            const cleanTag = tag.toLowerCase().replace('#', '');
            if (!interests[cleanTag]) {
                interests[cleanTag] = 0;
            }
            interests[cleanTag] += interactionScore;
        });
        
        await window.firebaseDB.ref(`${window.ALGORITHM_DB_PATH}${userId}/algorithmProfile/interests`).set(interests);
    } catch (error) {
        console.error("Erro ao atualizar perfil do algoritmo:", error);
    }
};

window.sortFeedByAlgorithm = async (userId, posts) => {
    try {
        const profile = await window.getAlgorithmProfile(userId);
        const interests = profile.interests || {};
        
        return posts.sort((a, b) => {
            let scoreA = 0;
            let scoreB = 0;
            
            // Prioriza vídeos mais curtidos
            const likesA = a.likesCount || 0;
            const likesB = b.likesCount || 0;
            
            scoreA += likesA * 2;
            scoreB += likesB * 2;
            
            // Pontua hashtags com base nos interesses
            if (a.hashtags) {
                a.hashtags.forEach(tag => {
                    const cleanTag = tag.toLowerCase().replace('#', '');
                    if (interests[cleanTag]) scoreA += interests[cleanTag];
                });
            }
            
            if (b.hashtags) {
                b.hashtags.forEach(tag => {
                    const cleanTag = tag.toLowerCase().replace('#', '');
                    if (interests[cleanTag]) scoreB += interests[cleanTag];
                });
            }
            
            // Fator temporal (desempate)
            const timeA = a.timestamp || 0;
            const timeB = b.timestamp || 0;
            
            if (timeA > timeB) scoreA += 0.5;
            else if (timeB > timeA) scoreB += 0.5;
            
            return scoreB - scoreA;
        });
    } catch (error) {
        console.error("Erro ao ordenar feed pelo algoritmo:", error);
        return posts.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    }
};

window.AlgorithmManager = {
    getRecommendedVideos: (userId, allVideoPosts) => {
        // Fallback sync se o async não tiver terminado
        return allVideoPosts;
    }
};