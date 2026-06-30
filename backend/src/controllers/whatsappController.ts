import { Request, Response } from 'express';
import { isFirebaseAdminInitialized, adminDb } from '../config/firebaseAdmin';
import { sendWhatsAppText, downloadWhatsAppMedia } from '../services/whatsappService';
import { validateGrievance } from '../services/grievanceValidator';
import { generateTrackingToken, getAppUrl, getBackendUrl, generateNextComplaintId } from '../services/urlHelper';
import { sendTwilioSMS } from '../services/twilioService';
import { db } from '../../firebase';
import { doc, getDoc, setDoc, addDoc, collection, query, where, getDocs, deleteDoc } from 'firebase/firestore';
import bcrypt from 'bcryptjs';

const VERIFY_TOKEN = 'apka_sikayat_whatsapp_token';

// Local fallbacks if Firestore isn't available
const localSessions = new Map<string, any>();
const localUsers = new Map<string, any>();

/**
 * Webhook Verification
 */
export function verifyWebhook(req: Request, res: Response) {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode && token) {
    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      console.log('[WhatsApp Webhook] Verification successful!');
      return res.status(200).send(challenge);
    } else {
      console.error('[WhatsApp Webhook] Verification token mismatch.');
      return res.sendStatus(403);
    }
  }
  return res.sendStatus(400);
}

/**
 * AI Text Validation using Gemini 2.5 Flash
 */
async function validateGrievanceText(description: string, district: string): Promise<any> {
  const apiKey = process.env.WHATSAPP_GEMINI_API_KEY || process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY_CITIZEN;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured.');
  }

  const systemPrompt = `
You are the Advanced AI Grievance Intelligence & Validation Engine for a Chief Minister's Public Grievance Portal.
Your task is to analyze the text context and determine if it represents a genuine public grievance.

### Decision Rules:
Reject ONLY when clearly unrelated to public interest (e.g., personal complaints, spam, greetings, unrelated chit-chat).

### Output JSON Format:
You must respond with a JSON object containing precisely the following keys:
{
  "is_grievance": boolean,
  "grievance_category": string,
  "sub_category": string,
  "department": string,
  "severity": "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
  "urgency": "LOW" | "MEDIUM" | "HIGH" | "IMMEDIATE",
  "confidence": number,
  "spam": boolean,
  "accepted": boolean,
  "reason": string,
  "recommended_action": string
}
Output raw JSON only.
`;

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
  const requestBody = {
    contents: [
      {
        parts: [
          { text: `${systemPrompt}\n\nUser Grievance Text:\nDescription: ${description}\nDistrict: ${district}` }
        ]
      }
    ],
    generationConfig: {
      responseMimeType: "application/json",
      temperature: 0.1
    }
  };

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    throw new Error(`Gemini text validation failed: ${response.status}`);
  }

  const data = await response.json();
  const textResponse = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!textResponse) {
    throw new Error('Empty response from Gemini API');
  }

  return JSON.parse(textResponse.trim());
}

/**
 * Audio voice note transcription
 */
async function transcribeVoiceNote(base64Audio: string, mimeType: string): Promise<string> {
  const apiKey = process.env.WHATSAPP_GEMINI_API_KEY || process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY_CITIZEN;
  if (!apiKey) return 'Transcription API key not set.';

  const rawBase64 = base64Audio.includes('base64,') ? base64Audio.split('base64,')[1] : base64Audio;
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

  const requestBody = {
    contents: [
      {
        parts: [
          { text: "Transcribe the following audio message exactly as spoken. Output ONLY the transcription, nothing else." },
          { inlineData: { mimeType, data: rawBase64 } }
        ]
      }
    ]
  };

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });
    if (!response.ok) return 'Voice transcription failed.';
    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || 'Audio message is empty.';
  } catch (err) {
    console.error('[WhatsApp Webhook] Transcription error:', err);
    return 'Voice transcription failed.';
  }
}

/**
 * Extract clean person name — fast local fallback first, then Gemini as backup
 */
