import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../../frontend/.env') });

const VAPI_PRIVATE_KEY = process.env.VAPI_PRIVATE_KEY || "";
const VAPI_PUBLIC_KEY = process.env.VAPI_PUBLIC_KEY || "";

const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID || "";
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN || "";
const TWILIO_PHONE_NUMBER = process.env.TWILIO_PHONE_NUMBER || "";

function getServerUrl() {
  return 'https://apka-sikayat.onrender.com/api/vapi/webhook';
}

export async function triggerVapiOutboundCall(customerNumber: string, citizenName: string): Promise<any> {
  console.log(`[VAPI Service] Requesting outbound call for ${customerNumber} (${citizenName})...`);

  let formattedTo = customerNumber.trim().replace(/[\s\-\(\)]/g, '');
  if (!formattedTo.startsWith('+')) {
    if (formattedTo.startsWith('0')) formattedTo = formattedTo.substring(1);
    if (formattedTo.length === 10) formattedTo = `+91${formattedTo}`;
    else formattedTo = `+${formattedTo}`;
  }

  const serverUrl = getServerUrl();
  console.log(`[VAPI Service] Callback serverUrl: ${serverUrl}`);

  const body = {
    type: "outboundPhoneCall",
    phoneCallProviderBypassEnabled: true,
    phoneNumber: {
      twilioPhoneNumber: TWILIO_PHONE_NUMBER,
      twilioAccountSid: TWILIO_ACCOUNT_SID,
      twilioAuthToken: TWILIO_AUTH_TOKEN
    },
    customer: {
      number: formattedTo
    },
    assistant: {
      firstMessage: `Hello. Thank you for contacting the CM Grievance Portal. I am your AI Governance Assistant. May I confirm that I am speaking with Mr or Ms ${citizenName}?`,
      serverUrl: serverUrl,
      transcriber: {
        provider: "deepgram",
        model: "nova-2",
        language: "en"
      },
      voice: {
        provider: "playht",
        voiceId: "jennifer"
      },
      model: {
        provider: "openai",
        model: "gpt-4o",
        temperature: 0.2,
        messages: [
          {
            role: "system",
            content: `You are the AI Voice Governance Assistant for the CM Grievance Portal.
Conduct the conversation in English or Hindi (bilingual) depending on the citizen's preference.

GREETING:
Start by naturally confirming the citizen's identity using the firstMessage.

CAPABILITIES:
1. ANSWER COMPLAINT STATUS & TIMELINE:
If the user asks about their complaint status or expected resolution, call the tool 'getComplaintStatus'.
If no complaint ID is known, ask the citizen for their Complaint ID or search by phone.
Explain the status (Assigned, In Progress, Resolved) and estimated resolution date from Firestore.

2. REGISTER FOLLOW-UP NOTES:
If the user wants to add more information, call the tool 'addComplaintNote' to append notes to Firestore. Tell them the note is updated, a timeline event is created, and the officer is notified.

3. CALLBACK / SPEAK TO OFFICER:
If the user asks to speak to an officer, call 'requestOfficerCallback'. Explain if the officer is available or if a callback request is created.

4. EMERGENCY KEYWORDS DETECTION:
If the user mentions emergency terms like "Fire", "Murder", "Accident", "Violence", "Rape", "Medical Emergency", "Flood", "Collapse", or "Danger", immediately call the tool 'reportEmergency' to mark the complaint as CRITICAL, notify the CM, Department, and Officer, and log an emergency event.

5. FAQS & EXPLAIN COMPLAINT PROCESS:
Answer standard process questions.

6. CONVERSATION ENDING:
When the citizen says "Thank You", "Bye", "Okay Thanks", or "That's all", end politely:
"Thank you for contacting the CM Grievance Portal. Your grievance is already registered. If you need further assistance, simply send 'Call Me' on WhatsApp anytime. Have a wonderful day."
Then end the call. Do not continue conversation.`
          }
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "getComplaintStatus",
              description: "Retrieve the current status, department, and estimated resolution timeline of a complaint from Firestore.",
              parameters: {
                type: "object",
                properties: {
                  complaintId: { "type": "string", "description": "The unique ID of the complaint (e.g. GRV-2026-426491)" }
                },
                required: ["complaintId"]
              }
            }
          },
          {
            type: "function",
            function: {
              name: "addComplaintNote",
              description: "Append additional citizen notes to the complaint document in Firestore, notify the assigned officer, and create a timeline event.",
              parameters: {
                type: "object",
                properties: {
                  complaintId: { "type": "string", "description": "The unique ID of the complaint" },
                  noteText: { "type": "string", "description": "The text of the note or additional info to append." }
                },
                required: ["complaintId", "noteText"]
              }
            }
          },
          {
            type: "function",
            function: {
              name: "requestOfficerCallback",
              description: "Request a direct phone callback or schedule callback with the assigned department officer.",
              parameters: {
                type: "object",
                properties: {
                  complaintId: { "type": "string", "description": "The unique ID of the complaint" },
                  timePreference: { "type": "string", "description": "The citizen's preferred callback time." }
                },
                required: ["complaintId"]
              }
            }
          },
          {
            type: "function",
            function: {
              name: "reportEmergency",
              description: "Report an emergency keyword (Fire, Murder, Accident, Violence, Rape, Medical Emergency, Flood, Collapse, Danger). This escalates the complaint to CRITICAL priority, creates emergency alerts, and updates all dashboards in real-time.",
              parameters: {
                type: "object",
                properties: {
                  complaintId: { "type": "string", "description": "The unique ID of the complaint" },
                  emergencyType: { "type": "string", "description": "The specific emergency keyword detected." }
                },
                required: ["complaintId", "emergencyType"]
              }
            }
          }
        ]
      }
    }
  };

  try {
    console.log(`[VOICE] Twilio outbound call initiated`);
    const response = await fetch("https://api.vapi.ai/call", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${VAPI_PRIVATE_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error(`[VOICE] Fail-Safe Recovery Active:
- Error Source: VAPI Outbound Call Dispatch
- Failing API: POST https://api.vapi.ai/call
- HTTP Status Code: ${response.status}
- Response Body: ${errText}
- Suggested Fix: Check Vapi/Twilio credentials in .env, ensure phoneCallProviderBypassEnabled is true, and verify phone numbers match E.164 formatting.`);
      throw new Error(`VAPI status ${response.status}: ${errText}`);
    }

    const data = await response.json();
    console.log(`[VAPI Service] Outbound call successfully queued. Call SID: ${data.id}`);
    return data;
  } catch (err: any) {
    console.error("[VAPI Service] Outbound call dispatch failed:", err.message);
    throw err;
  }
}
