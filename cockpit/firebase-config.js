// Configuration publique de l’application Web Firebase.
// Cette configuration identifie l’application; elle ne donne aucun droit sans
// l’authentification Firebase et les règles Firestore / Storage publiées.
// Les règles Firestore et Storage constituent la barrière réelle. Les photos
// ajoutées depuis le cockpit sont converties localement en JPEG 4:5 sous 1 Mo
// avant leur envoi vers Firebase Storage.
globalThis.COCKPIT_FIREBASE_CONFIG = {
  apiKey: "AIzaSyBRFLnZ5Yxa5stJwX6Ku0dLWgEX0FihC0E",
  authDomain: "bleu-massawippi-cockpit-5d860.firebaseapp.com",
  projectId: "bleu-massawippi-cockpit-5d860",
  storageBucket: "bleu-massawippi-cockpit-5d860.firebasestorage.app",
  messagingSenderId: "388527537798",
  appId: "1:388527537798:web:7cbe5d8ebddefa6351db07"
};
