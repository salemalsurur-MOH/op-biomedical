// ============================================
// Firebase Configuration
// لوحة الصيانة الطبية - نظام البيانات
// ============================================

const firebaseConfig = {
  apiKey: "AIzaSyCPG15glk74-RfBdMAmwBeYdXSV8T07LpE",
  authDomain: "op-biomedical.firebaseapp.com",
  projectId: "op-biomedical",
  storageBucket: "op-biomedical.appspot.com",
  messagingSenderId: "870148328889",
  appId: "1:870148328889:web:3789ff8eed5288a53ba68"
};

// Declare globally
let db, storage;

// Initialize Firebase
try {
  firebase.initializeApp(firebaseConfig);
  db = firebase.firestore();
  storage = firebase.storage();

  console.log('✅ Firebase initialized successfully');
  console.log('🔥 Firestore Database:', db);
  console.log('📦 Storage:', storage);
} catch (error) {
  console.error('❌ Firebase initialization error:', error);
  alert('خطأ في تهيئة Firebase: ' + error.message);
}
