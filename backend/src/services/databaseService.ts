import { Pool } from 'pg';
import { isFirebaseAdminInitialized, adminDb } from '../config/firebaseAdmin';
import { encrypt, decrypt } from './cryptoService';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../../frontend/.env') });

const PG_HOST = process.env.PGHOST || '127.0.0.1';
const PG_PORT = parseInt(process.env.PGPORT || '5432', 10);
const PG_USER = process.env.PGUSER || 'postgres';
const PG_PASSWORD = process.env.PGPASSWORD || '';
const PG_DATABASE = process.env.PGDATABASE || 'apka_sikayat';

let pgPool: Pool | null = null;
let usePostgres = false;

// Initialize Database connection
export async function initDatabase(): Promise<void> {
  // Only try Postgres if PGPASSWORD or other params are explicitly defined,
  // otherwise default directly to Firestore to prevent startup delays.
  if (process.env.PGPASSWORD || process.env.PGHOST) {
    try {
      pgPool = new Pool({
        host: PG_HOST,
        port: PG_PORT,
        user: PG_USER,
        password: PG_PASSWORD,
        database: PG_DATABASE,
        connectionTimeoutMillis: 2000
      });

      // Test connection
      const client = await pgPool.connect();
      client.release();
      usePostgres = true;
      console.log('[Database Service] Connected to PostgreSQL. Creating tables if not exist...');

      // DDL Query
      await pgPool.query(`
        CREATE TABLE IF NOT EXISTS sms_logs (
          id VARCHAR(50) PRIMARY KEY,
          complaint_id VARCHAR(50) NOT NULL,
          citizen_id VARCHAR(50) NOT NULL,
          phone_number VARCHAR(256) NOT NULL,
          message TEXT NOT NULL,
          status VARCHAR(20) NOT NULL,
          twilio_sid VARCHAR(100),
          error_message TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS idx_sms_twilio_sid ON sms_logs(twilio_sid);
        CREATE INDEX IF NOT EXISTS idx_sms_complaint ON sms_logs(complaint_id);
      `);
      console.log('[Database Service] PostgreSQL tables initialized.');
      return;
    } catch (error: any) {
      console.warn('[Database Service] PostgreSQL connection failed. Falling back to Firestore.', error.message);
      pgPool = null;
      usePostgres = false;
    }
  } else {
    console.log('[Database Service] PostgreSQL credentials not found. Defaulting to Firestore for logs.');
    usePostgres = false;
  }
}

export interface SMSLogData {
  id: string;
  complaintId: string;
  citizenId: string;
  phoneNumber: string; // raw phone number, will be encrypted inside service
  message: string;
  status: 'Queued' | 'Sent' | 'Delivered' | 'Failed';
  twilioSid?: string;
  errorMessage?: string;
}

/**
 * Creates a log entry in PostgreSQL or Firestore, encrypting the phone number.
 */
