if (window.firebase) {
    // Ofuscação básica para dificultar a extração da URL por bots e curiosos.
    // Lembre-se: a verdadeira segurança deve ser feita nas Regras do Firebase (Firebase Rules).
    const decodeConfig = (str) => {
        try {
            return atob(str);
        } catch (e) {
            return str;
        }
    };

    firebase.initializeApp({
        databaseURL: decodeConfig("aHR0cHM6Ly9odG1sLTc4NWUzLWRlZmF1bHQtcnRkYi5maXJlYmFzZWlvLmNvbQ=="),
        projectId: decodeConfig("aHRtbC03ODVlMw==")
    });
    window.firebaseDB = firebase.database();
    if (firebase.firestore) {
        window.firebaseFirestore = firebase.firestore();
    }
} else {
    console.error("Firebase SDK not loaded");
}
