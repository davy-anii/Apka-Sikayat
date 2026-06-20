import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import twilio from 'twilio';

import { createAdapter } from '@socket.io/redis-adapter';
import IORedis from 'ioredis';

// Import Services
import { updateComplaintStatusInDb } from './services/eventService';
import { initQueueService } from './services/queueService'; // Legacy dashboard fallback
import { initDatabase, logSMS, updateSMSStatus, getSMSLogs, getSMSStats, isPostgresConnected, closeDatabase } from './services/databaseService';
import { initRateLimiter, checkRateLimit } from './services/rateLimiter';
import { initSMSQueue, getSMSQueue, isRedisConnected, closeRedis } from './services/bullmqService';
import { maskPhoneNumber } from './services/cryptoService';
import { isFirebaseAdminInitialized, adminDb } from './firebaseAdmin';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../frontend/.env') });

const app = express();
const server = http.createServer(app);

// Dynamic CORS configurations
const allowedOrigins = ['http://localhost:5001', 'http://127.0.0.1:5001', 'http://localhost:3000', 'http://127.0.0.1:3000'];
if (process.env.NEXT_PUBLIC_APP_URL) {
  allowedOrigins.push(process.env.NEXT_PUBLIC_APP_URL);
}

const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Configure Socket.IO Redis Adapter for horizontal scaling if Redis is configured
if (process.env.REDIS_HOST) {
  try {
    const pubClient = new IORedis({
      host: process.env.REDIS_HOST,
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
      password: process.env.REDIS_PASSWORD || undefined,
      connectTimeout: 2000
    });
    const subClient = pubClient.duplicate();
    io.adapter(createAdapter(pubClient, subClient));
    console.log('[Socket.IO] Redis adapter initialized successfully.');
  } catch (err: any) {
    console.warn('[Socket.IO] Failed to initialize Redis adapter, falling back to in-memory.', err.message);
  }
}

app.use(cors({
  origin: allowedOrigins,
  credentials: true
}));

// Twilio webhook expects raw form-urlencoded payload for signature verification,
// but Express body-parser with json works fine for simple JSON/UrlEncoded.
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const PORT = process.env.PORT || 5002;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN || 'a6522c015840d803becc2ebb49edc4a7';

// Real-time WebSockets logic
io.on('connection', (socket) => {
  console.log(`[Socket.IO] Client connected: ${socket.id}`);

  socket.on('track_complaint', (complaintId: string) => {
    if (complaintId) {
      socket.join(`complaint:${complaintId}`);
      console.log(`[Socket.IO] Joined room complaint:${complaintId}`);
      socket.emit('tracked', { complaintId, status: 'listening' });
    }
  });

  socket.on('track_complaint_by_token', (token: string) => {
    if (token) {
      socket.join(`token:${token}`);
      console.log(`[Socket.IO] Joined room token:${token}`);
      socket.emit('tracked_token', { token, status: 'listening' });
    }
  });

  socket.on('disconnect', () => {
    console.log(`[Socket.IO] Client disconnected: ${socket.id}`);
  });
});

// 1. API: Update Complaint Status (Used by Officers/AI)
app.post('/api/complaints/:id/status', async (req, res) => {
  const { id } = req.params;
  const { status, notes, updatedBy, phoneNumber: reqPhoneNumber, citizenId: reqCitizenId, trackingToken: reqTrackingToken, trackingLink: reqTrackingLink } = req.body;

  if (!status || !updatedBy) {
    return res.status(400).json({ error: 'Status and updatedBy fields are required.' });
  }

  try {
    // A. Update Firestore & Record Audit Event
    const { success, complaintData } = await updateComplaintStatusInDb(id, status, updatedBy, notes, reqPhoneNumber, reqCitizenId);
    if (!success) {
      return res.status(500).json({ error: 'Failed to update complaint database.' });
    }

    const citizenId = complaintData.uid || complaintData.citizen_id || 'unknown';
    const phoneNumber = complaintData.phoneNumber || '+919999999999';

    // B. Check SMS Rate Limit (Max 20 per day)
    const isAllowed = await checkRateLimit(citizenId);
    if (!isAllowed) {
      console.warn(`[SMS Service] [BLOCKED] SMS rate limit exceeded for citizen ${citizenId}. Queue skipped.`);
      
      // Log blocked attempt to audit logs
      await logSMS({
        id: `blocked_${Math.floor(100000 + Math.random() * 900000)}`,
        complaintId: id,
        citizenId: citizenId,
        phoneNumber: phoneNumber,
        message: `Blocked: Rate limit exceeded (Max 20/day). Status target: ${status}`,
        status: 'Failed',
        errorMessage: 'Daily SMS rate limit exceeded (20 per citizen).'
      });
    } else {
      // C. Enqueue SMS notification via BullMQ Queue 'sms-notifications'
      const smsQueue = getSMSQueue();
      await smsQueue.addSMSJob({
        complaintId: id,
        phoneNumber: phoneNumber,
        template: status, // status mapped to template key
        citizenId: citizenId,
        category: complaintData.category || 'General',
        department: complaintData.department || 'General Department',
        trackingToken: reqTrackingToken || complaintData.trackingToken,
        trackingLink: reqTrackingLink || complaintData.trackingLink
      });
    }

    // D. Push event to Legacy Dashboard updates (via Socket.IO / queue worker)
    const legacyQueue = await initQueueService();
    await legacyQueue.addNotificationJob({
      complaintId: id,
      status: status,
      updatedBy: updatedBy,
      notes: notes,
      recipientUid: citizenId,
      recipientPhone: phoneNumber,
      category: complaintData.category || 'General',
      department: complaintData.department || 'General Department'
    });

    return res.status(200).json({
      message: 'Status updated successfully. Notifications queued.',
      complaint: complaintData
    });
  } catch (error: any) {
    console.error(`[API Server] Error updating status for ${id}:`, error.message);
    return res.status(500).json({ error: error.message || 'An error occurred during update.' });
  }
});

