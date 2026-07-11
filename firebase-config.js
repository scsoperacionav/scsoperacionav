// firebase-config.js
// PASO OBLIGATORIO: reemplazá estos valores por los de TU proyecto de Firebase.
// Los encontrás en: Firebase Console > Configuración del proyecto > Tus apps > SDK setup and configuration.

const firebaseConfig = {
  apiKey: "TU_API_KEY",
  authDomain: "TU_PROYECTO.firebaseapp.com",
  projectId: "TU_PROYECTO",
  storageBucket: "TU_PROYECTO.appspot.com",
  messagingSenderId: "TU_SENDER_ID",
  appId: "TU_APP_ID",
};

// App principal: la que usa toda la aplicación normalmente
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// App secundaria: se usa SOLO para crear usuarios nuevos desde la pantalla de Admin.
// Truco necesario porque createUserWithEmailAndPassword() inicia sesión automáticamente
// con el usuario recién creado - si usáramos la app principal, el Admin perdería su propia sesión.
const secondaryApp = firebase.initializeApp(firebaseConfig, "Secondary");
const secondaryAuth = secondaryApp.auth();