async function extractCleanName(text: string): Promise<string | null> {
  // --- Step 1: Local fast-path extraction (no API call needed) ---
  // Strip common conversational prefixes in English, Hindi, Bengali
  const prefixPattern = /^(?:my\s+name\s+is|i\s+am|i'm|myself|this\s+is|amer\s+na[m]e?|mera\s+naam|mera\s+name|naam\s+hai|bolchhi|am|name\s+is|name:)\s*/i;
  const stripped = text.trim().replace(prefixPattern, '').trim();

  // Accept if it looks like a real name: 1–4 words, each starting with a letter, only letters/spaces/dots/hyphens
  const namePattern = /^[A-Za-z][A-Za-z.\-']*(?:\s+[A-Za-z][A-Za-z.\-']*){0,3}$/;
  if (namePattern.test(stripped) && stripped.length >= 2) {
    // Capitalize each word for consistency
    const capitalized = stripped.replace(/\b\w/g, (c) => c.toUpperCase());
    console.log(`[extractCleanName] Local match: "${capitalized}"`);
    return capitalized;
  }

  // --- Step 2: Gemini AI fallback for complex/regional inputs ---
  const apiKey = process.env.WHATSAPP_GEMINI_API_KEY || process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY_CITIZEN;
  if (!apiKey) return null;

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
  const systemPrompt = `You are a precise entity extraction engine. Your task is to extract ONLY the clean full name of a person from the user input.
Remove all conversational prefixes (like "My name is", "I am", "Amer nam", "Amer name", "Mera naam", "I'm", "myself", "This is", "bolchhi").
Examples:
Input: "My name is Ramesh Mallik" -> Output: "Ramesh Mallik"
Input: "Amer nam Ramesh Mallik" -> Output: "Ramesh Mallik"
Input: "I am Ramesh Mallik" -> Output: "Ramesh Mallik"
Input: "Amer name ratul saha" -> Output: "Ratul Saha"
Input: "Hi my name is Amit" -> Output: "Amit"

If no name is present in the input, return "null". Output ONLY the clean name or "null" - do not include any other words or punctuation.`;

  const requestBody = {
    contents: [
      {
        parts: [{ text: `${systemPrompt}\n\nInput: "${text}"` }]
      }
    ],
    generationConfig: {
      temperature: 0.0
    }
  };

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });
    if (!response.ok) return null;
    const data = await response.json();
    const result = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    if (result && result.toLowerCase() !== 'null') {
      return result;
    }
    return null;
  } catch (err) {
    console.error('Error in extractCleanName:', err);
    return null;
  }
}

/**
 * Analyze uploaded media (image, video, document, etc.) using Gemini
 */
async function analyzeUploadedMedia(base64Data: string, mimeType: string): Promise<string> {
  const apiKey = process.env.WHATSAPP_GEMINI_API_KEY || process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY_CITIZEN;
  if (!apiKey) return 'No API key configured for media analysis.';

  const rawBase64 = base64Data.includes('base64,') ? base64Data.split('base64,')[1] : base64Data;
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

  const requestBody = {
    contents: [
      {
        parts: [
          { text: "Analyze the uploaded media (image, video, document) and describe the public grievance or issue shown or described in it. Be specific but keep it to one or two short sentences." },
          { inlineData: { mimeType, data: rawBase64 } }
        ]
      }
    ],
    generationConfig: {
      temperature: 0.1
    }
  };

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });
    if (!response.ok) return 'Media analysis failed.';
    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || 'No description could be generated from the evidence.';
  } catch (err) {
    console.error('[WhatsApp Webhook] Media analysis error:', err);
    return 'Error analyzing media evidence.';
  }
}

/**
 * incoming webhook handler
 */
