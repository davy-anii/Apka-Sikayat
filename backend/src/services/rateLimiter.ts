import Redis from 'ioredis';
import { isFirebaseAdminInitialized, adminDb } from '../config/firebaseAdmin';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../../frontend/.env') });

const REDIS_HOST = process.env.REDIS_HOST || '127.0.0.1';
const REDIS_PORT = parseInt(process.env.REDIS_PORT || '6379', 10);
const REDIS_PASSWORD = process.env.REDIS_PASSWORD || undefined;

let redisClient: Redis | null = null;
let useRedisForRateLimiting = false;

// Initialize Redis for rate limiting
export async function initRateLimiter(): Promise<void> {
  // Only attempt if explicit parameters are configured
  if (process.env.REDIS_HOST) {
    try {
      redisClient = new Redis({
        host: REDIS_HOST,
        port: REDIS_PORT,
        password: REDIS_PASSWORD,
        connectTimeout: 2000,
        maxRetriesPerRequest: 1
      });

      await redisClient.ping();
      useRedisForRateLimiting = true;
      console.log('[Rate Limiter] Connected to Redis for SMS rate limiting.');
    } catch (err: any) {
      console.warn('[Rate Limiter] Redis connection failed. Falling back to Firestore for rate limiting.', err.message);
      redisClient = null;
      useRedisForRateLimiting = false;
    }
  } else {
    useRedisForRateLimiting = false;
  }
}

/**
 * Checks if a citizen has exceeded the daily limit of 20 SMS.
 * Increments the count if check passes.
 * Returns true if allowed, false if rate limited.
 */
export async function checkRateLimit(citizenId: string): Promise<boolean> {
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
    } catch (error: any) {
      console.error('[Rate Limiter] Redis error, falling back to Firestore check:', error.message);
    }
  }

  // 2. Firestore implementation fallback
  if (isFirebaseAdminInitialized && adminDb) {
    try {
      const rateLimitRef = adminDb.collection('users').doc(citizenId).collection('rate_limits').doc('sms_daily');
      
      const isAllowed = await adminDb.runTransaction(async (transaction) => {
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
        } else {
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
    } catch (error: any) {
      console.error('[Rate Limiter] Firestore transaction failed:', error.message);
      return true; // Fallback to allowing in case of database issue
    }
  }

  // 3. Simple In-Memory simulation fallback
  return true;
}
