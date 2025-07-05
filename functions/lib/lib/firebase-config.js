"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.analytics = exports.storage = exports.db = void 0;
const app_1 = require("firebase/app");
const firestore_1 = require("firebase/firestore");
const storage_1 = require("firebase/storage");
const analytics_1 = require("firebase/analytics");
const firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};
// Initialize Firebase
const app = (0, app_1.initializeApp)(firebaseConfig);
// Initialize Firestore
exports.db = (0, firestore_1.getFirestore)(app);
// Initialize Storage
exports.storage = (0, storage_1.getStorage)(app);
// Initialize Analytics (client-side only)
exports.analytics = null;
if (typeof window !== 'undefined') {
    (0, analytics_1.isSupported)().then((supported) => {
        if (supported) {
            exports.analytics = (0, analytics_1.getAnalytics)(app);
        }
    });
}
// Connect to emulators in development
if (process.env.NODE_ENV === 'development' && typeof window !== 'undefined') {
    // Only connect once
    try {
        (0, firestore_1.connectFirestoreEmulator)(exports.db, 'localhost', 8080);
        (0, storage_1.connectStorageEmulator)(exports.storage, 'localhost', 9199);
    }
    catch (error) {
        // Already connected
    }
}
exports.default = app;
//# sourceMappingURL=firebase-config.js.map