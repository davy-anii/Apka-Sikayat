"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initDatabase = initDatabase;
exports.logSMS = logSMS;
exports.updateSMSStatus = updateSMSStatus;
exports.getSMSLogs = getSMSLogs;
exports.getSMSStats = getSMSStats;
exports.isPostgresConnected = isPostgresConnected;
exports.closeDatabase = closeDatabase;
const pg_1 = require("pg");
const firebaseAdmin_1 = require("../config/firebaseAdmin");
const cryptoService_1 = require("./cryptoService");
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
dotenv_1.default.config({ path: path_1.default.join(__dirname, '../../frontend/.env') });
const PG_HOST = process.env.PGHOST || '127.0.0.1';
const PG_PORT = parseInt(process.env.PGPORT || '5432', 10);
const PG_USER = process.env.PGUSER || 'postgres';
const PG_PASSWORD = process.env.PGPASSWORD || '';
const PG_DATABASE = process.env.PGDATABASE || 'apka_sikayat';
let pgPool = null;
let usePostgres = false;
// Initialize Database connection
async function initDatabase() {
    // Only try Postgres if PGPASSWORD or other params are explicitly defined,
    // otherwise default directly to Firestore to prevent startup delays.
    if (process.env.PGPASSWORD || process.env.PGHOST) {
        try {
            pgPool = new pg_1.Pool({
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
        }
        catch (error) {
            console.warn('[Database Service] PostgreSQL connection failed. Falling back to Firestore.', error.message);
            pgPool = null;
            usePostgres = false;
        }
    }
    else {
        console.log('[Database Service] PostgreSQL credentials not found. Defaulting to Firestore for logs.');
        usePostgres = false;
    }
}
/**
 * Creates a log entry in PostgreSQL or Firestore, encrypting the phone number.
 */
async function logSMS(data) {
    const encryptedPhone = (0, cryptoService_1.encrypt)(data.phoneNumber);
    if (usePostgres && pgPool) {
        try {
            await pgPool.query(`INSERT INTO sms_logs (id, complaint_id, citizen_id, phone_number, message, status, twilio_sid, error_message, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`, [data.id, data.complaintId, data.citizenId, encryptedPhone, data.message, data.status, data.twilioSid || null, data.errorMessage || null]);
            console.log(`[Database Service] Saved SMS log ${data.id} to PostgreSQL.`);
            return;
        }
        catch (error) {
            console.error('[Database Service] Failed to save log in PostgreSQL:', error.message);
        }
    }
    // Fallback: Firestore
    if (firebaseAdmin_1.isFirebaseAdminInitialized && firebaseAdmin_1.adminDb) {
        try {
            await firebaseAdmin_1.adminDb.collection('sms_logs').doc(data.id).set({
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
        }
        catch (error) {
            console.error('[Database Service] Failed to save log in Firestore:', error.message);
        }
    }
    else {
        console.log(`[Database Service] [Simulation] SMS logged in memory: ${JSON.stringify(data)}`);
    }
}
/**
 * Updates status of an SMS log using Twilio SID.
 */
async function updateSMSStatus(twilioSid, status, errorMessage) {
    console.log(`[Database Service] Updating SMS logs with twilioSid ${twilioSid} to status ${status}`);
    if (usePostgres && pgPool) {
        try {
            const result = await pgPool.query(`UPDATE sms_logs SET status = $1, error_message = $2 WHERE twilio_sid = $3`, [status, errorMessage || null, twilioSid]);
            if (result.rowCount && result.rowCount > 0) {
                console.log(`[Database Service] Updated ${result.rowCount} records in PostgreSQL.`);
                return;
            }
        }
        catch (error) {
            console.error('[Database Service] Failed to update PostgreSQL SMS status:', error.message);
        }
    }
    // Fallback: Firestore query
    if (firebaseAdmin_1.isFirebaseAdminInitialized && firebaseAdmin_1.adminDb) {
        try {
            const querySnapshot = await firebaseAdmin_1.adminDb.collection('sms_logs')
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
            }
            else {
                console.warn(`[Database Service] No Firestore document found with twilioSid: ${twilioSid}`);
            }
        }
        catch (error) {
            console.error('[Database Service] Failed to update Firestore SMS status:', error.message);
        }
    }
}
/**
 * Retrieves paginated SMS logs, decrypting phone numbers.
 */
async function getSMSLogs(limitVal = 20, offset = 0) {
    if (usePostgres && pgPool) {
        try {
            const totalRes = await pgPool.query('SELECT COUNT(*) FROM sms_logs');
            const total = parseInt(totalRes.rows[0].count, 10);
            const logsRes = await pgPool.query(`SELECT * FROM sms_logs ORDER BY created_at DESC LIMIT $1 OFFSET $2`, [limitVal, offset]);
            const logs = logsRes.rows.map(row => ({
                id: row.id,
                complaintId: row.complaint_id,
                citizenId: row.citizen_id,
                phoneNumber: (0, cryptoService_1.decrypt)(row.phone_number),
                message: row.message,
                status: row.status,
                twilioSid: row.twilio_sid,
                errorMessage: row.error_message,
                createdAt: row.created_at
            }));
            return { logs, total };
        }
        catch (error) {
            console.error('[Database Service] PostgreSQL getSMSLogs error:', error.message);
        }
    }
    // Fallback: Firestore
    if (firebaseAdmin_1.isFirebaseAdminInitialized && firebaseAdmin_1.adminDb) {
        try {
            const snapshot = await firebaseAdmin_1.adminDb.collection('sms_logs')
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
                    phoneNumber: (0, cryptoService_1.decrypt)(data.phoneNumber),
                    message: data.message,
                    status: data.status,
                    twilioSid: data.twilioSid,
                    errorMessage: data.errorMessage,
                    createdAt: data.createdAt
                };
            });
            return { logs, total };
        }
        catch (error) {
            console.error('[Database Service] Firestore getSMSLogs error:', error.message);
        }
    }
    return { logs: [], total: 0 };
}
/**
 * Aggregates statistics for the dashboard.
 */
async function getSMSStats() {
    const stats = { queued: 0, sent: 0, delivered: 0, failed: 0, total: 0 };
    if (usePostgres && pgPool) {
        try {
            const res = await pgPool.query(`SELECT status, COUNT(*) as count FROM sms_logs GROUP BY status`);
            res.rows.forEach(row => {
                const st = row.status.toLowerCase();
                if (st in stats) {
                    stats[st] = parseInt(row.count, 10);
                }
            });
            stats.total = Object.values(stats).reduce((a, b) => a + b, 0) - stats.total;
            return stats;
        }
        catch (error) {
            console.error('[Database Service] PostgreSQL getSMSStats error:', error.message);
        }
    }
    // Fallback: Firestore
    if (firebaseAdmin_1.isFirebaseAdminInitialized && firebaseAdmin_1.adminDb) {
        try {
            const snapshot = await firebaseAdmin_1.adminDb.collection('sms_logs').get();
            snapshot.docs.forEach(doc => {
                const data = doc.data();
                const st = (data.status || '').toLowerCase();
                if (st in stats) {
                    stats[st]++;
                }
                stats.total++;
            });
            return stats;
        }
        catch (error) {
            console.error('[Database Service] Firestore getSMSStats error:', error.message);
        }
    }
    return stats;
}
function isPostgresConnected() {
    return usePostgres && pgPool !== null;
}
async function closeDatabase() {
    if (pgPool) {
        console.log('[Database Service] Closing PostgreSQL connection pool...');
        await pgPool.end();
        pgPool = null;
        usePostgres = false;
    }
}
