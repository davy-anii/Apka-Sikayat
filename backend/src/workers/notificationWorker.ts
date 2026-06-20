import dotenv from 'dotenv';
import path from 'path';
import { initQueueService, NotificationJobData } from '../services/queueService';
import { sendSMS } from '../services/smsService';
import { sendPushNotification } from '../services/fcmService';
import { isFirebaseAdminInitialized, adminDb } from '../config/firebaseAdmin';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../frontend/.env') });

const PORT = process.env.PORT || 5002;
const BROADCAST_URL = `http://localhost:${PORT}/api/internal/broadcast`;

// Map status to FCM notification templates
function getFCMTemplate(status: string, id: string, extra: { department?: string; officer?: string }): { title: string; body: string } {
  const { department = 'the department', officer = 'an officer' } = extra;

  switch (status) {
    case 'Submitted':
      return {
        title: 'Grievance Submitted',
        body: `Your complaint (ID: ${id}) has been successfully submitted and is under AI validation.`
      };
    case 'AI_Validated':
      return {
        title: 'AI Validation Approved',
        body: `AI has successfully validated and verified the authenticity of your grievance ${id}.`
      };
    case 'Assigned_Dept':
      return {
        title: 'Department Assigned',
        body: `Your grievance ${id} has been routed and assigned to ${department}.`
      };
    case 'Officer_Assigned':
      return {
        title: 'Officer Assigned',
        body: `A resolving officer has been assigned to handle your grievance ${id}.`
      };
    case 'Investigation_Started':
      return {
        title: 'Investigation In Progress',
        body: `The department has initiated investigation into grievance ${id}.`
      };
    case 'Inspection_Scheduled':
      return {
        title: 'Field Inspection Scheduled',
        body: `A field inspection has been scheduled for grievance ${id}.`
      };
    case 'Inspection_Completed':
      return {
        title: 'Field Inspection Completed',
        body: `The officer has completed the site inspection for grievance ${id}.`
      };
    case 'Action_In_Progress':
      return {
        title: 'Resolution Action Started',
        body: `Work is now active at the location for grievance ${id}.`
      };
    case 'Resolved':
      return {
        title: 'Grievance Marked Resolved',
        body: `The PWD/Municipality has marked grievance ${id} as resolved. Please verify.`
      };
    case 'Citizen_Verified':
      return {
        title: 'Grievance Verified',
        body: `You have successfully verified the resolution of grievance ${id}.`
      };
    case 'Closed':
      return {
        title: 'Grievance Closed',
        body: `Your grievance ${id} has been closed successfully. Thank you for your feedback.`
      };
    default:
      return {
        title: 'Grievance Update',
        body: `The status of your grievance ${id} has been updated to: ${status}.`
      };
  }
}

// Background Worker processing function
export async function processNotificationJob(jobData: NotificationJobData): Promise<void> {
  const {
    complaintId,
    status,
    notes,
    recipientUid,
    recipientPhone,
    category,
    department
  } = jobData;

  console.log(`[Worker] Started processing notification flow for complaint: ${complaintId}`);

  try {
    // 1. Send SMS notifications (for supported stages)
    if (recipientPhone) {
      try {
        await sendSMS(status, {
          id: complaintId,
          category,
          department,
          phoneNumber: recipientPhone
        });
      } catch (smsError: any) {
        console.error(`[Worker] SMS delivery failed:`, smsError.message);
      }
    }

    // 2. Send Mobile Push Notifications (FCM)
    try {
      const fcmTemplate = getFCMTemplate(status, complaintId, { department });
      await sendPushNotification(recipientUid, {
        title: fcmTemplate.title,
        body: fcmTemplate.body,
        data: {
          complaintId,
          status
        }
      });
    } catch (fcmError: any) {
      console.error(`[Worker] FCM push notification failed:`, fcmError.message);
    }

    // 3. Broadcast Real-Time updates to citizen dashboard via Socket.IO
    try {
      // Fetch latest complaint status and timeline from database to broadcast
      let currentStep = 1;
      let timeline: any[] = [];
      let trackingToken: string | null = null;
      
      if (isFirebaseAdminInitialized && adminDb) {
        const docSnap = await adminDb.collection('complaints').doc(complaintId).get();
        if (docSnap.exists) {
          const data = docSnap.data();
          currentStep = data?.currentStep || 1;
          timeline = data?.timeline || [];
          trackingToken = data?.trackingToken || null;
        }
      } else {
        // Fallback for simulation/in-memory
        const { STAGES } = require('../services/eventService');
        const stageIndex = STAGES.findIndex((s: any) => s.status === status);
        currentStep = stageIndex !== -1 ? stageIndex + 1 : 1;
        
        const fallbackDate = new Date().toLocaleDateString('en-IN', {
          day: '2-digit', month: 'short', year: 'numeric',
          hour: '2-digit', minute: '2-digit'
        });
        timeline = STAGES.map((s: any) => ({
          step: s.step,
          title: s.title,
          iconName: s.iconName,
          desc: s.desc,
          date: s.step <= currentStep ? fallbackDate : null
        }));
      }

      const response = await fetch(BROADCAST_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          complaintId,
          status,
          currentStep,
          timeline,
          notes,
          trackingToken
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[Worker] Broadcasting HTTP request failed: ${response.status} - ${errorText}`);
      } else {
        console.log(`[Worker] Successfully triggered real-time Socket.IO broadcast for ${complaintId}`);
      }
    } catch (broadcastError: any) {
      console.error(`[Worker] Broadcast trigger failed:`, broadcastError.message);
    }

    console.log(`[Worker] Finished processing notification flow for complaint: ${complaintId}`);
  } catch (error: any) {
    console.error(`[Worker] Critical error processing notification flow for ${complaintId}:`, error.message);
    throw error;
  }
}

// Support running the worker independently as a separate microservice process
async function runStandaloneWorker() {
  console.log('[Worker Standalone] Starting worker microservice...');
  try {
    const queue = await initQueueService();
    queue.processJobs(processNotificationJob);
    console.log('[Worker Standalone] Worker successfully initialized and listening for jobs.');
  } catch (error) {
    console.error('[Worker Standalone] Critical error initializing worker:', error);
    process.exit(1);
  }
}

// Detect if started directly from command line (e.g. ts-node worker.ts)
if (require.main === module) {
  runStandaloneWorker();
}
