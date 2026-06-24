if (window.firebase) {
    firebase.initializeApp({
        databaseURL: "https://html-785e3-default-rtdb.firebaseio.com"
    });
    window.firebaseDB = firebase.database();
} else {
    console.error("Firebase SDK not loaded");
}