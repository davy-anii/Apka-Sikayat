"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminMessaging = exports.adminAuth = exports.adminDb = exports.isFirebaseAdminInitialized = void 0;
const admin = __importStar(require("firebase-admin"));
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
dotenv_1.default.config({ path: path_1.default.join(__dirname, '../frontend/.env') });
const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'apka-sikayat';
let isFirebaseAdminInitialized = false;
exports.isFirebaseAdminInitialized = isFirebaseAdminInitialized;
let adminDb = null;
exports.adminDb = adminDb;
let adminAuth = null;
exports.adminAuth = adminAuth;
let adminMessaging = null;
exports.adminMessaging = adminMessaging;
try {
    if (admin.apps.length === 0) {
        // If a service account env exists, use it
        if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
            const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount),
                projectId: projectId
            });
            console.log("[Firebase Admin] Initialized with Service Account JSON");
        }
        else {
            // Initialize with basic Project ID config (works for Firestore local emulation and simple credentials)
            admin.initializeApp({
                projectId: projectId
            });
            console.log(`[Firebase Admin] Initialized with Project ID: ${projectId}`);
        }
    }
    exports.adminDb = adminDb = admin.firestore();
    exports.adminAuth = adminAuth = admin.auth();
    exports.adminMessaging = adminMessaging = admin.messaging();
    exports.isFirebaseAdminInitialized = isFirebaseAdminInitialized = true;
}
catch (error) {
    console.warn("[Firebase Admin] Warning: Failed to initialize Firebase Admin SDK. Services will fall back to simulation mode.", error.message);
}
exports.default = admin;
