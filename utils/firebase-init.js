if (window.firebase) {
    firebase.initializeApp({
        databaseURL: "https://html-785e3-default-rtdb.firebaseio.com",
        projectId: "html-785e3"
    });
    window.firebaseDB = firebase.database();
    if (firebase.firestore) {
        window.firebaseFirestore = firebase.firestore();
    }
} else {
    console.error("Firebase SDK not loaded");
}