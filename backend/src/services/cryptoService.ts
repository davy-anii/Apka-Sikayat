import crypto from 'crypto';
import dotenv from 'dotenv';
import path from 'path';

import fs from 'fs';
let envPath = path.join(__dirname, '../../frontend/.env');
if (!fs.existsSync(envPath)) {
  envPath = path.join(__dirname, '../../../frontend/.env');
}
dotenv.config({ path: envPath });

// Ensure we have a 32-byte key by hashing the configured env key
const ENCRYPTION_KEY_RAW = process.env.SMS_ENCRYPTION_KEY || '';
const ENCRYPTION_KEY = crypto.createHash('sha256').update(ENCRYPTION_KEY_RAW).digest(); // Exactly 32 bytes
const IV_LENGTH = 16; // AES block size

/**
 * Encrypts a string using AES-256-CBC.
 * Output format is: iv_in_hex:ciphertext_in_hex
 */
export function encrypt(text: string): string {
  if (!text) return '';
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return `${iv.toString('hex')}:${encrypted}`;
}

/**
 * Decrypts a string of format: iv_in_hex:ciphertext_in_hex using AES-256-CBC.
 */
export function decrypt(cipherText: string): string {
  if (!cipherText) return '';
  try {
    const parts = cipherText.split(':');
    const iv = Buffer.from(parts.shift() || '', 'hex');
    const encryptedText = Buffer.from(parts.join(':'), 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString('utf8');
  } catch (error: any) {
    console.error('[Crypto Service] Decryption failed:', error.message);
    return cipherText; // Fallback to raw if decryption fails (e.g. for legacy plain data)
  }
}

/**
 * Masks a phone number for logs and dashboard display to preserve privacy.
 * E.g., "+919876543210" -> "+91******3210"
 */
export function maskPhoneNumber(phone: string): string {
  if (!phone) return '';
  const cleaned = phone.trim();
  if (cleaned.length < 7) return '******';
  const prefix = cleaned.substring(0, 3);
  const suffix = cleaned.substring(cleaned.length - 4);
  return `${prefix}******${suffix}`;
}
