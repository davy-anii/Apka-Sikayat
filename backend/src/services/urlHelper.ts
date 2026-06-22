import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

let envPath = path.join(__dirname, '../../frontend/.env');
if (!fs.existsSync(envPath)) {
  envPath = path.join(__dirname, '../../../frontend/.env');
}
dotenv.config({ path: envPath });

export function getAppUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL;
  }
  if (process.env.NEXT_PUBLIC_API_URL) {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL.trim();
    if (apiUrl.includes('apka-sikayat') && apiUrl.includes('onrender.com')) {
      return 'https://apka-sikayat.vercel.app';
    }
  }
  if (process.env.NEXT_PUBLIC_NGROK_PUBLIC_URL) {
    return process.env.NEXT_PUBLIC_NGROK_PUBLIC_URL;
  }
  if (process.env.NGROK_PUBLIC_URL) {
    return process.env.NGROK_PUBLIC_URL;
  }
  return 'http://localhost:3000';
}

export function generateTrackingToken(): string {
  return Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
}

export async function generateNextComplaintId(): Promise<string> {
  const year = new Date().getFullYear();
  try {
    const { db } = require('../../firebase');
    const { collection, getDocs } = require('firebase/firestore');
    const complaintsRef = collection(db, 'complaints');
    const snap = await getDocs(complaintsRef);
    let maxNum = 0;
    snap.forEach((doc: any) => {
      const id = doc.id;
      if (id.startsWith(`GRV-${year}-`)) {
        const numPart = parseInt(id.split('-')[2], 10);
        if (!isNaN(numPart) && numPart > maxNum) {
          maxNum = numPart;
        }
      }
    });
    const nextNum = (maxNum + 1).toString().padStart(6, '0');
    return `GRV-${year}-${nextNum}`;
  } catch (err) {
    console.error('Error generating complaint ID:', err);
    const randNum = Math.floor(1 + Math.random() * 999999).toString().padStart(6, '0');
    return `GRV-${year}-${randNum}`;
  }
}

export function getBackendUrl(): string {
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL;
  }
  return `http://localhost:${process.env.PORT || '5002'}`;
}

export function getBackendAppUrl(): string {
  return getAppUrl();
}
