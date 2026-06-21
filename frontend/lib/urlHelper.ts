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

export function getBackendUrl(): string {
  // 1. Prioritize configured API environment variable (allows routing local frontend to Render backend)
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL;
  }

  // 2. Default to localhost port 5002 for local development
  if (typeof window !== 'undefined' && window.location) {
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      return 'http://localhost:5002';
    }
  }

  if (typeof window !== 'undefined' && window.location) {
    // Auto-detect Render backend URL mapping
    if (window.location.hostname.endsWith('.onrender.com')) {
      const baseName = window.location.hostname
        .replace('-frontend', '')
        .replace('.onrender.com', '');
      return `https://${baseName}-backend.onrender.com`;
    }
    // Handle dynamic ngrok URLs mapping 5001/3000 to 5002
    return window.location.origin.replace(':5001', ':5002').replace(':3000', ':5002');
  }
  return 'http://localhost:5002';
}
