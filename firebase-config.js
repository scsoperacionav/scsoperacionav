const firebaseConfig = {
  apiKey: "AIzaSyBRBfUUy8kAqolRFzZ4T7P6iJZxT2swid8",
  authDomain: "scsoperacionav-b286e.firebaseapp.com",
  projectId: "scsoperacionav-b286e",
  storageBucket: "scsoperacionav-b286e.firebasestorage.app",
  messagingSenderId: "1088454703925",
  appId: "1:1088454703925:web:39d614e8164cbc681eaa7c",
  measurementId: "G-RLZLV50T7H"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

const secondaryApp = firebase.initializeApp(firebaseConfig, "Secondary");
const secondaryAuth = secondaryApp.auth();
