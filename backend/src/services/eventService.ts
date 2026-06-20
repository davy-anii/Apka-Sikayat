import { isFirebaseAdminInitialized, adminDb } from '../config/firebaseAdmin';

export interface TimelineStep {
  step: number;
  title: string;
  date: string | null;
  desc: string;
  iconName: string;
}

export const STAGES: { step: number; title: string; status: string; desc: string; iconName: string }[] = [
  { step: 1, title: 'Complaint Submitted', status: 'Submitted', desc: 'Your complaint was received by the system.', iconName: 'FileText' },
  { step: 2, title: 'AI Validation Completed', status: 'AI_Validated', desc: 'AI reviewed the complaint and verified authenticity.', iconName: 'ShieldCheck' },
  { step: 3, title: 'Assigned To Department', status: 'Assigned_Dept', desc: 'Complaint routed to the responsible department.', iconName: 'Building2' },
  { step: 4, title: 'Officer Assigned', status: 'Officer_Assigned', desc: 'A specific resolving officer has been assigned.', iconName: 'UserCheck' },
  { step: 5, title: 'Investigation Started', status: 'Investigation_Started', desc: 'The department has started reviewing your complaint details.', iconName: 'Activity' },
  { step: 6, title: 'Field Inspection Scheduled', status: 'Inspection_Scheduled', desc: 'A field visit has been scheduled to inspect the site.', iconName: 'Calendar' },
  { step: 7, title: 'Field Inspection Completed', status: 'Inspection_Completed', desc: 'Site inspection completed by the assigned officer.', iconName: 'FileCheck' },
  { step: 8, title: 'Action In Progress', status: 'Action_In_Progress', desc: 'Department team has started resolving the issue at the site.', iconName: 'Wrench' },
  { step: 9, title: 'Issue Resolved', status: 'Resolved', desc: 'The department has resolved the issue. Awaiting citizen verification.', iconName: 'CheckCircle2' },
  { step: 10, title: 'Citizen Verification', status: 'Citizen_Verified', desc: 'Citizen confirmed and verified the resolution.', iconName: 'User' },
  { step: 11, title: 'Complaint Closed', status: 'Closed', desc: 'The complaint has been successfully resolved and closed.', iconName: 'Lock' },
].map((item, index) => ({ ...item, step: index + 1 }));

