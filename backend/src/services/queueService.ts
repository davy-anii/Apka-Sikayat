import Queue from 'bull';
import dotenv from 'dotenv';
import path from 'path';
import { createClient } from 'redis';

import fs from 'fs';
let envPath = path.join(__dirname, '../../frontend/.env');
if (!fs.existsSync(envPath)) {
  envPath = path.join(__dirname, '../../../frontend/.env');
}
dotenv.config({ path: envPath });

const REDIS_HOST = process.env.REDIS_HOST || '127.0.0.1';
const REDIS_PORT = parseInt(process.env.REDIS_PORT || '6379', 10);
const REDIS_PASSWORD = process.env.REDIS_PASSWORD || undefined;

export interface NotificationJobData {
  complaintId: string;
  status: string;
  updatedBy: string;
  notes?: string;
  recipientUid: string;
  recipientPhone?: string;
  category: string;
  department?: string;
}

// Queue Interface
export interface IQueueService {
  addNotificationJob(data: NotificationJobData): Promise<void>;
  processJobs(handler: (data: NotificationJobData) => Promise<void>): void;
}

// Bull Redis Queue implementation
class BullQueueService implements IQueueService {
  private queue: Queue.Queue;

  constructor() {
    this.queue = new Queue('notification_queue', {
      redis: {
        host: REDIS_HOST,
        port: REDIS_PORT,
        password: REDIS_PASSWORD,
        maxRetriesPerRequest: 1,
        connectTimeout: 2000
      }
    });

    this.queue.on('error', (error) => {
      console.error('[Queue Service] Bull Queue error:', error.message);
    });
  }

  async addNotificationJob(data: NotificationJobData): Promise<void> {
    console.log(`[Queue Service] [Redis] Queueing notification job for complaint ${data.complaintId}`);
    await this.queue.add(data, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 5000
      },
      removeOnComplete: true
    });
  }

  processJobs(handler: (data: NotificationJobData) => Promise<void>): void {
    console.log('[Queue Service] [Redis] Worker started processing notification_queue...');
    this.queue.process(async (job) => {
      console.log(`[Queue Service] [Redis] Processing job ID: ${job.id}`);
      await handler(job.data);
    });
  }
}

// In-Memory Queue fallback implementation
class InMemoryQueueService implements IQueueService {
  private jobs: NotificationJobData[] = [];
  private handler: ((data: NotificationJobData) => Promise<void>) | null = null;
  private isProcessing = false;

  async addNotificationJob(data: NotificationJobData): Promise<void> {
    console.log(`[Queue Service] [In-Memory] Queueing notification job for complaint ${data.complaintId}`);
    this.jobs.push(data);
    this.triggerProcessing();
  }

  processJobs(handler: (data: NotificationJobData) => Promise<void>): void {
    console.log('[Queue Service] [In-Memory] Worker started processing in-memory queue...');
    this.handler = handler;
    this.triggerProcessing();
  }

  private triggerProcessing() {
    if (this.isProcessing || !this.handler || this.jobs.length === 0) return;
    
    this.isProcessing = true;
    
    // Process next job asynchronously after a small delay to simulate background workers
    setTimeout(async () => {
      const job = this.jobs.shift();
      if (job && this.handler) {
        try {
          console.log(`[Queue Service] [In-Memory] Worker processing job for ${job.complaintId}`);
          await this.handler(job);
        } catch (error) {
          console.error(`[Queue Service] [In-Memory] Error processing job:`, error);
        }
      }
      this.isProcessing = false;
      this.triggerProcessing();
    }, 1500); // 1.5 second background latency simulation
  }
}

let activeQueueService: IQueueService;
let isRedisAvailable = false;

export async function initQueueService(): Promise<IQueueService> {
  if (activeQueueService) return activeQueueService;

  console.log('[Queue Service] Connecting to Redis pre-flight check...');
  
  try {
    const client = createClient({
      socket: {
        host: REDIS_HOST,
        port: REDIS_PORT,
        reconnectStrategy: false,
        connectTimeout: 2000
      },
      password: REDIS_PASSWORD
    });

    client.on('error', () => {
      // Catch and ignore inside pre-flight check to prevent unhandled rejection
    });

    await client.connect();
    await client.disconnect();
    
    isRedisAvailable = true;
    console.log('[Queue Service] Redis is online! Using Redis Bull Queue.');
    activeQueueService = new BullQueueService();
  } catch (error) {
    console.warn('[Queue Service] Redis connection failed. Falling back to Asynchronous In-Memory Queue.');
    activeQueueService = new InMemoryQueueService();
  }

  return activeQueueService;
}

export function getQueueService(): IQueueService {
  if (!activeQueueService) {
    // Return standard fallback synchronous init (will be overridden on main initialization)
    activeQueueService = new InMemoryQueueService();
  }
  return activeQueueService;
}