export async function logSMS(data: SMSLogData): Promise<void> {
  const encryptedPhone = encrypt(data.phoneNumber);
  
  if (usePostgres && pgPool) {
    try {
      await pgPool.query(
        `INSERT INTO sms_logs (id, complaint_id, citizen_id, phone_number, message, status, twilio_sid, error_message, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
        [data.id, data.complaintId, data.citizenId, encryptedPhone, data.message, data.status, data.twilioSid || null, data.errorMessage || null]
      );
      console.log(`[Database Service] Saved SMS log ${data.id} to PostgreSQL.`);
      return;
    } catch (error: any) {
      console.error('[Database Service] Failed to save log in PostgreSQL:', error.message);
    }
  }

  // Fallback: Firestore
  if (isFirebaseAdminInitialized && adminDb) {
    try {
      await adminDb.collection('sms_logs').doc(data.id).set({
        id: data.id,
        complaintId: data.complaintId,
        citizenId: data.citizenId,
        phoneNumber: encryptedPhone,
        message: data.message,
        status: data.status,
        twilioSid: data.twilioSid || null,
        errorMessage: data.errorMessage || null,
        createdAt: new Date().toISOString()
      });
      console.log(`[Database Service] Saved SMS log ${data.id} to Firestore.`);
    } catch (error: any) {
      console.error('[Database Service] Failed to save log in Firestore:', error.message);
    }
  } else {
    console.log(`[Database Service] [Simulation] SMS logged in memory: ${JSON.stringify(data)}`);
  }
}

/**
 * Updates status of an SMS log using Twilio SID.
 */
export async function updateSMSStatus(twilioSid: string, status: string, errorMessage?: string): Promise<void> {
  console.log(`[Database Service] Updating SMS logs with twilioSid ${twilioSid} to status ${status}`);

  if (usePostgres && pgPool) {
    try {
      const result = await pgPool.query(
        `UPDATE sms_logs SET status = $1, error_message = $2 WHERE twilio_sid = $3`,
        [status, errorMessage || null, twilioSid]
      );
      if (result.rowCount && result.rowCount > 0) {
        console.log(`[Database Service] Updated ${result.rowCount} records in PostgreSQL.`);
        return;
      }
    } catch (error: any) {
      console.error('[Database Service] Failed to update PostgreSQL SMS status:', error.message);
    }
  }

  // Fallback: Firestore query
  if (isFirebaseAdminInitialized && adminDb) {
    try {
      const querySnapshot = await adminDb.collection('sms_logs')
        .where('twilioSid', '==', twilioSid)
        .limit(1)
        .get();

      if (!querySnapshot.empty) {
        const docRef = querySnapshot.docs[0].ref;
        await docRef.update({
          status: status,
          errorMessage: errorMessage || null,
          updatedAt: new Date().toISOString()
        });
        console.log(`[Database Service] Updated Firestore SMS status: ${docRef.id}`);
      } else {
        console.warn(`[Database Service] No Firestore document found with twilioSid: ${twilioSid}`);
      }
    } catch (error: any) {
      console.error('[Database Service] Failed to update Firestore SMS status:', error.message);
    }
  }
}

/**
 * Retrieves paginated SMS logs, decrypting phone numbers.
 */
export async function getSMSLogs(limitVal: number = 20, offset: number = 0): Promise<{ logs: any[], total: number }> {
  if (usePostgres && pgPool) {
    try {
      const totalRes = await pgPool.query('SELECT COUNT(*) FROM sms_logs');
      const total = parseInt(totalRes.rows[0].count, 10);
      
      const logsRes = await pgPool.query(
        `SELECT * FROM sms_logs ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
        [limitVal, offset]
      );

      const logs = logsRes.rows.map(row => ({
        id: row.id,
        complaintId: row.complaint_id,
        citizenId: row.citizen_id,
        phoneNumber: decrypt(row.phone_number),
        message: row.message,
        status: row.status,
        twilioSid: row.twilio_sid,
        errorMessage: row.error_message,
        createdAt: row.created_at
      }));

      return { logs, total };
    } catch (error: any) {
      console.error('[Database Service] PostgreSQL getSMSLogs error:', error.message);
    }
  }

  // Fallback: Firestore
  if (isFirebaseAdminInitialized && adminDb) {
    try {
      const snapshot = await adminDb.collection('sms_logs')
        .orderBy('createdAt', 'desc')
        .get();

      const total = snapshot.size;
      // manual slicing for pagination
      const slicedDocs = snapshot.docs.slice(offset, offset + limitVal);

      const logs = slicedDocs.map(doc => {
        const data = doc.data();
        return {
          id: data.id,
          complaintId: data.complaintId,
          citizenId: data.citizenId,
          phoneNumber: decrypt(data.phoneNumber),
          message: data.message,
          status: data.status,
          twilioSid: data.twilioSid,
          errorMessage: data.errorMessage,
          createdAt: data.createdAt
        };
      });

      return { logs, total };
    } catch (error: any) {
      console.error('[Database Service] Firestore getSMSLogs error:', error.message);
    }
  }

  return { logs: [], total: 0 };
}

/**
 * Aggregates statistics for the dashboard.
 */
export async function getSMSStats(): Promise<any> {
  const stats = { queued: 0, sent: 0, delivered: 0, failed: 0, total: 0 };

  if (usePostgres && pgPool) {
    try {
      const res = await pgPool.query(
        `SELECT status, COUNT(*) as count FROM sms_logs GROUP BY status`
      );
      res.rows.forEach(row => {
        const st = row.status.toLowerCase();
        if (st in stats) {
          (stats as any)[st] = parseInt(row.count, 10);
        }
      });
      stats.total = Object.values(stats).reduce((a, b) => a + b, 0) - stats.total;
      return stats;
    } catch (error: any) {
      console.error('[Database Service] PostgreSQL getSMSStats error:', error.message);
    }
  }

  // Fallback: Firestore
  if (isFirebaseAdminInitialized && adminDb) {
    try {
      const snapshot = await adminDb.collection('sms_logs').get();
      snapshot.docs.forEach(doc => {
        const data = doc.data();
        const st = (data.status || '').toLowerCase();
        if (st in stats) {
          (stats as any)[st]++;
        }
        stats.total++;
      });
      return stats;
    } catch (error: any) {
      console.error('[Database Service] Firestore getSMSStats error:', error.message);
    }
  }

  return stats;
}

export function isPostgresConnected(): boolean {
  return usePostgres && pgPool !== null;
}

export async function closeDatabase(): Promise<void> {
  if (pgPool) {
    console.log('[Database Service] Closing PostgreSQL connection pool...');
    await pgPool.end();
    pgPool = null;
    usePostgres = false;
  }
}
