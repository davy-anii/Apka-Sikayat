"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getBackendAppUrl = getBackendAppUrl;
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
dotenv_1.default.config({ path: path_1.default.join(__dirname, '../../frontend/.env') });
function getBackendAppUrl() {
    // 1. Check for Production APP URL
    if (process.env.NEXT_PUBLIC_APP_URL) {
        return process.env.NEXT_PUBLIC_APP_URL;
    }
    // 2. Check for NGROK / dev public URL
    if (process.env.NGROK_PUBLIC_URL) {
        return process.env.NGROK_PUBLIC_URL;
    }
    if (process.env.NEXT_PUBLIC_NGROK_PUBLIC_URL) {
        return process.env.NEXT_PUBLIC_NGROK_PUBLIC_URL;
    }
    // 3. Default fallback
    return 'http://localhost:3000';
}
