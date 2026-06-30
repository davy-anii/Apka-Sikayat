import { Request, Response } from 'express';
import { db } from '../../firebase';
import { doc, getDoc, updateDoc, collection, query, where, getDocs, addDoc } from 'firebase/firestore';

// Socket instance reference
let ioInstance: any = null;
export function setIoInstance(io: any) {
  ioInstance = io;
}

export async function handleVapiWebhook(req: Request, res: Response) {
  const body = req.body;
  const message = body.message;

  if (!message) {
    return res.status(200).json({ status: "ignored" });
  }

  console.log(`[VAPI Webhook] Received message type: ${message.type}`);

  // 1. Handle Tool Calls
  if (message.type === 'tool-calls' || message.type === 'function-call') {
    const toolCalls = message.toolCalls || [];
    const results: any[] = [];

    for (const tool of toolCalls) {
      const name = tool.function?.name;
      const args = tool.function?.arguments || {};
      const callId = tool.id;

      console.log(`[VAPI Webhook] Tool call detected: ${name} (Args: ${JSON.stringify(args)})`);

      let resultString = "";

      try {
        if (name === 'getComplaintStatus') {
          resultString = await executeGetComplaintStatus(args.complaintId);
        } else if (name === 'addComplaintNote') {
          resultString = await executeAddComplaintNote(args.complaintId, args.noteText);
        } else if (name === 'requestOfficerCallback') {
          resultString = await executeRequestOfficerCallback(args.complaintId, args.timePreference);
        } else if (name === 'reportEmergency') {
          resultString = await executeReportEmergency(args.complaintId, args.emergencyType);
        } else {
          resultString = `Tool ${name} is not recognized.`;
        }
      } catch (err: any) {
        resultString = `Error executing tool ${name}: ${err.message}`;
      }

      results.push({
        toolCallId: callId,
        result: resultString
      });
    }

    return res.status(200).json({ results });
  }

  // 2. Handle Status Update Lifecycle Events
  if (message.type === 'status-update') {
    const status = message.status;
    console.log(`[VAPI Webhook] Status update: ${status}`);

    if (status === 'ringing') {
      console.log(`[VOICE] Twilio call connected`);
    } else if (status === 'in-progress') {
      console.log(`[VOICE] VAPI session created`);
      console.log(`[VOICE] Assistant attached`);
      console.log(`[VOICE] Audio stream connected`);
      console.log(`[VOICE] AI greeting delivered`);
      console.log(`[VOICE] Conversation active`);
    } else if (status === 'ended') {
      const endedReason = message.endedReason || body.endedReason;
      if (endedReason && endedReason !== 'customer-ended-call' && endedReason !== 'assistant-ended-call' && endedReason !== 'normal') {
        console.error(`[VOICE] Fail-Safe Recovery Active:
- Error Source: VAPI Voice Session Lifecycle
- Status: ended
- Ended Reason: ${endedReason}
- Suggested Fix: The call disconnected unexpectedly. Verify your Twilio webhook URL configurations, check if your model/voice providers have valid keys on the Vapi dashboard, and ensure your Twilio phone number is imported.`);
      }
    }
    return res.status(200).json({ status: "processed" });
  }

  // 3. Handle End of Call Report (Save transcripts and AI summary)
  if (message.type === 'end-of-call-report') {
    const customerPhone = body.customer?.number;
    const transcript = body.transcript || "";
    const summary = body.summary || "";
    const recordingUrl = body.recordingUrl || "";

    console.log(`[VAPI Webhook] Call ended for ${customerPhone}. Recording: ${recordingUrl}`);
    
    if (customerPhone) {
      try {
        await handleEndOfCallReport(customerPhone, transcript, summary, recordingUrl);
      } catch (err: any) {
        console.error('[VAPI Webhook] Error storing end-of-call telemetry:', err.message);
      }
    }
    return res.status(200).json({ status: "processed" });
  }

  return res.status(200).json({ status: "ignored" });
}

/**
 * Tool: getComplaintStatus
 */
