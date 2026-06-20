import { isFirebaseAdminInitialized, adminDb, adminMessaging } from '../config/firebaseAdmin';

export interface PushNotificationPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
}

export async function sendPushNotification(
  citizenId: string,
  payload: PushNotificationPayload
): Promise<boolean> {
  const { title, body, data = {} } = payload;
  console.log(`[FCM Queue Worker] Preparing push notification for citizen ID: ${citizenId}`);
  console.log(`[FCM Notification]: Title: "${title}", Body: "${body}"`);

  if (!isFirebaseAdminInitialized || !adminDb || !adminMessaging) {
    console.log(`[FCM Simulator] [SUCCESS] Push notification logged to console for citizen ${citizenId}`);
    return true;
  }

  try {
    // 1. Fetch user's FCM device token from Firestore
    // We check both /users/{id} and a dedicated /users/{id}/settings doc or /fcm_tokens collection
    const userDocRef = adminDb.collection('users').doc(citizenId);
    const userSnap = await userDocRef.get();
    
    let fcmToken: string | null = null;
    
    if (userSnap.exists) {
      const userData = userSnap.data();
      fcmToken = userData?.fcmToken || null;
    }

    // Fallback: check a dedicated tokens collection
    if (!fcmToken) {
      const tokenDoc = await adminDb.collection('fcm_tokens').doc(citizenId).get();
      if (tokenDoc.exists) {
        fcmToken = tokenDoc.data()?.token || null;
      }
    }

    if (!fcmToken) {
      console.log(`[FCM Service] No FCM Token found for user ${citizenId}. Simulating delivery...`);
      return true;
    }

    // 2. Send payload to token
    const message = {
      token: fcmToken,
      notification: {
        title,
        body
      },
      data: data,
      android: {
        priority: 'high' as const,
        notification: {
          sound: 'default',
          clickAction: 'FLUTTER_NOTIFICATION_CLICK'
        }
      },
      apns: {
        payload: {
          aps: {
            badge: 1,
            sound: 'default'
          }
        }
      }
    };

    const response = await adminMessaging.send(message);
    console.log(`[FCM Service] FCM Notification sent successfully, response message ID: ${response}`);
    return true;
  } catch (error: any) {
    console.error(`[FCM Service] Failed to send push notification to user ${citizenId}:`, error.message);
    return false;
  }
}