// 2. Twilio Webhook: Receive Status Callback & Update Log Status
app.post('/api/webhooks/twilio', async (req, res) => {
  const twilioSignature = req.headers['x-twilio-signature'] as string;
  const url = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
  const params = req.body;

  const twilioSid = params.MessageSid;
  const twilioStatus = params.MessageStatus; // queued, sending, sent, delivered, failed, undelivered
  const errorCode = params.ErrorCode;
  const errorMessage = params.ErrorMessage;

  console.log(`[Twilio Webhook] Received callback for SID: ${twilioSid}. Status: ${twilioStatus}`);

  // Optional signature verification (disabled for development or missing headers)
  if (process.env.NODE_ENV === 'production' && twilioSignature) {
    const isValid = twilio.validateRequest(TWILIO_AUTH_TOKEN, twilioSignature, url, params);
    if (!isValid) {
      console.error('[Twilio Webhook] Signature verification failed. Request blocked.');
      return res.status(403).send('Forbidden: Invalid Twilio Signature');
    }
  }

  if (!twilioSid) {
    return res.status(400).send('Bad Request: MessageSid missing.');
  }

  try {
    // Map Twilio statuses to our logs status: Queued, Sent, Delivered, Failed
    let logStatus: 'Queued' | 'Sent' | 'Delivered' | 'Failed' = 'Sent';
    if (twilioStatus === 'queued' || twilioStatus === 'sending') {
      logStatus = 'Queued';
    } else if (twilioStatus === 'delivered') {
      logStatus = 'Delivered';
    } else if (twilioStatus === 'failed' || twilioStatus === 'undelivered') {
      logStatus = 'Failed';
    }

    const errDetail = errorMessage ? `Code ${errorCode}: ${errorMessage}` : undefined;
    await updateSMSStatus(twilioSid, logStatus, errDetail);

    // Broadcast update to monitoring dashboard if connected
    io.emit('sms_log_update', { twilioSid, status: logStatus, errorMessage: errDetail });

    return res.status(200).send('OK');
  } catch (error: any) {
    console.error('[Twilio Webhook] Error updating status:', error.message);
    return res.status(500).send('Internal Server Error');
  }
});

// 3. Admin Query: Get SMS logs and metrics
app.get('/api/admin/sms-logs', async (req, res) => {
  const limitVal = parseInt(req.query.limit as string || '20', 10);
  const offsetVal = parseInt(req.query.offset as string || '0', 10);

  try {
    const { logs, total } = await getSMSLogs(limitVal, offsetVal);
    const stats = await getSMSStats();

    // Mask phone numbers before sending to frontend dashboard
    const maskedLogs = logs.map(l => ({
      ...l,
      phoneNumber: maskPhoneNumber(l.phoneNumber)
    }));

    return res.status(200).json({
      logs: maskedLogs,
      total,
      stats
    });
  } catch (error: any) {
    console.error('[API Server] Error fetching SMS logs:', error.message);
    return res.status(500).json({ error: error.message });
  }
});

// 4. Internal Endpoint: Trigger Real-time broadcast (Called by worker)
app.post('/api/internal/broadcast', (req, res) => {
  const { complaintId, status, currentStep, timeline, notes, trackingToken } = req.body;

  if (!complaintId || !status) {
    return res.status(400).json({ error: 'complaintId and status are required for broadcast.' });
  }

  console.log(`[API Server] Broadcasting status update for ${complaintId} via Socket.IO`);
  
  // Emit event to complaint room
  io.to(`complaint:${complaintId}`).emit('status_update', {
    complaintId,
    status,
    currentStep,
    timeline,
    notes,
    timestamp: new Date().toISOString()
  });

  // Emit event to token room
  if (trackingToken) {
    console.log(`[API Server] Broadcasting status update to token room: token:${trackingToken}`);
    io.to(`token:${trackingToken}`).emit('status_update', {
      complaintId,
      status,
      currentStep,
      timeline,
      notes,
      timestamp: new Date().toISOString()
    });
  }

  return res.status(200).json({ success: true, message: 'Broadcast complete.' });
});