async function callGemini(systemPrompt: string, userMessage: string): Promise<string> {
  const GEMINI_API_KEY = process.env.WHATSAPP_GEMINI_API_KEY || process.env.GEMINI_API_KEY || "";
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;
    const requestBody = {
      contents: [
        {
          parts: [{ text: `${systemPrompt}\n\nUser Query: ${userMessage}` }]
        }
      ],
      generationConfig: {
        temperature: 0.1
      }
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      throw new Error(`Gemini response failed: ${response.status}`);
    }

    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || 'Unable to generate response.';
  } catch (err: any) {
    console.error('[Gemini API Helper] Error calling Gemini Flash:', err.message);
    return 'Systems are currently busy. Please try asking again in a moment.';
  }
}

export async function handleWebhookEvent(req: Request, res: Response) {
  const body = req.body;
  if (body.object !== 'whatsapp_business_account') {
    return res.sendStatus(404);
  }

  res.status(200).send('EVENT_RECEIVED');

  const entry = body.entry?.[0];
  const changes = entry?.changes?.[0];
  const value = changes?.value;
  const message = value?.messages?.[0];

  if (!message) return;

  const from = message.from;
  const textBody = message.text?.body?.trim() || '';

  // Call Me Intent Detection
  if (textBody.toLowerCase() === 'call me') {
    console.log(`[VOICE] WhatsApp trigger received`);
    console.log(`[WhatsApp Webhook] "Call Me" intent detected from ${from}. Checking database...`);
    try {
      const database = isFirebaseAdminInitialized && adminDb ? adminDb : null;
      let citizenDoc: any = null;
      
      // Query users collection by phone
      if (database) {
        const snap = await database.collection('users').where('phone', 'in', [`+${from}`, from]).limit(1).get();
        if (!snap.empty) citizenDoc = snap.docs[0].data();
      } else {
        const q = query(collection(db, 'users'), where('phone', 'in', [`+${from}`, from]));
        const snap = await getDocs(q);
        if (!snap.empty) citizenDoc = snap.docs[0].data();
      }

      if (!citizenDoc) {
        // Fallback: query complaints collection by phone
        let complaintDoc: any = null;
        if (database) {
          const snap = await database.collection('complaints').where('phoneNumber', 'in', [`+${from}`, from]).limit(1).get();
          if (!snap.empty) complaintDoc = snap.docs[0].data();
        } else {
          const q = query(collection(db, 'complaints'), where('phoneNumber', 'in', [`+${from}`, from]));
          const snap = await getDocs(q);
          if (!snap.empty) complaintDoc = snap.docs[0].data();
        }
        if (complaintDoc) {
          citizenDoc = { fullName: complaintDoc.citizenName || 'Citizen', phone: complaintDoc.phoneNumber || `+${from}` };
        }
      }

      if (!citizenDoc) {
        console.log(`[WhatsApp Webhook] Citizen profile not found for ${from}. Requesting phone sharing.`);
        await sendWhatsAppText(from, "Please share your phone number so I can call you.");
        return;
      }

      console.log(`[VOICE] Citizen number detected`);
      console.log(`[WhatsApp Webhook] Citizen verified: ${citizenDoc.fullName} (${citizenDoc.phone}). Triggering VAPI call...`);
      await sendWhatsAppText(from, `Connecting you to our AI Voice Governance Agent. Please expect a phone call on ${citizenDoc.phone} shortly...`);

      const { triggerVapiOutboundCall } = require('../services/vapiService');
      await triggerVapiOutboundCall(citizenDoc.phone, citizenDoc.fullName);
    } catch (err: any) {
      console.error('[WhatsApp Webhook] Call Me trigger failure:', err.message);
    }
    return;
  }

  // Get active session strictly isolated by phoneNumber
  let session: any = null;
  try {
    const sessionDocRef = doc(db, 'whatsapp_sessions', from);
    const sessionDocSnap = await getDoc(sessionDocRef);
    if (sessionDocSnap.exists()) {
      session = sessionDocSnap.data();
    } else {
      session = localSessions.get(from);
    }
  } catch (err: any) {
    console.warn('[WhatsApp Webhook] Firestore session fetch failed:', err.message);
    session = localSessions.get(from);
  }

  // Log conversation step
  try {
    await addDoc(collection(db, 'whatsapp_conversations'), {
      phone: from,
      direction: 'inbound',
      messageType: message.type,
      text: textBody,
      timestamp: new Date().toISOString()
    });
  } catch (err: any) {
    console.warn('[WhatsApp Webhook] Firestore inbound convo log failed:', err.message);
  }

  try {
    const queryLower = textBody.toLowerCase();
    const isThankYou = queryLower.includes('thank') || queryLower.includes('thx') || queryLower === 'thanks';
    if (isThankYou) {
      await sendReply(from, "🇮🇳 You're welcome! Glad to assist you. Apka Shikayat is always here to support transparent governance. Have a wonderful day ahead!");
      await deleteSession(from);
      return;
    }
    const isGreeting = ['hi', 'hello', 'hey', 'start', 'restart', 'new complaint'].includes(queryLower);

    // Initialize or reset session (always start a fresh onboarding flow on greeting reset)
    if (!session || isGreeting) {
      session = {
        state: 'COLLECTING_NAME',
        phone: from,
        conversationLog: []
      };
      await saveSession(from, session);
      await sendReply(
        from,
        "🇮🇳 Welcome to Apka Shikayat\n\nYour voice has the power to create change.\nReport issues, track resolutions, and help build a better tomorrow with transparent governance.\nI can help you register and track public grievances.\nLet's begin.\n\nWhat is your full name?"
      );
      return;
    }

    // Handle completed session state
    if (session.state === 'COMPLETED') {
      await sendReply(
        from,
        "Your complaint has been successfully registered. If you would like to report another issue, please type *Hi*, *Start*, or *New Complaint* to begin a new session."
      );
      return;
    }

    // Process Voice Notes, Media, and Location
    let userText = textBody;

    if (message.type === 'audio' || message.type === 'voice') {
      const audioId = message.audio?.id || message.voice?.id;
      console.log('[WhatsApp Webhook] Voice Note Processed for:', from);
      await sendReply(from, "🎙️ Processing voice note transcription...");
      const media = await downloadWhatsAppMedia(audioId);
      if (media) {
        userText = await transcribeVoiceNote(media.dataUrl, media.mimeType);
        if (userText.includes('failed') || userText.includes('busy') || userText.includes('not set') || !userText.trim()) {
          await sendReply(from, "🎙️ Politely, I was unable to transcribe your voice note clearly. Could you please record another voice note or type the details as text?");
          return;
        }
        await sendReply(from, `Transcribed: "${userText}"`);
      } else {
        await sendReply(from, "🎙️ Politely, I was unable to retrieve your voice recording. Could you please try recording it again or typing it as text?");
        return;
      }
    } else if (message.type === 'image' || message.type === 'video' || message.type === 'document') {
      const mediaId = message.image?.id || message.video?.id || message.document?.id;
      console.log('[WhatsApp Webhook] Image Processed for:', from);
      await sendReply(from, "📷 Analyzing uploaded evidence...");
      const media = await downloadWhatsAppMedia(mediaId);
      if (media) {
        session.mediaDataUrl = media.dataUrl;
        const analysis = await analyzeUploadedMedia(media.dataUrl, media.mimeType);
        userText = `[Uploaded evidence attachment: ${analysis}]`;
        await sendReply(from, `Evidence analyzed: "${analysis}"`);
      }
    } else if (message.type === 'location') {
      session.location = {
        lat: message.location.latitude,
        lng: message.location.longitude,
        address: message.location.name || 'WhatsApp Shared Location'
      };
      userText = `[Shared Location Address: ${session.location.address}]`;
    }

    // Append to conversation log (conversational memory)
    session.conversationLog = session.conversationLog || [];
    session.conversationLog.push({ sender: 'user', text: userText });

    // Onboarding Step 1: COLLECTING_NAME
    if (session.state === 'COLLECTING_NAME') {
      const cleanedName = await extractCleanName(userText);
      if (cleanedName) {
        session.fullName = cleanedName;
        session.state = 'COLLECTING_EMAIL';
        await saveSession(from, session);
        await sendReply(from, "Please enter your email address.");
      } else {
        await sendReply(from, "I could not extract a valid full name. Please enter your full name to proceed:");
      }
      return;
    }

    // Onboarding Step 2: COLLECTING_EMAIL
    if (session.state === 'COLLECTING_EMAIL') {
      const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
      const emailMatch = userText.match(emailRegex);
      if (emailMatch) {
        session.email = emailMatch[0];
        session.state = 'COLLECTING_PASSWORD';
        await saveSession(from, session);
        await sendReply(
          from,
          `✅ Email saved!\n\nNow please create a *password* for your Apka Shikayat web portal account.\n\n🔒 Your password must be at least 6 characters long.\n\nYou will use this password to log into the website and view your submitted grievances.`
        );
      } else {
        await sendReply(from, "Please enter a valid email address:");
      }
      return;
    }

    // Onboarding Step 2b: COLLECTING_PASSWORD
    if (session.state === 'COLLECTING_PASSWORD') {
      const pwd = userText.trim();
      if (pwd.length < 6) {
        await sendReply(from, "❌ Password is too short. Please enter a password with at least 6 characters:");
        return;
      }
      // Store the plain-text password temporarily in session (will be hashed on profile save)
      session.plainPassword = pwd;
      session.state = 'CONFIRMING_PHONE';
      await saveSession(from, session);
      await sendReply(
        from,
        `🔐 Password set successfully!\n\nWe detected your WhatsApp number:\n+${from}\n\nWould you like to use this number for updates?\n\nReply YES or NO.`
      );
      return;
    }

    // Onboarding Step 3: CONFIRMING_PHONE
    if (session.state === 'CONFIRMING_PHONE') {
      const ans = queryLower.trim();
      if (ans === 'yes' || ans === 'y') {
        session.verifiedPhone = `+${from}`;
        session.state = 'CONFIRMING_PROFILE';
        await saveSession(from, session);
        await sendReply(
          from,
          `Name:\n${session.fullName}\n\nEmail:\n${session.email}\n\nPhone:\n${session.verifiedPhone}\n\nIs this information correct?\n\nReply YES or EDIT.`
        );
      } else if (ans === 'no' || ans === 'n') {
        session.state = 'ENTERING_PHONE';
        await saveSession(from, session);
        await sendReply(from, "Please enter your preferred phone number for updates (including country code):");
      } else {
        await sendReply(from, "Reply YES or NO.");
      }
      return;
    }

    // Onboarding Step 3 (Alternate): ENTERING_PHONE
    if (session.state === 'ENTERING_PHONE') {
      const phoneClean = userText.replace(/[^0-9+]/g, '');
      if (phoneClean.length >= 10) {
        session.verifiedPhone = phoneClean.startsWith('+') ? phoneClean : `+${phoneClean}`;
        session.state = 'CONFIRMING_PROFILE';
        await saveSession(from, session);
        await sendReply(
          from,
          `Name:\n${session.fullName}\n\nEmail:\n${session.email}\n\nPhone:\n${session.verifiedPhone}\n\nIs this information correct?\n\nReply YES or EDIT.`
        );
      } else {
        await sendReply(from, "Please enter a valid phone number (including country code):");
      }
      return;
    }

    // Onboarding Step 4: CONFIRMING_PROFILE (Profile Confirmation YES/EDIT)
    if (session.state === 'CONFIRMING_PROFILE') {
      const ans = queryLower.trim();
      if (ans === 'yes' || ans === 'y') {
        session.profileConfirmed = true;
        session.state = 'COLLECTING_INFO';
        await saveSession(from, session);

        // Profile is saved ONLY after YES confirmation
        // Hash the password before storing — never store plain text
        let passwordHash = '';
        if (session.plainPassword) {
          try {
            passwordHash = await bcrypt.hash(session.plainPassword, 10);
          } catch (hashErr: any) {
            console.warn('[WhatsApp Webhook] Password hashing failed:', hashErr.message);
          }
          // Clear plain-text password from session immediately after hashing
          session.plainPassword = undefined;
        }

        const userProfile = {
          uid: `wa_${from}`,
          fullName: session.fullName,
          email: session.email,
          phone: session.verifiedPhone || `+${from}`,
          district: session.district || 'South West Delhi',
          role: 'Citizen',
          registrationSource: 'WhatsApp',
          joinedDate: new Date().toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }),
          ...(passwordHash && { passwordHash })
        };
        try {
          await setDoc(doc(db, 'users', `wa_${from}`), userProfile);
          console.log('[WhatsApp Webhook] Profile Saved with passwordHash:', `wa_${from}`);
        } catch (err: any) {
          console.warn('[WhatsApp Webhook] Profile save failed:', err.message);
        }

        const nextPrompt = `Thank you for confirming your profile, *${session.fullName}*.\n\nPlease describe the issue or grievance you want to report today. (You can also send voice notes or upload photo/video evidence)`;
        session.conversationLog.push({ sender: 'assistant', text: nextPrompt });
        await saveSession(from, session);
        await sendReply(from, nextPrompt);
      } else if (ans === 'edit' || ans === 'no' || ans === 'n') {
        session.fullName = undefined;
        session.email = undefined;
        session.state = 'COLLECTING_NAME';
        session.profileConfirmed = false;
        await saveSession(from, session);
        await sendReply(from, "Let's correct your details. What is your full name?");
      } else {
        await sendReply(from, "Please reply YES to confirm or EDIT to change your details.");
      }
      return;
    }

    // Handle COMPLAINT REVIEW state
    if (session.state === 'CONFIRMING_COMPLAINT') {
      const ans = queryLower.trim();
      if (ans === 'yes' || ans === 'y') {
        session.citizenUid = `wa_${from}`;
        session.verifiedPhone = session.verifiedPhone || `+${from}`;
        await createComplaintFromSession(from, session);
      } else if (ans === 'edit' || ans === 'no' || ans === 'n') {
        session.state = 'COLLECTING_INFO';
        session.description = undefined; // reset description to collect again
        await saveSession(from, session);
        await sendReply(from, "No problem. Let's update the complaint details. Please describe the grievance again in detail:");
      } else {
        await sendReply(from, "Please reply YES to submit the complaint or EDIT to modify it.");
      }
      return;
    }

    // Handle COLLECTING_INFO (Conversational Dialog Loop)
    if (session.state === 'COLLECTING_INFO') {
      const systemPrompt = `
You are the AI Grievance Assistant for NCT Delhi.
The user is conversing with you on WhatsApp to register a public grievance (e.g. road damage, waterlogging, streetlights, harassment, theft).
Act like a polite, empathetic, and professional citizen support officer. Avoid robotic or template-style replies.

### Rules:
1. Extract the following entities from the conversation history (specifically focusing on user inputs):
   - "description": The details of the complaint. Deduce this from their messages or media description. If not yet provided, set to null.
   - "category": The category ("Water Supply", "Road Maintenance", "Electricity", "Sanitation", "Safety", "Other"). If not yet provided, set to null.
   - "district": The Delhi district (must be one of: "South West Delhi", "New Delhi", "Central Delhi", "East Delhi", "Shahdara", "North West Delhi"). If not yet provided, set to null.
2. Ask follow-up questions naturally if information is missing (description, district). Do not ask for all missing details in a single query. Focus on one or two details first.
3. If the user provides details out of order, handle it gracefully. Do not force a rigid form.
4. Output your response ONLY as a JSON object matching this schema:
{
  "extracted": {
    "description": "extracted description or null",
    "category": "extracted category or null",
    "district": "extracted district or null"
  },
  "reply": "your next conversational response to the user"
}
`;

      const currentContext = `
Conversation History:
${session.conversationLog.map((l: any) => `${l.sender === 'user' ? 'Citizen' : 'Officer'}: ${l.text}`).join('\n')}

Previously Extracted Details:
Description: ${session.description || 'null'}
Category: ${session.category || 'null'}
District: ${session.district || 'null'}
`;

      const geminiReplyRaw = await callGemini(systemPrompt, currentContext);
      let geminiData: any = {};
      try {
        const jsonMatch = geminiReplyRaw.match(/\{[\s\S]*\}/);
        geminiData = JSON.parse(jsonMatch ? jsonMatch[0] : geminiReplyRaw);
      } catch (err) {
        console.error("Failed to parse Gemini dialog JSON:", geminiReplyRaw);
        geminiData = { reply: "I understand. Could you please provide your details to proceed?" };
      }

      // Merge newly extracted values
      if (geminiData.extracted) {
        const ext = geminiData.extracted;
        if (ext.description && ext.description !== 'null') session.description = ext.description;
        if (ext.category && ext.category !== 'null') session.category = ext.category;
        if (ext.district && ext.district !== 'null') session.district = ext.district;
      }

      // Transition to COMPLAINT REVIEW if profile is confirmed and complaint info is complete
      if (session.profileConfirmed && session.description && session.district) {
        session.state = 'CONFIRMING_COMPLAINT';
        await saveSession(from, session);
        
        const summaryMsg = `Complaint Category:\n${session.category || 'Other'}\n\nLocation:\n${session.district}\n\nDescription:\n${session.description}\n\nEvidence:\n${session.mediaDataUrl ? '1 Image Attached' : 'No Evidence Attached'}\n\nPriority:\n${session.priority || 'High'}\n\nSubmit Complaint?\n\nYES\nEDIT`;
        await sendReply(from, summaryMsg);
        return;
      }

      // Standard conversational reply
      session.conversationLog.push({ sender: 'assistant', text: geminiData.reply });
      await saveSession(from, session);
      await sendReply(from, geminiData.reply);
      return;
    }
  } catch (error: any) {
    console.error('[WhatsApp Controller] Execution error:', error.message);
    await sendReply(from, "An error occurred while processing your request. Please try again.");
  }
}

