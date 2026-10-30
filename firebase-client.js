const config = {
  apiKey: "AIzaSyBo0mZNnKd2bT1rXZJW03nw43Kv6kGeMOk",
  authDomain: "tribal-antler-3mn89.firebaseapp.com",
  projectId: "tribal-antler-3mn89",
  storageBucket: "tribal-antler-3mn89.firebasestorage.app",
  messagingSenderId: "830436017944",
  appId: "1:830436017944:web:222cbf37ded4bfc92cc06d",
  firestoreDatabaseId: "ai-studio-01751af4-8ee9-4b9b-8158-67aebfccb9a0"
};

let sdk = null;
let auth = null;
let db = null;
let storage = null;
let storageSdk = null;
let initError = null;

export const firebaseReady = (async () => {
  try {
    const base = "https://www.gstatic.com/firebasejs/11.9.1/";
    const [appSdk, authSdk, firestoreSdk, storageModule] = await Promise.all([
      import(`${base}firebase-app.js`),
      import(`${base}firebase-auth.js`),
      import(`${base}firebase-firestore.js`),
      import(`${base}firebase-storage.js`)
    ]);
    const app = appSdk.initializeApp(config);
    auth = authSdk.getAuth(app);
    db = firestoreSdk.getFirestore(app, config.firestoreDatabaseId);
    storage = storageModule.getStorage(app);
    storageSdk = storageModule;
    sdk = { ...authSdk, ...firestoreSdk, ...storageModule };
    return { enabled: true };
  } catch (error) {
    initError = error;
    console.warn("Firebase SDK could not be loaded. BrandLens will remain available in guest/local mode.", error);
    return { enabled: false, reason: error?.message || "Firebase SDK unavailable" };
  }
})();

export function firebaseStatus() { return { enabled: Boolean(auth && db), error: initError }; }
export function getAuthInstance() { return auth; }
export function getDbInstance() { return db; }
export function getStorageInstance() { return storage; }
export function getStorageSdk() { return storageSdk; }
export function getFirebaseSdk() { return sdk; }
export { config as firebasePublicConfig };