const trackIpLimits = new Map<string, { count: number; resetTime: number }>();

function publicTrackRateLimiter(req: express.Request, res: express.Response, next: express.NextFunction) {
  const ip = req.ip || req.headers['x-forwarded-for'] as string || 'unknown';
  const now = Date.now();
  const windowMs = 60 * 1000; // 1 minute window
  const maxRequests = 30; // Max 30 requests per minute

  const limitData = trackIpLimits.get(ip);
  if (!limitData || now > limitData.resetTime) {
    trackIpLimits.set(ip, {
      count: 1,
      resetTime: now + windowMs
    });
    return next();
  }

  limitData.count++;
  if (limitData.count > maxRequests) {
    console.warn(`[Rate Limiter] [IP BLOCKED] Public tracking rate limit exceeded for IP: ${ip}`);
    return res.status(429).json({ error: 'Too many requests. Please try again after 1 minute.' });
  }

  next();
}

// 5. Public API: Fetch Complaint by Tracking Token (No Authentication Required)
app.get('/api/complaints/track/:token', publicTrackRateLimiter, async (req, res) => {
  const { token } = req.params;

  if (!token) {
    return res.status(400).json({ error: 'Tracking token is required.' });
  }

  try {
    if (isFirebaseAdminInitialized && adminDb) {
      const complaintsRef = adminDb.collection('complaints');
      const snapshot = await complaintsRef.where('trackingToken', '==', token).limit(1).get();

      if (snapshot.empty) {
        // Fallback: Check if they passed a complaint ID directly (e.g. for backward compatibility)
        const directDoc = await complaintsRef.doc(token).get();
        if (directDoc.exists) {
          return res.status(200).json(directDoc.data());
        }
        return res.status(404).json({ error: 'No complaint found matching this tracking token.' });
      }

      const doc = snapshot.docs[0];
      return res.status(200).json(doc.data());
    } else {
      // Simulation mode fallback
      return res.status(200).json({
        id: "CMP-2026-001",
        title: "Simulation Complaint",
        category: "Water Supply",
        description: "Waterlogging near sector 5",
        status: "Submitted",
        department: "PWD",
        assignedOfficer: "A. K. Sharma",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        currentStep: 1,
        timeline: []
      });
    }
  } catch (error: any) {
    console.error(`[API Server] Error fetching tracking data for token ${token}:`, error.message);
    return res.status(500).json({ error: error.message || 'An error occurred.' });
  }
});

// 6. Diagnostics Endpoint: Health check for Render deployments
app.get('/health', (req, res) => {
  const dbStatus = isPostgresConnected() ? 'connected' : 'disconnected';
  const redisStatus = isRedisConnected() ? 'connected' : 'disconnected';

  return res.status(200).json({
    status: "healthy",
    database: dbStatus,
    redis: redisStatus,
    timestamp: new Date().toISOString()
  });
});

// Start Web Server
server.listen(PORT, async () => {
  console.log(`===============================================`);
  console.log(`🚀 Express & Socket.IO Server running on port ${PORT}`);
  console.log(`===============================================`);

  // Initialize Databases & Queues
  await initDatabase();
  await initRateLimiter();
  await initSMSQueue();

  // Legacy background worker processing inline (in-memory mode)
  if (process.env.NODE_ENV !== 'production' || !process.env.REDIS_HOST) {
    console.log('[API Server] Starting legacy queue worker inline...');
    const legacyQueue = await initQueueService();
    const { processNotificationJob } = require('./worker');
    legacyQueue.processJobs(processNotificationJob);
  }
});

// Graceful Shutdown implementation for production environments (Render)
async function gracefulShutdown(signal: string) {
  console.log(`\n[API Server] Received ${signal}. Starting graceful shutdown procedure...`);
  
  // 1. Close Server to stop receiving new requests
  server.close(() => {
    console.log('[API Server] HTTP server closed.');
  });

  // 2. Shut down PG connection pool
  try {
    await closeDatabase();
  } catch (err: any) {
    console.error('[API Server] Error closing database pool:', err.message);
  }

  // 3. Close BullMQ queue and client connections
  try {
    await closeRedis();
  } catch (err: any) {
    console.error('[API Server] Error disconnecting from Redis:', err.message);
  }

  console.log('[API Server] Graceful shutdown completed. Exiting.');
  process.exit(0);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
