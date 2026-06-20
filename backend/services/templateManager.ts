export const TEMPLATES: Record<string, string> = {
  // Submission
  'complaint-submitted': 
    'Dear Citizen,\n\nYour grievance has been successfully submitted.\n\nComplaint ID:\n{{complaintId}}\n\nCategory:\n{{category}}\n\nTrack your grievance:\n\n{{trackingUrl}}\n\nYou will receive updates whenever the complaint status changes.\n\nCM Grievance Portal',
  
  // Statuses
  'Submitted': 
    'Dear Citizen,\n\nYour grievance has been successfully submitted.\n\nComplaint ID:\n{{complaintId}}\n\nCategory:\n{{category}}\n\nTrack your grievance:\n\n{{trackingUrl}}\n\nYou will receive updates whenever the complaint status changes.\n\nCM Grievance Portal',
  
  'AI_Validated': 
    'Dear Citizen,\n\nYour grievance {{complaintId}} has completed AI validation.\n\nTrack your grievance:\n{{trackingUrl}}\n\nCurrent Status: AI Validation Completed\n\nCM Grievance Portal',
  
  'Assigned_Dept': 
    'Dear Citizen,\n\nYour grievance {{complaintId}} has been assigned to {{department}}.\n\nTrack your grievance:\n{{trackingUrl}}\n\nCurrent Status: Assigned To Department\n\nCM Grievance Portal',
  
  'Officer_Assigned': 
    'Dear Citizen,\n\nA resolving officer has been assigned to handle your grievance {{complaintId}}.\n\nTrack your grievance:\n{{trackingUrl}}\n\nCurrent Status: Officer Assigned\n\nCM Grievance Portal',
  
  'Investigation_Started': 
    'Dear Citizen,\n\nInvestigation has started for grievance {{complaintId}}.\n\nTrack your grievance:\n{{trackingUrl}}\n\nCurrent Status: Investigation Started\n\nCM Grievance Portal',
  
  'Inspection_Scheduled': 
    'Dear Citizen,\n\nA field inspection has been scheduled for grievance {{complaintId}}.\n\nTrack your grievance:\n{{trackingUrl}}\n\nCurrent Status: Field Inspection Scheduled\n\nCM Grievance Portal',
  
  'Inspection_Completed': 
    'Dear Citizen,\n\nField inspection has been completed for grievance {{complaintId}}.\n\nTrack your grievance:\n{{trackingUrl}}\n\nCurrent Status: Field Inspection Completed\n\nCM Grievance Portal',
  
  'Action_In_Progress': 
    'Dear Citizen,\n\nWork has started on grievance {{complaintId}}.\n\nTrack your grievance:\n{{trackingUrl}}\n\nCurrent Status: Action In Progress\n\nCM Grievance Portal',
  
  'Resolved': 
    'Dear Citizen,\n\nYour grievance {{complaintId}} has been marked as resolved.\n\nTrack your grievance:\n{{trackingUrl}}\n\nCurrent Status: Resolved\n\nCM Grievance Portal',
  
  'Citizen_Verified': 
    'Dear Citizen,\n\nYou have successfully verified the resolution of grievance {{complaintId}}.\n\nTrack your grievance:\n{{trackingUrl}}\n\nCurrent Status: Citizen Verification\n\nCM Grievance Portal',
  
  'Closed': 
    'Dear Citizen,\n\nYour grievance {{complaintId}} has been successfully closed.\n\nTrack your grievance:\n{{trackingUrl}}\n\nCurrent Status: Closed\n\nCM Grievance Portal'
};

/**
 * Returns a compiled message string with replaced placeholders.
 */
export function renderTemplate(templateName: string, variables: Record<string, string>): string {
  const template = TEMPLATES[templateName] || TEMPLATES['Submitted'];
  let message = template;

  for (const [key, value] of Object.entries(variables)) {
    message = message.replace(new RegExp(`{{${key}}}`, 'g'), value || '');
  }

  return message;
}
