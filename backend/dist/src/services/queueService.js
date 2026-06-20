"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initQueueService = initQueueService;
exports.getQueueService = getQueueService;
const bull_1 = __importDefault(require("bull"));
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
const redis_1 = require("redis");
dotenv_1.default.config({ path: path_1.default.join(__dirname, '../../frontend/.env') });
const REDIS_HOST = process.env.REDIS_HOST || '127.0.0.1';
const REDIS_PORT = parseInt(process.env.REDIS_PORT || '6379', 10);
const REDIS_PASSWORD = process.env.REDIS_PASSWORD || undefined;
// Bull Redis Queue implementation
class BullQueueService {
    queue;
    constructor() {
        this.queue = new bull_1.default('notification_queue', {
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
    async addNotificationJob(data) {
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
    processJobs(handler) {
        console.log('[Queue Service] [Redis] Worker started processing notification_queue...');
        this.queue.process(async (job) => {
            console.log(`[Queue Service] [Redis] Processing job ID: ${job.id}`);
            await handler(job.data);
        });
    }
}
// In-Memory Queue fallback implementation
class InMemoryQueueService {
    jobs = [];
    handler = null;
    isProcessing = false;
    async addNotificationJob(data) {
        console.log(`[Queue Service] [In-Memory] Queueing notification job for complaint ${data.complaintId}`);
        this.jobs.push(data);
        this.triggerProcessing();
    }
    processJobs(handler) {
        console.log('[Queue Service] [In-Memory] Worker started processing in-memory queue...');
        this.handler = handler;
        this.triggerProcessing();
    }
    triggerProcessing() {
        if (this.isProcessing || !this.handler || this.jobs.length === 0)
            return;
        this.isProcessing = true;
        // Process next job asynchronously after a small delay to simulate background workers
        setTimeout(async () => {
            const job = this.jobs.shift();
            if (job && this.handler) {
                try {
                    console.log(`[Queue Service] [In-Memory] Worker processing job for ${job.complaintId}`);
                    await this.handler(job);
                }
                catch (error) {
                    console.error(`[Queue Service] [In-Memory] Error processing job:`, error);
                }
            }
            this.isProcessing = false;
            this.triggerProcessing();
        }, 1500); // 1.5 second background latency simulation
    }
}
let activeQueueService;
let isRedisAvailable = false;
async function initQueueService() {
    if (activeQueueService)
        return activeQueueService;
    console.log('[Queue Service] Connecting to Redis pre-flight check...');
    try {
        const client = (0, redis_1.createClient)({
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
    }
    catch (error) {
        console.warn('[Queue Service] Redis connection failed. Falling back to Asynchronous In-Memory Queue.');
        activeQueueService = new InMemoryQueueService();
    }
    return activeQueueService;
}
function getQueueService() {
    if (!activeQueueService) {
        // Return standard fallback synchronous init (will be overridden on main initialization)
        activeQueueService = new InMemoryQueueService();
    }
    return activeQueueService;
}
