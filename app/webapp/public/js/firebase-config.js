/**
 * SwiftShip Global — Firebase Configuration
 * Live Firebase Auth + Firestore enabled
 */

// ============================================================
// REAL FIREBASE CONFIG — swiftship-d8b13
// ============================================================
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyD1axNCcJfLVxHdeWl3wVwF8oOcnjRLh88",
  authDomain: "swiftship-d8b13.firebaseapp.com",
  projectId: "swiftship-d8b13",
  storageBucket: "swiftship-d8b13.firebasestorage.app",
  messagingSenderId: "816731024466",
  appId: "1:816731024466:web:093ff5dba4d7b67d42438b",
  measurementId: "G-J5SZ0RDG8C"
};

// ============================================================
// MODE: true = real Firebase, false = localStorage demo
// ============================================================
const FIREBASE_ENABLED = true;

// ============================================================
// Firebase SDK (loaded via CDN in HTML files)
// ============================================================
let _app = null;
let _auth = null;
let _db = null;

function initFirebase() {
  if (_app) return { app: _app, auth: _auth, db: _db };
  try {
    _app  = firebase.initializeApp(FIREBASE_CONFIG);
    _auth = firebase.auth();
    _db   = firebase.firestore();
    console.log('[Firebase] Live mode — connected to swiftship-d8b13');
    return { app: _app, auth: _auth, db: _db };
  } catch (err) {
    console.error('[Firebase] Init error:', err);
    return null;
  }
}

// ============================================================
// AUTH HELPERS
// ============================================================
async function signIn(email, password) {
  if (!FIREBASE_ENABLED) return demoSignIn(email, password);
  const { auth } = initFirebase();
  return auth.signInWithEmailAndPassword(email, password);
}

async function signOut() {
  if (!FIREBASE_ENABLED) return demoSignOut();
  const { auth } = initFirebase();
  return auth.signOut();
}

async function sendPasswordReset(email) {
  if (!FIREBASE_ENABLED) throw new Error('Password reset requires live Firebase.');
  const { auth } = initFirebase();
  return auth.sendPasswordResetEmail(email);
}

function onAuthStateChanged(callback) {
  if (!FIREBASE_ENABLED) {
    const user = demoGetCurrentUser();
    setTimeout(() => callback(user), 50);
    return () => {};
  }
  const { auth } = initFirebase();
  return auth.onAuthStateChanged(callback);
}

function getCurrentUser() {
  if (!FIREBASE_ENABLED) return demoGetCurrentUser();
  const { auth } = initFirebase();
  return auth.currentUser;
}

// ============================================================
// DEMO AUTH (localStorage fallback)
// ============================================================
const DEMO_USER = { uid: 'demo-uid', email: 'admin@swiftshipglobal.com', displayName: 'Demo Admin' };

function demoSignIn(email, password) {
  if (email === 'admin@swiftshipglobal.com' && password === 'SwiftShip2026!') {
    localStorage.setItem('swiftship_demo_auth', JSON.stringify(DEMO_USER));
    return Promise.resolve({ user: DEMO_USER });
  }
  return Promise.reject({ code: 'auth/wrong-password', message: 'Invalid demo credentials.' });
}

function demoSignOut() {
  localStorage.removeItem('swiftship_demo_auth');
  return Promise.resolve();
}

function demoGetCurrentUser() {
  try {
    const data = localStorage.getItem('swiftship_demo_auth');
    return data ? JSON.parse(data) : null;
  } catch(e) { return null; }
}

// ============================================================
// FIRESTORE DATA HELPERS
// ============================================================

// --- Shipments ---
async function getShipmentByTrackingId(trackingId) {
  if (!FIREBASE_ENABLED) return null;
  try {
    const { db } = initFirebase();
    const snap = await db.collection('shipments').where('trackingId', '==', trackingId).limit(1).get();
    if (snap.empty) return null;
    const doc = snap.docs[0];
    return { id: doc.id, ...doc.data() };
  } catch(e) {
    console.warn('[Firebase] getShipmentByTrackingId error:', e.message);
    return null;
  }
}