export async function updateComplaintStatusInDb(
  complaintId: string,
  newStatus: string,
  updatedBy: string,
  customNotes?: string,
  overridePhoneNumber?: string,
  overrideCitizenId?: string
): Promise<{ success: boolean; complaintData: any }> {
  console.log(`[Event Service] Updating complaint ${complaintId} to status "${newStatus}" by ${updatedBy}`);

  // Default mock fallback data if Firestore admin isn't loaded
  const fallbackDate = new Date().toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });

  let mockComplaintData: any = {
    id: complaintId,
    status: newStatus,
    uid: overrideCitizenId || 'mock_citizen_id',
    title: 'Waterlogging near sector 5',
    category: 'Water Supply',
    department: 'PWD',
    phoneNumber: overridePhoneNumber || '+919999999999',
    currentStep: 1,
    timeline: []
  };

  if (!isFirebaseAdminInitialized || !adminDb) {
    console.log(`[Event Service] [Simulation Mode] Updated Firestore mockup in-memory`);
    const targetStageIndex = STAGES.findIndex(s => s.status === newStatus);
    const stepNum = targetStageIndex !== -1 ? targetStageIndex + 1 : 1;
    mockComplaintData.currentStep = stepNum;
    mockComplaintData.timeline = STAGES.map(s => ({
      step: s.step,
      title: s.title,
      iconName: s.iconName,
      desc: s.desc,
      date: s.step <= stepNum ? fallbackDate : null
    }));
    return { success: true, complaintData: mockComplaintData };
  }

  try {
    const complaintRef = adminDb.collection('complaints').doc(complaintId);
    const docSnap = await complaintRef.get();

    if (!docSnap.exists) {
      throw new Error(`Complaint with ID ${complaintId} does not exist.`);
    }

    const complaintData = docSnap.data();
    if (!complaintData) {
      throw new Error(`Complaint with ID ${complaintId} contains no data.`);
    }

    // Determine current step index
    const stageIndex = STAGES.findIndex(s => s.status === newStatus);
    const newStep = stageIndex !== -1 ? stageIndex + 1 : (complaintData.currentStep || 1);

    // Build timeline. We construct a 11-stage timeline. 
    // Fill in dates for steps that are completed (<= newStep)
    const currentDateString = new Date().toLocaleDateString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });

    // Check if the complaint already has a timeline. We will preserve existing completed step dates
    const existingTimeline = complaintData.timeline || [];
    const timeline: TimelineStep[] = STAGES.map(stage => {
      const existingStep = existingTimeline.find((s: any) => s.step === stage.step);
      let date = existingStep?.date || null;
      
      // If it is the current step or a previous step, and does not have a date, set the current date
      if (stage.step <= newStep && !date) {
        date = currentDateString;
      }
      // If it is a future step, ensure it is null
      if (stage.step > newStep) {
        date = null;
      }

      return {
        step: stage.step,
        title: stage.title,
        iconName: stage.iconName,
        desc: stage.step === newStep && customNotes ? customNotes : stage.desc,
        date: date
      };
    });

    const updatedFields: any = {
      status: newStatus,
      currentStep: newStep,
      timeline: timeline,
      updatedAt: new Date().toISOString()
    };

    // If notes are supplied, we can save them
    if (customNotes) {
      updatedFields.lastNotes = customNotes;
    }

    // Check if status is department assignment
    if (newStatus === 'Assigned_Dept' && updatedBy.startsWith('Assigned to ')) {
      updatedFields.department = updatedBy.replace('Assigned to ', '');
    }

    // Update document
    await complaintRef.update(updatedFields);
    console.log(`[Event Service] Successfully updated complaint ${complaintId} in complaints collection.`);

    // 2. Add document to grievance_events collection for permanent auditing
    const eventRef = adminDb.collection('grievance_events').doc();
    const activeStage = STAGES.find(s => s.status === newStatus);
    const message = customNotes || activeStage?.desc || `Status updated to ${newStatus}`;
    
    const eventData = {
      id: eventRef.id,
      grievance_id: complaintId,
      status: newStatus,
      message: message,
      created_by: updatedBy,
      timestamp: new Date().toISOString()
    };

    await eventRef.set(eventData);
    console.log(`[Event Service] Created permanent event in grievance_events: ${eventRef.id}`);

    // Retrieve the citizen phone number to pass to the notifier
    // Check user profile for citizen phone number
    let phoneNumber = '+919999999999'; // fallback
    const citizenUid = complaintData.uid || complaintData.citizen_id;
    if (citizenUid) {
      const userDoc = await adminDb.collection('users').doc(citizenUid).get();
      if (userDoc.exists) {
        const uData = userDoc.data();
        phoneNumber = uData?.phone || uData?.phoneNumber || phoneNumber;
      }
    }

    const fullComplaint = {
      ...complaintData,
      ...updatedFields,
      phoneNumber
    };

    return { success: true, complaintData: fullComplaint };
  } catch (error: any) {
    console.error(`[Event Service] Error in updateComplaintStatusInDb:`, error.message);
    if (error.message.includes('default credentials') || error.message.includes('credentials') || error.message.includes('permission')) {
      console.warn(`[Event Service] [Simulation Fallback] Local server does not have GCP credentials. Running in simulation mode.`);
      const targetStageIndex = STAGES.findIndex(s => s.status === newStatus);
      const stepNum = targetStageIndex !== -1 ? targetStageIndex + 1 : 1;
      mockComplaintData.currentStep = stepNum;
      mockComplaintData.timeline = STAGES.map(s => ({
        step: s.step,
        title: s.title,
        iconName: s.iconName,
        desc: s.desc,
        date: s.step <= stepNum ? fallbackDate : null
      }));
      return { success: true, complaintData: mockComplaintData };
    }
    throw error;
  }
}
