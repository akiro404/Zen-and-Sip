// ─── firebase.js — Firebase init, exposes globals for all other modules
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getFirestore, collection, doc,
  getDocs, getDoc, addDoc, setDoc, updateDoc, deleteDoc,
  onSnapshot, query, where, orderBy, serverTimestamp, writeBatch, runTransaction
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import {
  getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged,
  reauthenticateWithCredential, EmailAuthProvider, updatePassword
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyCn6c_5YOl02mJoDE1M2-UP6ezGPVby2ew",
  authDomain: "recsu-business.firebaseapp.com",
  projectId: "recsu-business",
  storageBucket: "recsu-business.firebasestorage.app",
  messagingSenderId: "514460440924",
  appId: "1:514460440924:web:543c88e8330c2b0940c999",
  measurementId: "G-1ZFJBDG0T5"
};

const app  = initializeApp(firebaseConfig);
const db   = getFirestore(app);
const auth = getAuth(app);

// ─── Expose everything on window so plain scripts can access them ─────────────
window.db   = db;
window.auth = auth;
window.collection         = collection;
window.doc                = doc;
window.getDocs            = getDocs;
window.getDoc             = getDoc;
window.addDoc             = addDoc;
window.setDoc             = setDoc;
window.updateDoc          = updateDoc;
window.deleteDoc          = deleteDoc;
window.onSnapshot         = onSnapshot;
window.query              = query;
window.where              = where;
window.orderBy            = orderBy;
window.serverTimestamp    = serverTimestamp;
window.writeBatch          = writeBatch;
window.runTransaction      = runTransaction;
window.signInWithEmailAndPassword  = signInWithEmailAndPassword;
window.signOut                     = signOut;
window.onAuthStateChanged          = onAuthStateChanged;
window.reauthenticateWithCredential= reauthenticateWithCredential;
window.EmailAuthProvider           = EmailAuthProvider;
window.updatePassword              = updatePassword;

console.log('Firebase ready ✓');
