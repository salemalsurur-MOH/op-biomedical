// ============================================
// Firebase + Firestore sync for the dashboard
// Cross-device shared storage. Wraps localStorage save() so all
// existing render code keeps working.
// ============================================
//
// Strategy: store ONE document per data slice in collection "shared".
//   shared/files       { items: [...] }
//   shared/pins        { items: [...] }
//   shared/categories  { items: [...] }
// One real-time listener per doc keeps all devices in sync.

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-app.js";
import {
  getFirestore, doc, setDoc, onSnapshot, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCPG15glk74-RfBdMAmwBeYdXSV8T07LpE",
  authDomain: "op-biomedical.firebaseapp.com",
  projectId: "op-biomedical",
  storageBucket: "op-biomedical.firebasestorage.app",
  messagingSenderId: "870148328889",
  appId: "1:870148328889:web:37891f8eed5288a5a3ba68"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Tag every write with a clientId so our own writes don't trigger a UI re-render twice
const CLIENT_ID = Math.random().toString(36).slice(2, 10);

// State of the sync indicator pill in the topbar
let lastError = '';
function setStatus(state, label, errMsg) {
  const el = document.getElementById('sync-status');
  if (!el) return;
  el.dataset.state = state; // 'connecting' | 'live' | 'syncing' | 'offline'
  el.querySelector('.sync-label').textContent = label;
  if (state === 'offline' && errMsg) {
    lastError = errMsg;
    el.title = 'فشل الاتصال بقاعدة البيانات — اضغط للتفاصيل\n\n' + errMsg;
    el.style.cursor = 'pointer';
    el.onclick = () => {
      alert(
        'تعذر مزامنة البيانات بين الأجهزة.\n\n' +
        'الخطأ: ' + lastError + '\n\n' +
        'الحل: قواعد Firestore الأمنية تمنع الكتابة. افتح:\n' +
        'https://console.firebase.google.com/project/op-biomedical/firestore/rules\n\n' +
        'وضع القواعد التالية ثم اضغط Publish:\n\n' +
        'rules_version = "2";\n' +
        'service cloud.firestore {\n' +
        '  match /databases/{database}/documents {\n' +
        '    match /shared/{doc} {\n' +
        '      allow read, write: if true;\n' +
        '    }\n' +
        '  }\n' +
        '}'
      );
    };
  } else {
    el.title = 'حالة المزامنة بين الأجهزة';
    el.style.cursor = 'default';
    el.onclick = null;
  }
}

// Suppress next-snapshot echo of our own write (debounce per slice)
const ownWriteTokens = { files: 0, pins: 0, categories: 0, tasks: 0 };

// ---- public push ----
// Called by app-v2.js whenever the user changes data.
// We still keep localStorage as a fast cache + offline fallback,
// but we also fire-and-forget to Firestore.
window.firebaseSync = {
  ready: false,

  pushAll(state) {
    if (!this.ready) return;
    setStatus('syncing', 'جاري الحفظ…');
    const stamp = serverTimestamp();
    const meta = { client: CLIENT_ID, updatedAt: stamp };

    Promise.all([
      setDoc(doc(db, 'shared', 'files'),      { items: state.files,      ...meta }),
      setDoc(doc(db, 'shared', 'pins'),       { items: state.pins,       ...meta }),
      setDoc(doc(db, 'shared', 'categories'), { items: state.categories, ...meta }),
    ])
    .then(() => setStatus('live', 'متزامن'))
    .catch(err => {
      console.error('Firestore push failed:', err);
      setStatus('offline', 'غير متصل', err && err.message ? err.message : String(err));
    });

    ownWriteTokens.files++;
    ownWriteTokens.pins++;
    ownWriteTokens.categories++;
  },

  pushTasks(tasks) {
    if (!this.ready) return;
    setStatus('syncing', 'جاري الحفظ…');
    setDoc(doc(db, 'shared', 'tasks'), {
      items: tasks, client: CLIENT_ID, updatedAt: serverTimestamp()
    })
    .then(() => setStatus('live', 'متزامن'))
    .catch(err => {
      console.error('Firestore tasks push failed:', err);
      setStatus('offline', 'غير متصل', err && err.message ? err.message : String(err));
    });
    ownWriteTokens.tasks++;
  },
};

// ---- real-time listeners ----
// First snapshot = initial load (may have items, OR doc may not exist yet).
// Subsequent snapshots = remote changes from other devices (skip own echoes).
function listen(slice, onFirst, onRemote) {
  let firstFired = false;
  return onSnapshot(doc(db, 'shared', slice), snap => {
    const data = snap.exists() ? snap.data() : null;
    // First snapshot — let bootstrap decide whether to seed
    if (!firstFired) {
      firstFired = true;
      const items = data && Array.isArray(data.items) ? data.items : null;
      onFirst(items); // null = doc missing
      return;
    }
    if (!data) return;
    // Skip our own write echo
    if (data.client === CLIENT_ID && ownWriteTokens[slice] > 0) {
      ownWriteTokens[slice]--;
      return;
    }
    if (Array.isArray(data.items)) onRemote(data.items);
  }, err => {
    console.error(`Firestore listener (${slice}) failed:`, err);
    setStatus('offline', 'غير متصل', err && err.message ? err.message : String(err));
  });
}

// ---- bootstrap ----
// Wait for app-v2.js to expose its hooks, then start listening.
function boot() {
  if (!window.appHooks || !window.assistantHooks) { setTimeout(boot, 50); return; }

  setStatus('connecting', 'جاري الاتصال…');

  let needSeed = { files: false, pins: false, categories: false, tasks: false };
  let firstCount = 0;

  function onAnyFirst() {
    firstCount++;
    if (firstCount < 4) return;
    // All three first-snapshots received. Mark ready so future saves push.
    window.firebaseSync.ready = true;
    setStatus('live', 'متزامن');
    // If any slice was missing/empty in cloud, push local seed up so other
    // devices have something to load.
    if (needSeed.files || needSeed.pins || needSeed.categories) {
      window.firebaseSync.pushAll(window.appHooks.getState());
    }
    if (needSeed.tasks && window.assistantHooks) {
      window.firebaseSync.pushTasks(window.assistantHooks.getTasks());
    }
  }

  listen('files',
    items => {
      // First snapshot: items=null means doc missing, [] means empty doc
      if (items === null || items.length === 0) {
        if (window.appHooks.getFiles().length > 0) needSeed.files = true;
      } else {
        window.appHooks.setFiles(items);
      }
      onAnyFirst();
    },
    items => window.appHooks.setFiles(items)
  );

  listen('pins',
    items => {
      if (items === null) {
        if (window.appHooks.getPins().length > 0) needSeed.pins = true;
      } else {
        window.appHooks.setPins(items);
      }
      onAnyFirst();
    },
    items => window.appHooks.setPins(items)
  );

  listen('categories',
    items => {
      if (items === null || items.length === 0) {
        if (window.appHooks.getCategories().length > 0) needSeed.categories = true;
      } else {
        window.appHooks.setCategories(items);
      }
      onAnyFirst();
    },
    items => window.appHooks.setCategories(items)
  );

  listen('tasks',
    items => {
      const local = window.assistantHooks.getTasks();
      if (items === null || items.length === 0) {
        if (local.length > 0) needSeed.tasks = true;
      } else {
        window.assistantHooks.setTasks(items);
      }
      onAnyFirst();
    },
    items => window.assistantHooks.setTasks(items)
  );

  // Fallback: if Firebase never responds within 4s (offline / blocked),
  // still mark ready so user changes get retried later.
  setTimeout(() => {
    if (!window.firebaseSync.ready) {
      window.firebaseSync.ready = true;
      console.warn('Firestore initial snapshot timed out — ready anyway');
    }
  }, 4000);
}

// Online/offline listeners give immediate feedback in the indicator
window.addEventListener('online',  () => setStatus('live', 'متزامن'));
window.addEventListener('offline', () => setStatus('offline', 'غير متصل'));

boot();