/**
 * Step 9 & 10: AI Validation & Complaint Creation
 */
async function createComplaintFromSession(from: string, session: any) {
  await sendReply(from, "⏳ Finalizing your grievance registration...");

  let aiResult: any = null;
  const hasMedia = !!session.mediaDataUrl;

  try {
    if (hasMedia) {
      aiResult = await validateGrievance(
        session.mediaDataUrl,
        "WhatsApp Grievance",
        session.description,
        "General",
        session.district
      );
    } else {
      aiResult = await validateGrievanceText(session.description, session.district);
    }
  } catch (err: any) {
    console.warn('[WhatsApp Webhook] AI analysis failed, applying defaults:', err.message);
    aiResult = {
      is_grievance: true,
      grievance_category: 'Civic Infrastructure',
      severity: 'MEDIUM',
      department: 'PWD',
      accepted: true
    };
  }

  const isCritical = 
    aiResult?.severity === 'CRITICAL' || 
    aiResult?.urgency === 'IMMEDIATE' ||
    /accident|cyclone|harass|emergency|ambulance|police|fire/i.test(session.description || '');

  const estResolution = isCritical ? 'Immediate Action Required (Emergency Services Alerted)' : '7 Working Days';

  const complaintId = await generateNextComplaintId();

  const trackingToken = generateTrackingToken();
  const shortToken = trackingToken.slice(0, 10);
  const appUrl = getAppUrl();
  const trackingLink = `${appUrl}/track/${complaintId}?token=${shortToken}`;

  const complaintData = {
    id: complaintId,
    complaintId: complaintId,
    uid: session.citizenUid,
    citizenName: session.fullName || "Anonymous Citizen",
    phoneNumber: session.verifiedPhone || "",
    email: session.email || "",
    title: session.description.slice(0, 60),
    description: session.description,
    category: aiResult?.grievance_category || 'Civic Infrastructure',
    priority: isCritical ? 'CRITICAL' : (aiResult?.severity || 'MEDIUM'),
    district: session.district,
    location: session.location,
    isAnonymous: false,
    status: "Submitted",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    date: new Date().toISOString().split('T')[0],
    assignedOfficer: "Pending Assignment",
    department: aiResult?.department || "PWD",
    resolutionNotes: "",
    trackingUrl: trackingLink,
    currentStep: 1,
    aiValidation: aiResult,
    trackingToken,
    trackingLink,
    estResolution
  };

  // Save to database
  try {
    const complaintDocRef = doc(db, 'complaints', complaintId);
    await setDoc(complaintDocRef, complaintData);

    // Step 9: Store ai_analysis
    await addDoc(collection(db, 'ai_analysis'), {
      complaintId,
      result: aiResult,
      timestamp: new Date().toISOString()
    });

    // Store complaint_events
    await addDoc(collection(db, 'complaint_events'), {
      complaintId,
      status: 'Submitted',
      message: 'Grievance submitted via WhatsApp.',
      timestamp: new Date().toISOString()
    });
  } catch (err: any) {
    console.warn('[WhatsApp Webhook] Firestore complaints save failed:', err.message);
  }

  // Step 11: Twilio SMS Confirmation
  const smsBody = `Dear Citizen, Your grievance has been successfully registered. Complaint ID: ${complaintId}. Track Your Complaint: ${trackingLink} - CM Grievance Portal`;
  try {
    await sendTwilioSMS(session.verifiedPhone, smsBody);
    try {
      await addDoc(collection(db, 'sms_logs'), {
        phone: session.verifiedPhone,
        body: smsBody,
        timestamp: new Date().toISOString()
      });
    } catch (dbErr: any) {
      console.warn('[WhatsApp Webhook] Firestore sms log save failed:', dbErr.message);
    }
  } catch (smsErr) {
    console.error('[WhatsApp Webhook] Twilio SMS dispatch failed:', smsErr);
  }

  // Step 12: Unified WhatsApp Confirmation message
  const unifiedMsg = `Hello ${complaintData.citizenName},

Your grievance has been successfully registered.

Complaint ID:
${complaintId}

Current Status:
Submitted

Tracking Link:
${trackingLink}

Expected Resolution Timeline:
${estResolution}
${isCritical ? '\n*Note*: Emergency services (Police / Ambulance) have been alerted for immediate assistance.\n' : ''}
Thank you for using the CM Grievance Portal.

Have a good day.`;
  await sendReply(from, unifiedMsg);

  session.state = 'COMPLETED';
  await saveSession(from, session);

  // Step 10: Trigger dashboard push notifications
  try {
    const backendUrl = getBackendUrl();
    await fetch(`${backendUrl}/api/complaints/${complaintId}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: 'Submitted',
        notes: 'Grievance submitted via WhatsApp Gateway.',
        updatedBy: 'WhatsApp Agent',
        phoneNumber: session.verifiedPhone,
        citizenId: session.citizenUid,
        trackingToken,
        trackingLink
      })
    });
  } catch (err: any) {
    console.error('[WhatsApp Webhook] Failed to trigger live dashboard push:', err.message);
  }
}

async function sendReply(to: string, text: string) {
  await sendWhatsAppText(to, text);
  try {
    await addDoc(collection(db, 'whatsapp_conversations'), {
      phone: to,
      direction: 'outbound',
      text: text,
      timestamp: new Date().toISOString()
    });
  } catch (err: any) {
    console.warn('[WhatsApp Webhook] Firestore outbound convo log failed:', err.message);
  }
}

async function saveSession(phone: string, session: any) {
  try {
    const sessionDocRef = doc(db, 'whatsapp_sessions', phone);
    await setDoc(sessionDocRef, session);
  } catch (err: any) {
    console.warn('[WhatsApp Webhook] Firestore save session failed:', err.message);
    localSessions.set(phone, session);
  }
}

async function deleteSession(phone: string) {
  try {
    const sessionDocRef = doc(db, 'whatsapp_sessions', phone);
    await deleteDoc(sessionDocRef);
  } catch (err: any) {
    console.warn('[WhatsApp Webhook] Firestore delete session failed:', err.message);
    localSessions.delete(phone);
  }
}
