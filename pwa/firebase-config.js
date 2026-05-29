const firebaseConfig = {
  apiKey: "AIzaSyDNVvESJVu1BQVr90qOevBsPwcpMU_Gmjc",
  authDomain: "accounting-book-8e7e8.firebaseapp.com",
  projectId: "accounting-book-8e7e8",
  storageBucket: "accounting-book-8e7e8.firebasestorage.app",
  messagingSenderId: "321232354529",
  appId: "1:321232354529:web:8f5c60140633801d9a0ba0"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
const googleProvider = new firebase.auth.GoogleAuthProvider();
