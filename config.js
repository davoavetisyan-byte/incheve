/* ===== Incheve — Firebase settings =====
   1) Paste here the firebaseConfig from Firebase Console → Project settings → Your apps → Web app.
   2) adminEmails: accounts that see costs, reports, settings (owner / manager).
      Every other signed-in account (e.g. the bar tablet) works as staff. */
window.INCHEVE_FIREBASE = {
  config: {
    apiKey: "AIzaSyBHT7bNzK_8JEfXBvZFvUk_mzDlHTFk1x4",
    authDomain: "incheve-managment.firebaseapp.com",
    projectId: "incheve-managment",
    storageBucket: "incheve-managment.firebasestorage.app",
    messagingSenderId: "709811792688",
    appId: "1:709811792688:web:68d40da3a201e2e3f6f6f5"
  },
  // Home-screen app (iPhone "Add to Home Screen") signs in through incheve.netlify.app/__/auth (proxied to Firebase).
  // Needs once: Google Cloud → APIs & Services → Credentials → "Web client (auto created by Google Service)" →
  // Authorized redirect URIs → add https://incheve.netlify.app/__/auth/handler
  // authProxy: true → use the same for every browser too (optional).
  adminEmails: ["inchevewinebar@gmail.com", "davoavetisyan@gmail.com", "davit.avetisian@gmail.com", "christinasoloyan@gmail.com", "gohar.daniele@gmail.com"]
};
