export function getAppUrl(): string {
  // 1. Check for Production APP URL
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL;
  }

  // 2. Check for NGROK / dev public URL
  if (process.env.NEXT_PUBLIC_NGROK_PUBLIC_URL) {
    return process.env.NEXT_PUBLIC_NGROK_PUBLIC_URL;
  }
  if (process.env.NGROK_PUBLIC_URL) {
    return process.env.NGROK_PUBLIC_URL;
  }

  // 3. Fallback to client-side window origin if available
  if (typeof window !== 'undefined' && window.location) {
    return window.location.origin;
  }

  // 4. Default fallback
  return 'http://localhost:3000';
}

export function generateTrackingToken(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID().replace(/-/g, '');
  }
  // Cryptographically robust fallback
  return Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
}
