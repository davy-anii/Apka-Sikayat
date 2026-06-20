"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.encrypt = encrypt;
exports.decrypt = decrypt;
exports.maskPhoneNumber = maskPhoneNumber;
const crypto_1 = __importDefault(require("crypto"));
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
dotenv_1.default.config({ path: path_1.default.join(__dirname, '../../frontend/.env') });
// Ensure we have a 32-byte key by hashing the configured env key
const ENCRYPTION_KEY_RAW = process.env.SMS_ENCRYPTION_KEY || 'd7e8b61c47a9f0e34c2b9a8f6d7e8b61';
const ENCRYPTION_KEY = crypto_1.default.createHash('sha256').update(ENCRYPTION_KEY_RAW).digest(); // Exactly 32 bytes
const IV_LENGTH = 16; // AES block size
/**
 * Encrypts a string using AES-256-CBC.
 * Output format is: iv_in_hex:ciphertext_in_hex
 */
function encrypt(text) {
    if (!text)
        return '';
    const iv = crypto_1.default.randomBytes(IV_LENGTH);
    const cipher = crypto_1.default.createCipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return `${iv.toString('hex')}:${encrypted}`;
}
/**
 * Decrypts a string of format: iv_in_hex:ciphertext_in_hex using AES-256-CBC.
 */
function decrypt(cipherText) {
    if (!cipherText)
        return '';
    try {
        const parts = cipherText.split(':');
        const iv = Buffer.from(parts.shift() || '', 'hex');
        const encryptedText = Buffer.from(parts.join(':'), 'hex');
        const decipher = crypto_1.default.createDecipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
        let decrypted = decipher.update(encryptedText);
        decrypted = Buffer.concat([decrypted, decipher.final()]);
        return decrypted.toString('utf8');
    }
    catch (error) {
        console.error('[Crypto Service] Decryption failed:', error.message);
        return cipherText; // Fallback to raw if decryption fails (e.g. for legacy plain data)
    }
}
/**
 * Masks a phone number for logs and dashboard display to preserve privacy.
 * E.g., "+919876543210" -> "+91******3210"
 */
function maskPhoneNumber(phone) {
    if (!phone)
        return '';
    const cleaned = phone.trim();
    if (cleaned.length < 7)
        return '******';
    const prefix = cleaned.substring(0, 3);
    const suffix = cleaned.substring(cleaned.length - 4);
    return `${prefix}******${suffix}`;
}