async function executeGetComplaintStatus(complaintId: string): Promise<string> {
  const docRef = doc(db, 'complaints', complaintId);
  const snap = await getDoc(docRef);

  if (!snap.exists()) {
    return `Could not find a registered grievance with ID ${complaintId}. Please double check the ID.`;
  }

  const data = snap.data();
  const status = data.status || 'Pending';
  const dept = data.departmentName || data.department || 'Not Assigned';
  const officer = data.assignedOfficer || 'Not Assigned';
  const eta = data.estimatedTimeline || '7 Working Days';

  return `Grievance details for ${complaintId}: Current Status is "${status}". Assigned Department is "${dept}". Handling Officer is "${officer}". Expected Resolution Timeline is "${eta}".`;
}

/**
 * Tool: addComplaintNote
 */
async function executeAddComplaintNote(complaintId: string, noteText: string): Promise<string> {
  const docRef = doc(db, 'complaints', complaintId);
  const snap = await getDoc(docRef);

  if (!snap.exists()) {
    return `Could not find a registered grievance with ID ${complaintId}.`;
  }

  const data = snap.data();
  const timeline = data.timeline || [];
  const nextStep = (data.currentStep || 1) + 1;

  const newStep = {
    step: nextStep,
    title: 'Grievance Info Appended',
    date: new Date().toLocaleDateString('en-IN'),
    desc: `Citizen added follow-up note via AI Voice Call: "${noteText}"`,
    iconName: 'Sparkles'
  };

  const updatedTimeline = [...timeline, newStep];
  const notes = data.notes ? `${data.notes}\n[AI Voice Note]: ${noteText}` : `[AI Voice Note]: ${noteText}`;

  const updates = {
    notes,
    timeline: updatedTimeline,
    currentStep: nextStep,
    updatedAt: new Date().toISOString()
  };

  await updateDoc(docRef, updates);

  // Broadcast dynamic update via Socket.IO
  if (ioInstance) {
    console.log(`[VAPI Webhook] Broadcasting note update to rooms for ${complaintId}`);
    ioInstance.to(`complaint:${complaintId}`).emit('status_update', {
      complaintId,
      status: data.status,
      currentStep: nextStep,
      timeline: updatedTimeline,
      notes,
      timestamp: new Date().toISOString()
    });
    ioInstance.emit('heatmap_update', { timestamp: new Date().toISOString() });
  }

  return `Note successfully appended to complaint ${complaintId}. The assigned officer ${data.assignedOfficer || ''} has been notified.`;
}

/**
 * Tool: requestOfficerCallback
 */
async function executeRequestOfficerCallback(complaintId: string, timePreference?: string): Promise<string> {
  const docRef = doc(db, 'complaints', complaintId);
  const snap = await getDoc(docRef);

  if (!snap.exists()) {
    return `Could not find a registered grievance with ID ${complaintId}.`;
  }

  const data = snap.data();
  const timeline = data.timeline || [];
  const nextStep = (data.currentStep || 1) + 1;

  const newStep = {
    step: nextStep,
    title: 'Callback Scheduled',
    date: new Date().toLocaleDateString('en-IN'),
    desc: `Citizen requested direct phone callback${timePreference ? ` at ${timePreference}` : ''}. Scheduling request dispatched to ${data.assignedOfficer || 'handling officer'}.`,
    iconName: 'Clock'
  };

  const updatedTimeline = [...timeline, newStep];

  const updates = {
    callbackRequested: true,
    callbackTimePreference: timePreference || 'As soon as possible',
    timeline: updatedTimeline,
    currentStep: nextStep,
    updatedAt: new Date().toISOString()
  };

  await updateDoc(docRef, updates);

  // Broadcast update via Socket.IO
  if (ioInstance) {
    ioInstance.to(`complaint:${complaintId}`).emit('status_update', {
      complaintId,
      status: data.status,
      currentStep: nextStep,
      timeline: updatedTimeline,
      timestamp: new Date().toISOString()
    });
  }

  return `Callback request created successfully. Assigned officer ${data.assignedOfficer || ''} will contact you shortly.`;
}

/**
 * Tool: reportEmergency
 */
