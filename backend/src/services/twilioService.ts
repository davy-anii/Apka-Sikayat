import twilio from 'twilio';
import dotenv from 'dotenv';
import path from 'path';

import fs from 'fs';
let envPath = path.join(__dirname, '../../frontend/.env');
if (!fs.existsSync(envPath)) {
  envPath = path.join(__dirname, '../../../frontend/.env');
}
dotenv.config({ path: envPath });

const ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const PHONE_NUMBER = process.env.TWILIO_PHONE_NUMBER;
const CALLBACK_URL = process.env.TWILIO_STATUS_CALLBACK_URL;

let twilioClient: twilio.Twilio | null = null;

try {
  if (ACCOUNT_SID && AUTH_TOKEN) {
    twilioClient = twilio(ACCOUNT_SID, AUTH_TOKEN);
    console.log('[Twilio Service] Twilio Client initialized successfully.');
  } else {
    console.warn('[Twilio Service] Warning: Missing Twilio credentials. SMS will run in simulator mode.');
  }
} catch (error: any) {
  console.error('[Twilio Service] Error initializing Twilio client:', error.message);
}

export interface TwilioSendResult {
  sid: string;
  status: 'queued' | 'sent' | 'failed';
  errorMessage?: string;
}

/**
 * Sends an SMS using the Twilio REST API.
 * Throws an error on API failure so BullMQ can trigger the retry policy.
 */
export async function sendTwilioSMS(to: string, body: string): Promise<TwilioSendResult> {
  console.log(`[Twilio Service] Sending SMS to ${to} (Body length: ${body.length})...`);

  if (!twilioClient) {
    // Simulator Mode
    console.log('[Twilio Service] [Simulator] Credentials missing. Logging SMS mock dispatch.');
    const mockSid = `SM${crypto.randomUUID().replace(/-/g, '')}`;
    return {
      sid: mockSid,
      status: 'queued'
    };
  }

  try {
    let formattedTo = to.trim().replace(/[\s\-\(\)]/g, '');
    if (!formattedTo.startsWith('+')) {
      if (formattedTo.startsWith('0')) {
        formattedTo = formattedTo.substring(1);
      }
      if (formattedTo.length === 10) {
        formattedTo = `+91${formattedTo}`;
      } else if (formattedTo.length === 12 && formattedTo.startsWith('91')) {
        formattedTo = `+${formattedTo}`;
      } else {
        formattedTo = `+${formattedTo}`;
      }
    }
    const fromNumber = PHONE_NUMBER || '';
    const formattedFrom = fromNumber.startsWith('+') ? fromNumber : `+${fromNumber}`;

    let statusCallback = CALLBACK_URL;
    if (statusCallback) {
      const isLocal = statusCallback.includes('localhost') || statusCallback.includes('127.0.0.1');
      if (isLocal) {
        const ngrokUrl = process.env.NGROK_PUBLIC_URL || process.env.NEXT_PUBLIC_NGROK_PUBLIC_URL;
        if (ngrokUrl) {
          statusCallback = statusCallback
            .replace(/http:\/\/localhost:\d+/, ngrokUrl)
            .replace(/http:\/\/127.0.0.1:\d+/, ngrokUrl);
          console.log(`[Twilio Service] Replaced local callback with ngrok callback: ${statusCallback}`);
        } else {
          console.log(`[Twilio Service] Omitted local statusCallback since no public NGROK_PUBLIC_URL is configured.`);
          statusCallback = undefined;
        }
      }
    }

    const msgConfig: any = {
      body: body,
      from: formattedFrom,
      to: formattedTo
    };

    if (statusCallback) {
      msgConfig.statusCallback = statusCallback;
    }

    const response = await twilioClient.messages.create(msgConfig);

    console.log(`[Twilio Service] Twilio API success. Message SID: ${response.sid}, Status: ${response.status}`);

    // Status can be queued, sending, sent, failed, etc.
    return {
      sid: response.sid,
      status: response.status === 'failed' ? 'failed' : 'queued',
      errorMessage: response.errorMessage || undefined
    };
  } catch (error: any) {
    console.error(`[Twilio Service] Twilio API call failed:`, error.message);
    throw new Error(`Twilio delivery failed: ${error.message}`);
  }
}

/**
 * Initiates an automated interactive voice call to ask the citizen for details.
 */
export async function makeAIVoiceCall(to: string, complaintId: string, title: string): Promise<any> {
  console.log(`[Twilio Service] Initiating Voice call to ${to} for complaint ${complaintId}...`);

  let formattedTo = to.trim().replace(/[\s\-\(\)]/g, '');
  if (!formattedTo.startsWith('+')) {
    if (formattedTo.startsWith('0')) formattedTo = formattedTo.substring(1);
    if (formattedTo.length === 10) formattedTo = `+91${formattedTo}`;
    else formattedTo = `+${formattedTo}`;
  }

  const fromNumber = PHONE_NUMBER || '+12565888126';
  const formattedFrom = fromNumber.startsWith('+') ? fromNumber : `+${fromNumber}`;

  if (!twilioClient) {
    console.log('[Twilio Service] [Simulator] Logging mock Voice call trigger.');
    return { sid: `CA${Math.random().toString(36).substring(7)}`, status: 'queued' };
  }

  try {
    const call = await twilioClient.calls.create({
      twiml: `<Response>
        <Say voice="alice">Hello Citizen, thank you for submitting your grievance regarding ${title || 'your request'}. We have successfully registered your complaint under ID ${complaintId}.</Say>
        <Say voice="alice">Could you please tell me, where is the location exactly now, and what is the exact matter which is held in now?</Say>
        <Record maxLength="20" playBeep="true" />
        <Say voice="alice">Thank you for your feedback. Our AI validation engine has successfully recorded your response and verified your grievance.</Say>
      </Response>`,
      to: formattedTo,
      from: formattedFrom
    });

    console.log(`[Twilio Service] Voice call initiated successfully. Call SID: ${call.sid}`);
    return { sid: call.sid, status: 'queued' };
  } catch (err: any) {
    console.error('[Twilio Service] Voice call creation failed:', err.message);
    return { error: err.message };
  }
}
