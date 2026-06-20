import * as admin from 'firebase-admin';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../frontend/.env') });

const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'apka-sikayat';

let isFirebaseAdminInitialized = false;
let adminDb: admin.firestore.Firestore | null = null;
let adminAuth: admin.auth.Auth | null = null;
let adminMessaging: admin.messaging.Messaging | null = null;

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
    } else {
      // Initialize with basic Project ID config (works for Firestore local emulation and simple credentials)
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
} catch (error: any) {
  console.warn("[Firebase Admin] Warning: Failed to initialize Firebase Admin SDK. Services will fall back to simulation mode.", error.message);
}

export { isFirebaseAdminInitialized, adminDb, adminAuth, adminMessaging };
export default admin;