async function executeReportEmergency(complaintId: string, emergencyType: string): Promise<string> {
  const docRef = doc(db, 'complaints', complaintId);
  const snap = await getDoc(docRef);

  if (!snap.exists()) {
    return `Could not find complaint ID ${complaintId} to escalate.`;
  }

  const data = snap.data();
  const timeline = data.timeline || [];
  const nextStep = (data.currentStep || 1) + 1;

  const newStep = {
    step: nextStep,
    title: 'EMERGENCY DISPATCH TRIGGERED',
    date: new Date().toLocaleDateString('en-IN'),
    desc: `AI Voice agent detected critical emergency keyword: "${emergencyType}". Escalated to CM & District Emergency Response Room.`,
    iconName: 'ShieldAlert'
  };

  const updatedTimeline = [...timeline, newStep];

  const updates = {
    priority: 'EMERGENCY',
    status: 'Critical',
    routingStatus: 'Escalated',
    timeline: updatedTimeline,
    currentStep: nextStep,
    escalationLogged: true,
    updatedAt: new Date().toISOString()
  };

  await updateDoc(docRef, updates);

  // Create real-time notification
  try {
    const notifyRef = collection(db, 'notifications');
    await addDoc(notifyRef, {
      title: `EMERGENCY ALERT: ${emergencyType}`,
      message: `Critical keyword detected in AI call for ${complaintId}. Immediate action requested.`,
      role: 'CM Office',
      departmentId: data.departmentId || 'DEPT-GEN',
      complaintId,
      timestamp: new Date().toISOString()
    });
  } catch (err) {}

  // Broadcast dynamic update via Socket.IO
  if (ioInstance) {
    ioInstance.to(`complaint:${complaintId}`).emit('status_update', {
      complaintId,
      status: 'Critical',
      currentStep: nextStep,
      timeline: updatedTimeline,
      priority: 'EMERGENCY',
      timestamp: new Date().toISOString()
    });
    ioInstance.emit('heatmap_update', { timestamp: new Date().toISOString() });
  }

  return `Emergency reported successfully. Your complaint has been marked as CRITICAL, and emergency dispatch alerts have been sent to the CM, Department, and Officer dashboards.`;
}

/**
 * End of Call Report handler
 */
async function handleEndOfCallReport(phone: string, transcript: string, summary: string, recordingUrl: string) {
  // Find the latest complaint registered by this phone number
  const q = query(
    collection(db, 'complaints'),
    where('phoneNumber', '==', phone)
  );

  const snap = await getDocs(q);
  if (snap.empty) {
    console.log(`[VAPI Webhook] No complaints found for citizen phone ${phone}. Unable to append transcript.`);
    return;
  }

  // Get the latest complaint document
  const list: any[] = [];
  snap.forEach(doc => list.push({ id: doc.id, ...doc.data() }));
  list.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
  
  const latestComplaint = list[0];
  const complaintId = latestComplaint.id;
  const docRef = doc(db, 'complaints', complaintId);

  const timeline = latestComplaint.timeline || [];
  const nextStep = (latestComplaint.currentStep || 1) + 1;

  const newStep = {
    step: nextStep,
    title: 'AI Call Transcript Filed',
    date: new Date().toLocaleDateString('en-IN'),
    desc: `AI Voice Call completed. Summary: "${summary}". Recording: ${recordingUrl}`,
    iconName: 'FileText'
  };

  const updatedTimeline = [...timeline, newStep];
  const updates = {
    timeline: updatedTimeline,
    currentStep: nextStep,
    vapiTranscript: transcript,
    vapiSummary: summary,
    vapiRecordingUrl: recordingUrl,
    updatedAt: new Date().toISOString()
  };

  await updateDoc(docRef, updates);

  // Broadcast update via Socket.IO
  if (ioInstance) {
    ioInstance.to(`complaint:${complaintId}`).emit('status_update', {
      complaintId,
      status: latestComplaint.status,
      currentStep: nextStep,
      timeline: updatedTimeline,
      timestamp: new Date().toISOString()
    });
  }

  console.log(`[VAPI Webhook] Call telemetry appended successfully to complaint ${complaintId}.`);
}
