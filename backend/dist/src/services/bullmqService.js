"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initSMSQueue = initSMSQueue;
exports.getSMSQueue = getSMSQueue;
exports.isRedisConnected = isRedisConnected;
exports.closeRedis = closeRedis;
const bullmq_1 = require("bullmq");
const ioredis_1 = __importDefault(require("ioredis"));
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
const twilioService_1 = require("./twilioService");
const databaseService_1 = require("./databaseService");
const templateManager_1 = require("./templateManager");
const urlHelper_1 = require("./urlHelper");
dotenv_1.default.config({ path: path_1.default.join(__dirname, '../../frontend/.env') });
const REDIS_HOST = process.env.REDIS_HOST || '127.0.0.1';
const REDIS_PORT = parseInt(process.env.REDIS_PORT || '6379', 10);
const REDIS_PASSWORD = process.env.REDIS_PASSWORD || undefined;
let redisConnection = null;
let smsQueue = null;
let smsWorker = null;
let useRedisQueue = false;
// Local in-memory queue fallback
class InMemorySMSQueue {
    jobs = [];
    isProcessing = false;
    async addSMSJob(payload) {
        const jobLogId = `sms_${Math.floor(100000 + Math.random() * 900000)}`;
        const appUrl = (0, urlHelper_1.getBackendAppUrl)();
        const trackingUrl = payload.trackingLink || (payload.trackingToken ? `${appUrl}/track/${payload.trackingToken}` : `${appUrl}/track/${payload.complaintId}`);
        const messageText = (0, templateManager_1.renderTemplate)(payload.template, {
            complaintId: payload.complaintId,
            category: payload.category,
            department: payload.department || 'General Department',
            trackingUrl: trackingUrl
        });
        console.log(`[BullMQ Fallback] Creating Log: ${jobLogId} with status 'Queued'`);
        // Log immediately as Queued
        await (0, databaseService_1.logSMS)({
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
    processNext() {
        if (this.isProcessing || this.jobs.length === 0)
            return;
        this.isProcessing = true;
        setTimeout(async () => {
            const job = this.jobs.shift();
            if (!job) {
                this.isProcessing = false;
                return;
            }
            const { payload, attempts } = job;
            const appUrl = (0, urlHelper_1.getBackendAppUrl)();
            const trackingUrl = payload.trackingLink || (payload.trackingToken ? `${appUrl}/track/${payload.trackingToken}` : `${appUrl}/track/${payload.complaintId}`);
            const messageText = (0, templateManager_1.renderTemplate)(payload.template, {
                complaintId: payload.complaintId,
                category: payload.category,
                department: payload.department || 'General Department',
                trackingUrl: trackingUrl
            });
            console.log(`[BullMQ Fallback] Dequeued SMS Job. Attempt ${attempts}/4...`);
            try {
                const result = await (0, twilioService_1.sendTwilioSMS)(payload.phoneNumber, messageText);
                // Update database with Twilio SID and Sent status
                await (0, databaseService_1.logSMS)({
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
            }
            catch (error) {
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
                }
                else {
                    console.error(`[BullMQ Fallback] Max retries (3) reached. SMS marked as Failed.`);
                    await (0, databaseService_1.logSMS)({
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
class RedisSMSQueue {
    async addSMSJob(payload) {
        if (!smsQueue)
            throw new Error('BullMQ SMS Queue not initialized.');
        const jobLogId = `sms_${Math.floor(100000 + Math.random() * 900000)}`;
        const appUrl = (0, urlHelper_1.getBackendAppUrl)();
        const trackingUrl = payload.trackingLink || (payload.trackingToken ? `${appUrl}/track/${payload.trackingToken}` : `${appUrl}/track/${payload.complaintId}`);
        const messageText = (0, templateManager_1.renderTemplate)(payload.template, {
            complaintId: payload.complaintId,
            category: payload.category,
            department: payload.department || 'General Department',
            trackingUrl: trackingUrl
        });
        // 1. Save Log entry immediately with status 'Queued'
        await (0, databaseService_1.logSMS)({
            id: jobLogId,
            complaintId: payload.complaintId,
            citizenId: payload.citizenId,
            phoneNumber: payload.phoneNumber,
            message: messageText,
            status: 'Queued'
        });
        // 2. Add to BullMQ with custom backoff strategy name
        await smsQueue.add('send-sms', { ...payload, jobLogId, messageText }, {
            attempts: 4, // 1 original + 3 retries
            backoff: {
                type: 'smsBackoff'
            },
            removeOnComplete: true,
            removeOnFail: false
        });
    }
}
let activeSMSQueue;
/**
 * Initializes the BullMQ and ioredis connection.
 * Falls back to memory-only runner if Redis is offline.
 */
async function initSMSQueue() {
    if (activeSMSQueue)
        return activeSMSQueue;
    console.log('[BullMQ Service] Connecting to Redis...');
    try {
        redisConnection = new ioredis_1.default({
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
        smsQueue = new bullmq_1.Queue('sms-notifications', {
            connection: connectionConfig
        });
        // Initialize BullMQ Worker
        smsWorker = new bullmq_1.Worker('sms-notifications', async (job) => {
            const { complaintId, phoneNumber, template, citizenId, category, department, jobLogId, messageText } = job.data;
            const attempt = job.attemptsMade + 1;
            console.log(`[BullMQ Worker] Processing Job ${job.id} for ${complaintId}. Attempt ${attempt}/4`);
            // Trigger SMS sending via Twilio Service
            const result = await (0, twilioService_1.sendTwilioSMS)(phoneNumber, messageText);
            // Update initial logged entry with twilio details
            await (0, databaseService_1.logSMS)({
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
        }, {
            connection: connectionConfig,
            settings: {
                // Custom Backoff strategy configuration: 1m, 5m, 15m
                backoffStrategy(attemptsMade) {
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
        });
        // Register job failure logger
        smsWorker.on('failed', async (job, err) => {
            if (job) {
                const { complaintId, phoneNumber, citizenId, messageText, jobLogId } = job.data;
                console.error(`[BullMQ Worker] Job ${job.id} failed after attempts:`, err.message);
                if (job.attemptsMade >= 4) {
                    console.error(`[BullMQ Worker] Max retries exceeded for job ${job.id}. Marking SMS as Failed.`);
                    await (0, databaseService_1.logSMS)({
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
    }
    catch (error) {
        console.warn('[BullMQ Service] Redis setup failed. Falling back to Asynchronous In-Memory SMS Queue.', error.message);
        if (redisConnection) {
            try {
                redisConnection.disconnect();
            }
            catch (e) {
                // Already closed
            }
        }
        activeSMSQueue = new InMemorySMSQueue();
    }
    return activeSMSQueue;
}
function getSMSQueue() {
    if (!activeSMSQueue) {
        activeSMSQueue = new InMemorySMSQueue();
    }
    return activeSMSQueue;
}
function isRedisConnected() {
    return useRedisQueue;
}
async function closeRedis() {
    if (redisConnection) {
        console.log('[BullMQ Service] Disconnecting from Redis...');
        try {
            await redisConnection.quit();
        }
        catch (e) {
            // Ignored if already closed
        }
        redisConnection = null;
        useRedisQueue = false;
    }
    if (smsQueue) {
        try {
            await smsQueue.close();
        }
        catch (e) { }
        smsQueue = null;
    }
    if (smsWorker) {
        try {
            await smsWorker.close();
        }
        catch (e) { }
        smsWorker = null;
    }
}
