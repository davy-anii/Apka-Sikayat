"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initRateLimiter = initRateLimiter;
exports.checkRateLimit = checkRateLimit;
const ioredis_1 = __importDefault(require("ioredis"));
const firebaseAdmin_1 = require("../config/firebaseAdmin");
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
dotenv_1.default.config({ path: path_1.default.join(__dirname, '../../frontend/.env') });
const REDIS_HOST = process.env.REDIS_HOST || '127.0.0.1';
const REDIS_PORT = parseInt(process.env.REDIS_PORT || '6379', 10);
const REDIS_PASSWORD = process.env.REDIS_PASSWORD || undefined;
let redisClient = null;
let useRedisForRateLimiting = false;
// Initialize Redis for rate limiting
async function initRateLimiter() {
    // Only attempt if explicit parameters are configured
    if (process.env.REDIS_HOST) {
        try {
            redisClient = new ioredis_1.default({
                host: REDIS_HOST,
                port: REDIS_PORT,
                password: REDIS_PASSWORD,
                connectTimeout: 2000,
                maxRetriesPerRequest: 1
            });
            await redisClient.ping();
            useRedisForRateLimiting = true;
            console.log('[Rate Limiter] Connected to Redis for SMS rate limiting.');
        }
        catch (err) {
            console.warn('[Rate Limiter] Redis connection failed. Falling back to Firestore for rate limiting.', err.message);
            redisClient = null;
            useRedisForRateLimiting = false;
        }
    }
    else {
        useRedisForRateLimiting = false;
    }
}
/**
 * Checks if a citizen has exceeded the daily limit of 20 SMS.
 * Increments the count if check passes.
 * Returns true if allowed, false if rate limited.
 */
async function checkRateLimit(citizenId) {
    const limitMax = 20;
    const todayStr = new Date().toISOString().split('T')[0]; // "YYYY-MM-DD"
    const rateLimitKey = `sms_limit:${citizenId}:${todayStr}`;
    console.log(`[Rate Limiter] Checking SMS rate limit for citizen ${citizenId}`);
    // 1. Redis implementation
    if (useRedisForRateLimiting && redisClient) {
        try {
            const count = await redisClient.incr(rateLimitKey);
            if (count === 1) {
                // Set TTL to expire at the end of the day (24 hours is safe)
                await redisClient.expire(rateLimitKey, 86400);
            }
            if (count > limitMax) {
                console.warn(`[Rate Limiter] [LIMIT EXCEEDED] Citizen ${citizenId} hit daily limit of ${count}/${limitMax} via Redis.`);
                return false;
            }
            return true;
        }
        catch (error) {
            console.error('[Rate Limiter] Redis error, falling back to Firestore check:', error.message);
        }
    }
    // 2. Firestore implementation fallback
    if (firebaseAdmin_1.isFirebaseAdminInitialized && firebaseAdmin_1.adminDb) {
        try {
            const rateLimitRef = firebaseAdmin_1.adminDb.collection('users').doc(citizenId).collection('rate_limits').doc('sms_daily');
            const isAllowed = await firebaseAdmin_1.adminDb.runTransaction(async (transaction) => {
                const docSnap = await transaction.get(rateLimitRef);
                if (!docSnap.exists) {
                    transaction.set(rateLimitRef, {
                        count: 1,
                        date: todayStr,
                        updatedAt: new Date().toISOString()
                    });
                    return true;
                }
                const data = docSnap.data();
                const currentCount = data?.count || 0;
                const currentDate = data?.date || '';
                if (currentDate === todayStr) {
                    if (currentCount >= limitMax) {
                        return false; // Limit exceeded!
                    }
                    transaction.update(rateLimitRef, {
                        count: currentCount + 1,
                        updatedAt: new Date().toISOString()
                    });
                    return true;
                }
                else {
                    // Date has changed, reset counter
                    transaction.set(rateLimitRef, {
                        count: 1,
                        date: todayStr,
                        updatedAt: new Date().toISOString()
                    });
                    return true;
                }
            });
            if (!isAllowed) {
                console.warn(`[Rate Limiter] [LIMIT EXCEEDED] Citizen ${citizenId} hit daily limit of ${limitMax} via Firestore.`);
            }
            return isAllowed;
        }
        catch (error) {
            console.error('[Rate Limiter] Firestore transaction failed:', error.message);
            return true; // Fallback to allowing in case of database issue
        }
    }
    // 3. Simple In-Memory simulation fallback
    return true;
}