async function createShipment(data) {
  if (!FIREBASE_ENABLED) return demoCreateDoc('shipments', data);
  const { db } = initFirebase();
  const trackingId = 'SWG-' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).substr(2,4).toUpperCase();
  const docData = { ...data, trackingId, createdAt: firebase.firestore.FieldValue.serverTimestamp(), updatedAt: firebase.firestore.FieldValue.serverTimestamp() };
  const ref = await db.collection('shipments').add(docData);
  return { id: ref.id, ...docData, trackingId };
}

async function getShipments(limitCount = 100) {
  if (!FIREBASE_ENABLED) return demoGetCollection('shipments');
  const { db } = initFirebase();
  const snap = await db.collection('shipments').orderBy('createdAt', 'desc').limit(limitCount).get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function updateShipment(id, data) {
  if (!FIREBASE_ENABLED) return demoUpdateDoc('shipments', id, data);
  const { db } = initFirebase();
  await db.collection('shipments').doc(id).update({ ...data, updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
  return { id, ...data };
}

async function deleteShipment(id) {
  if (!FIREBASE_ENABLED) return demoDeleteDoc('shipments', id);
  const { db } = initFirebase();
  await db.collection('shipments').doc(id).delete();
}

// --- Quote Requests ---
async function createQuoteRequest(data) {
  if (!FIREBASE_ENABLED) return demoCreateDoc('quotes', data);
  try {
    const { db } = initFirebase();
    const ref = await db.collection('quotes').add({
      ...data,
      status: 'new',
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    return { id: ref.id, ...data, status: 'new' };
  } catch(e) {
    console.warn('[Firebase] createQuoteRequest error:', e.message);
    return demoCreateDoc('quotes', data);
  }
}

async function getQuoteRequests(limitCount = 100) {
  if (!FIREBASE_ENABLED) return demoGetCollection('quotes');
  const { db } = initFirebase();
  const snap = await db.collection('quotes').orderBy('createdAt', 'desc').limit(limitCount).get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function updateQuoteStatus(id, status) {
  if (!FIREBASE_ENABLED) return demoUpdateDoc('quotes', id, { status });
  const { db } = initFirebase();
  await db.collection('quotes').doc(id).update({ status, updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
}

async function deleteQuoteRequest(id) {
  if (!FIREBASE_ENABLED) return demoDeleteDoc('quotes', id);
  const { db } = initFirebase();
  await db.collection('quotes').doc(id).delete();
}

// --- Contact Messages ---
async function createContactMessage(data) {
  if (!FIREBASE_ENABLED) return demoCreateDoc('contacts', data);
  try {
    const { db } = initFirebase();
    const ref = await db.collection('contacts').add({
      ...data,
      read: false,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    return { id: ref.id, ...data, read: false };
  } catch(e) {
    console.warn('[Firebase] createContactMessage error:', e.message);
    return demoCreateDoc('contacts', data);
  }
}

async function getContactMessages(limitCount = 100) {
  if (!FIREBASE_ENABLED) return demoGetCollection('contacts');
  const { db } = initFirebase();
  const snap = await db.collection('contacts').orderBy('createdAt', 'desc').limit(limitCount).get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function updateContactStatus(id, read) {
  if (!FIREBASE_ENABLED) return demoUpdateDoc('contacts', id, { read });
  const { db } = initFirebase();
  await db.collection('contacts').doc(id).update({ read, updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
}

async function deleteContactMessage(id) {
  if (!FIREBASE_ENABLED) return demoDeleteDoc('contacts', id);
  const { db } = initFirebase();
  await db.collection('contacts').doc(id).delete();
}

// ============================================================
// LIVE CHAT — Firestore helpers
// ============================================================
async function saveLiveChatMessage(sessionId, msg, userName, userEmail) {
  if (!FIREBASE_ENABLED) return;
  try {
    const { db } = initFirebase();
    await db.collection('live_chats').doc(sessionId).collection('messages').add({
      ...msg,
      sessionId,
      userName: userName || 'Visitor',
      userEmail: userEmail || '',
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    await db.collection('live_chats').doc(sessionId).set({
      sessionId,
      userName: userName || 'Visitor',
      userEmail: userEmail || '',
      lastMessage: msg.text,
      lastAt: firebase.firestore.FieldValue.serverTimestamp(),
      status: 'active'
    }, { merge: true });
  } catch(e) {
    console.warn('[Firebase] saveLiveChatMessage error:', e.message);
  }
}

async function getChatSessions(limitCount = 100) {
  if (!FIREBASE_ENABLED) return [];
  const { db } = initFirebase();
  const snap = await db.collection('live_chats').orderBy('lastAt', 'desc').limit(limitCount).get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function getChatMessages(sessionId, limitCount = 200) {
  if (!FIREBASE_ENABLED) return [];
  const { db } = initFirebase();
  const snap = await db.collection('live_chats').doc(sessionId)
    .collection('messages').orderBy('createdAt', 'asc').limit(limitCount).get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// ============================================================
// DEMO DATA HELPERS (localStorage fallback)
// ============================================================
function demoGetCollection(name) {
  try {
    const data = localStorage.getItem('swiftship_' + name);
    return data ? JSON.parse(data) : seedDemoData(name);
  } catch(e) { return []; }
}

function demoCreateDoc(collection, data) {
  const items = demoGetCollection(collection);
  const newItem = { id: 'demo-' + Date.now(), ...data, createdAt: new Date().toISOString() };
  if (collection === 'shipments') {
    newItem.trackingId = 'SWG-' + Date.now().toString(36).toUpperCase();
  }
  items.unshift(newItem);
  localStorage.setItem('swiftship_' + collection, JSON.stringify(items));
  return newItem;
}

function demoUpdateDoc(collection, id, data) {
  const items = demoGetCollection(collection);
  const idx = items.findIndex(i => i.id === id);
  if (idx !== -1) { items[idx] = { ...items[idx], ...data }; }
  localStorage.setItem('swiftship_' + collection, JSON.stringify(items));
  return items[idx];
}

function demoDeleteDoc(collection, id) {
  const items = demoGetCollection(collection).filter(i => i.id !== id);
  localStorage.setItem('swiftship_' + collection, JSON.stringify(items));
}

function seedDemoData(collection) {
  let data = [];
  if (collection === 'shipments') {
    data = [
      { id: 'demo-1', trackingId: 'SWG-DEMO001ABC', sender: 'ABC Corp', receiver: 'XYZ Ltd', origin: 'New York, USA', destination: 'London, UK', mode: 'Sea Freight', status: 'In Transit', weight: '500 kg', eta: '2026-05-01', createdAt: new Date().toISOString() },
      { id: 'demo-2', trackingId: 'SWG-DEMO002XYZ', sender: 'Tech Inc', receiver: 'EU Imports', origin: 'Shanghai, China', destination: 'Frankfurt, Germany', mode: 'Air Freight', status: 'Customs Clearance', weight: '120 kg', eta: '2026-04-20', createdAt: new Date().toISOString() },
      { id: 'demo-3', trackingId: 'SWG-DEMO003DEL', sender: 'Global Goods', receiver: 'Home Depot', origin: 'Dubai, UAE', destination: 'Toronto, Canada', mode: 'Sea Freight', status: 'Delivered', weight: '1200 kg', eta: '2026-04-10', createdAt: new Date().toISOString() },
    ];
  } else if (collection === 'quotes') {
    data = [{ id: 'demo-q1', name: 'John Smith', company: 'Acme Corp', email: 'john@acme.com', origin: 'Los Angeles', destination: 'Tokyo', mode: 'Air', cargoType: 'Electronics', status: 'new', createdAt: new Date().toISOString() }];
  } else if (collection === 'contacts') {
    data = [{ id: 'demo-c1', name: 'Mary Johnson', email: 'mary@example.com', subject: 'General Inquiry', message: 'Can you provide rates for sea freight?', read: false, createdAt: new Date().toISOString() }];
  }
  localStorage.setItem('swiftship_' + collection, JSON.stringify(data));
  return data;
}

// ============================================================
// AUTO-INIT on load
// ============================================================
if (FIREBASE_ENABLED) {
  initFirebase();
}
