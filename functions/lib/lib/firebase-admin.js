"use strict";
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
exports.serverTimestamp = exports.timestampToISOString = exports.adminDb = void 0;
const app_1 = require("firebase-admin/app");
const firestore_1 = require("firebase-admin/firestore");
// Initialize Firebase Admin SDK
if (!(0, app_1.getApps)().length) {
    const privateKey = (_a = process.env.FIREBASE_PRIVATE_KEY) === null || _a === void 0 ? void 0 : _a.replace(/\\n/g, '\n');
    if (!process.env.FIREBASE_PROJECT_ID || !privateKey || !process.env.FIREBASE_CLIENT_EMAIL) {
        throw new Error('Missing Firebase Admin SDK configuration');
    }
    (0, app_1.initializeApp)({
        credential: (0, app_1.cert)({
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: privateKey,
        }),
        projectId: process.env.FIREBASE_PROJECT_ID,
    });
}
// Get Firestore instance
exports.adminDb = (0, firestore_1.getFirestore)();
// Helper function to convert Firestore timestamp to ISO string
function timestampToISOString(timestamp) {
    if (timestamp && typeof timestamp.toDate === 'function') {
        return timestamp.toDate().toISOString();
    }
    if (timestamp instanceof Date) {
        return timestamp.toISOString();
    }
    return new Date().toISOString();
}
exports.timestampToISOString = timestampToISOString;
// Helper function to create server timestamp
function serverTimestamp() {
    return new Date();
}
exports.serverTimestamp = serverTimestamp;
//# sourceMappingURL=firebase-admin.js.map