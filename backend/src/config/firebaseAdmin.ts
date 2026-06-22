import * as admin from 'firebase-admin';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

let envPath = path.join(__dirname, '../../frontend/.env');
if (!fs.existsSync(envPath)) {
  envPath = path.join(__dirname, '../../../frontend/.env');
}
dotenv.config({ path: envPath });

const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'apka-sikayat';

let isFirebaseAdminInitialized = false;
let adminDb: admin.firestore.Firestore | null = null;
let adminAuth: admin.auth.Auth | null = null;
let adminMessaging: admin.messaging.Messaging | null = null;

try {
  const hasCredentials = !!(process.env.FIREBASE_SERVICE_ACCOUNT_JSON || process.env.FIRESTORE_EMULATOR_HOST);

  if (hasCredentials) {
    if (admin.apps.length === 0) {
      if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
          projectId: projectId
        });
        console.log("[Firebase Admin] Initialized with Service Account JSON");
      } else {
        admin.initializeApp({
          projectId: projectId
        });
        console.log(`[Firebase Admin] Initialized with Project ID: ${projectId}`);
      }
    }
    adminDb = admin.firestore();
    adminAuth = admin.auth();
    adminMessaging = admin.messaging();
    isFirebaseAdminInitialized = true;
    console.log("[Firebase Admin] Live Firestore database connected.");
  } else {
    isFirebaseAdminInitialized = false;
    adminDb = null;
    adminAuth = null;
    adminMessaging = null;
    console.log("[Firebase Admin] Bypassed initialization (no service account JSON). Running server purely local.");
  }
} catch (error: any) {
  isFirebaseAdminInitialized = false;
  adminDb = null;
  adminAuth = null;
  adminMessaging = null;
  console.warn("[Firebase Admin] Warning: Failed to initialize Firebase Admin SDK. Services will fall back to simulation mode.", error.message);
}

export { isFirebaseAdminInitialized, adminDb, adminAuth, adminMessaging };
export default admin;
