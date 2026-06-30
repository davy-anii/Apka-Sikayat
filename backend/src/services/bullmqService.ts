import { Queue, Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
import dotenv from 'dotenv';
import path from 'path';
import { sendTwilioSMS } from './twilioService';
import { logSMS, updateSMSStatus, SMSLogData } from './databaseService';
import { renderTemplate } from './templateManager';
import { checkRateLimit } from './rateLimiter';
import { isFirebaseAdminInitialized, adminDb } from '../config/firebaseAdmin';
import { getBackendAppUrl } from './urlHelper';

import fs from 'fs';
let envPath = path.join(__dirname, '../../frontend/.env');
if (!fs.existsSync(envPath)) {
  envPath = path.join(__dirname, '../../../frontend/.env');
}
dotenv.config({ path: envPath });

const REDIS_HOST = process.env.REDIS_HOST || '127.0.0.1';
const REDIS_PORT = parseInt(process.env.REDIS_PORT || '6379', 10);
const REDIS_PASSWORD = process.env.REDIS_PASSWORD || undefined;

let redisConnection: IORedis | null = null;
let smsQueue: Queue | null = null;
let smsWorker: Worker | null = null;
let useRedisQueue = false;

// Interface for SMS Job payloads
export interface SMSJobPayload {
  complaintId: string;
  phoneNumber: string;
  template: string; // The status string or 'complaint-submitted'
  citizenId: string;
  category: string;
  department?: string;
  trackingToken?: string;
  trackingLink?: string;
}

// Unified Queue interface
export interface ISMSQueue {
  addSMSJob(payload: SMSJobPayload): Promise<void>;
}

// Local in-memory queue fallback
class InMemorySMSQueue implements ISMSQueue {
  private jobs: { payload: SMSJobPayload; attempts: number }[] = [];
  private isProcessing = false;

  async addSMSJob(payload: SMSJobPayload): Promise<void> {
    const jobLogId = `sms_${Math.floor(100000 + Math.random() * 900000)}`;
    const appUrl = getBackendAppUrl();
    const trackingUrl = payload.trackingLink || (payload.trackingToken ? `${appUrl}/track/${payload.trackingToken}` : `${appUrl}/track/${payload.complaintId}`);

    const messageText = renderTemplate(payload.template, {
      complaintId: payload.complaintId,
      category: payload.category,
      department: payload.department || 'General Department',
      trackingUrl: trackingUrl
    });

    console.log(`[BullMQ Fallback] Creating Log: ${jobLogId} with status 'Queued'`);
    
    // Log immediately as Queued
    await logSMS({
      id: jobLogId,
      complaintId: payload.complaintId,
      citizenId: payload.citizenId,
      phoneNumber: payload.phoneNumber,
      message: messageText,
      status: 'Queued'
    });

    this.jobs.push({ payload, attempts: 1 });
    this.processNext();
  }

  private processNext() {
    if (this.isProcessing || this.jobs.length === 0) return;
    this.isProcessing = true;

    setTimeout(async () => {
      const job = this.jobs.shift();
      if (!job) {
        this.isProcessing = false;
        return;
      }

      const { payload, attempts } = job;
      const appUrl = getBackendAppUrl();
      const trackingUrl = payload.trackingLink || (payload.trackingToken ? `${appUrl}/track/${payload.trackingToken}` : `${appUrl}/track/${payload.complaintId}`);

      const messageText = renderTemplate(payload.template, {
        complaintId: payload.complaintId,
        category: payload.category,
        department: payload.department || 'General Department',
        trackingUrl: trackingUrl
      });

      console.log(`[BullMQ Fallback] Dequeued SMS Job. Attempt ${attempts}/4...`);

      try {
        const result = await sendTwilioSMS(payload.phoneNumber, messageText);
        
        // Update database with Twilio SID and Sent status
        await logSMS({
          id: `sms_${Math.floor(100000 + Math.random() * 900000)}`, // Save delivery status log update
          complaintId: payload.complaintId,
          citizenId: payload.citizenId,
          phoneNumber: payload.phoneNumber,
          message: messageText,
          status: result.status === 'failed' ? 'Failed' : 'Sent',
          twilioSid: result.sid,
          errorMessage: result.errorMessage
        });

        // If twilio reported failed directly
        if (result.status === 'failed') {
          throw new Error('Twilio marked delivery as failed.');
        }

        console.log(`[BullMQ Fallback] Job processed successfully. Twilio SID: ${result.sid}`);
      } catch (error: any) {
        console.error(`[BullMQ Fallback] Attempt ${attempts} failed:`, error.message);
        
        if (attempts < 4) {
          // Retry scheduler: 1 attempt = retry 1 (1m), 2 attempts = retry 2 (5m), 3 attempts = retry 3 (15m)
          const delays = [60000, 300000, 900000];
          const delay = delays[attempts - 1] || 60000;
          console.log(`[BullMQ Fallback] Scheduling retry in ${delay / 1000}s...`);
          
          setTimeout(() => {
            this.jobs.push({ payload, attempts: attempts + 1 });
            this.processNext();
          }, delay);
        } else {
          console.error(`[BullMQ Fallback] Max retries (3) reached. SMS marked as Failed.`);
          await logSMS({
            id: `sms_${Math.floor(100000 + Math.random() * 900000)}`,
            complaintId: payload.complaintId,
            citizenId: payload.citizenId,
            phoneNumber: payload.phoneNumber,
            message: messageText,
            status: 'Failed',
            errorMessage: `Max retries reached: ${error.message}`
          });
        }
      }

      this.isProcessing = false;
      this.processNext();
    }, 1000);
  }
}

// BullMQ client wrapper
class RedisSMSQueue implements ISMSQueue {
  async addSMSJob(payload: SMSJobPayload): Promise<void> {
    if (!smsQueue) throw new Error('BullMQ SMS Queue not initialized.');

    const jobLogId = `sms_${Math.floor(100000 + Math.random() * 900000)}`;
    const appUrl = getBackendAppUrl();
    const trackingUrl = payload.trackingLink || (payload.trackingToken ? `${appUrl}/track/${payload.trackingToken}` : `${appUrl}/track/${payload.complaintId}`);

    const messageText = renderTemplate(payload.template, {
      complaintId: payload.complaintId,
      category: payload.category,
      department: payload.department || 'General Department',
      trackingUrl: trackingUrl
    });

    // 1. Save Log entry immediately with status 'Queued'
    await logSMS({
      id: jobLogId,
      complaintId: payload.complaintId,
      citizenId: payload.citizenId,
      phoneNumber: payload.phoneNumber,
      message: messageText,
      status: 'Queued'
    });

    // 2. Add to BullMQ with custom backoff strategy name
    await smsQueue.add(
      'send-sms',
      { ...payload, jobLogId, messageText },
      {
        attempts: 4, // 1 original + 3 retries
        backoff: {
          type: 'smsBackoff'
        },
        removeOnComplete: true,
        removeOnFail: false
      }
    );
  }
}

let activeSMSQueue: ISMSQueue;

/**
 * Initializes the BullMQ and ioredis connection.
 * Falls back to memory-only runner if Redis is offline.
 */
export async function initSMSQueue(): Promise<ISMSQueue> {
  if (activeSMSQueue) return activeSMSQueue;

  console.log('[BullMQ Service] Connecting to Redis...');

  try {
    redisConnection = new IORedis({
      host: REDIS_HOST,
      port: REDIS_PORT,
      password: REDIS_PASSWORD,
      connectTimeout: 1000,
      maxRetriesPerRequest: 1,
      retryStrategy: () => null
    });

    // Suppress unhandled ioredis connection error spam
    redisConnection.on('error', (err) => {
      // Handled in ping check
    });

    await redisConnection.ping();
    useRedisQueue = true;
    console.log('[BullMQ Service] Connected to Redis. Initializing Queue...');

    const connectionConfig = {
      host: REDIS_HOST,
      port: REDIS_PORT,
      password: REDIS_PASSWORD
    };

    // Initialize BullMQ Queue
    smsQueue = new Queue('sms-notifications', {
      connection: connectionConfig
    });

    // Initialize BullMQ Worker
    smsWorker = new Worker(
      'sms-notifications',
      async (job: Job) => {
        const { complaintId, phoneNumber, template, citizenId, category, department, jobLogId, messageText } = job.data;
        const attempt = job.attemptsMade + 1;
        console.log(`[BullMQ Worker] Processing Job ${job.id} for ${complaintId}. Attempt ${attempt}/4`);

        // Trigger SMS sending via Twilio Service
        const result = await sendTwilioSMS(phoneNumber, messageText);

        // Update initial logged entry with twilio details
        await logSMS({
          id: jobLogId,
          complaintId,
          citizenId,
          phoneNumber,
          message: messageText,
          status: result.status === 'failed' ? 'Failed' : 'Sent',
          twilioSid: result.sid,
          errorMessage: result.errorMessage
        });

        if (result.status === 'failed') {
          throw new Error(`Twilio reported failure SID: ${result.sid}`);
        }
        
        return result;
      },
      {
        connection: connectionConfig,
        settings: {
          // Custom Backoff strategy configuration: 1m, 5m, 15m
          backoffStrategy(attemptsMade: number) {
            if (attemptsMade === 1) {
              console.log('[BullMQ Worker] Retry 1 scheduled in 1 minute.');
              return 60000;
            }
            if (attemptsMade === 2) {
              console.log('[BullMQ Worker] Retry 2 scheduled in 5 minutes.');
              return 300000;
            }
            if (attemptsMade === 3) {
              console.log('[BullMQ Worker] Retry 3 scheduled in 15 minutes.');
              return 900000;
            }
            return -1; // stop retrying
          }
        }
      }
    );

    // Register job failure logger
    smsWorker.on('failed', async (job, err) => {
      if (job) {
        const { complaintId, phoneNumber, citizenId, messageText, jobLogId } = job.data;
        console.error(`[BullMQ Worker] Job ${job.id} failed after attempts:`, err.message);
        
        if (job.attemptsMade >= 4) {
          console.error(`[BullMQ Worker] Max retries exceeded for job ${job.id}. Marking SMS as Failed.`);
          await logSMS({
            id: jobLogId,
            complaintId,
            citizenId,
            phoneNumber,
            message: messageText,
            status: 'Failed',
            errorMessage: `Max retries (3) exceeded: ${err.message}`
          });
        }
      }
    });

    activeSMSQueue = new RedisSMSQueue();
  } catch (error: any) {
    console.warn('[BullMQ Service] Redis setup failed. Falling back to Asynchronous In-Memory SMS Queue.', error.message);
    if (redisConnection) {
      try {
        redisConnection.disconnect();
      } catch (e) {
        // Already closed
      }
    }
    activeSMSQueue = new InMemorySMSQueue();
  }

  return activeSMSQueue;
}

export function getSMSQueue(): ISMSQueue {
  if (!activeSMSQueue) {
    activeSMSQueue = new InMemorySMSQueue();
  }
  return activeSMSQueue;
}

export function isRedisConnected(): boolean {
  return useRedisQueue;
}

export async function closeRedis(): Promise<void> {
  if (redisConnection) {
    console.log('[BullMQ Service] Disconnecting from Redis...');
    try {
      await redisConnection.quit();
    } catch (e) {
      // Ignored if already closed
    }
    redisConnection = null;
    useRedisQueue = false;
  }
  if (smsQueue) {
    try {
      await smsQueue.close();
    } catch (e) {}
    smsQueue = null;
  }
  if (smsWorker) {
    try {
      await smsWorker.close();
    } catch (e) {}
    smsWorker = null;
  }
}
