import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

// ── Validate key format ───────────────────────────────────────────────────────
// Accepts either classic JWT anon keys (starts with "eyJ") or new Supabase
// publishable keys (starts with "sb_publishable_").
const keyLooksValid = Boolean(
  supabaseAnonKey && (supabaseAnonKey.startsWith('eyJ') || supabaseAnonKey.startsWith('sb_publishable_'))
);
const urlLooksValid = Boolean(
  supabaseUrl && (supabaseUrl.includes('.supabase.co') || supabaseUrl.includes('localhost') || supabaseUrl.includes('127.0.0.1'))
);

/** Set to true when we detect the backend is unreachable */
export let isSupabaseOffline: boolean = !keyLooksValid || !urlLooksValid;

if (isSupabaseOffline) {
  console.warn(
    '[HostelAI] Supabase not configured or key is invalid — running in Demo/Offline mode.\n' +
    'Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (must start with "eyJ") in your .env file.'
  );
}

export const supabase = createClient(
  urlLooksValid ? supabaseUrl : 'https://placeholder.supabase.co',
  keyLooksValid ? supabaseAnonKey : 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.placeholder',
  {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
      storageKey: 'hotel-ai-session',
    },
    global: {
      headers: { 'x-application-name': 'hotel-ai' },
      fetch: async (url, options) => {
        if (isSupabaseOffline) {
          // Return a dummy resolved response so callers don't crash
          return new Response(JSON.stringify([]), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        try {
          const res = await fetch(url, options);
          return res;
        } catch (err) {
          // Network failure → mark offline for the rest of this session
          isSupabaseOffline = true;
          console.warn('[HostelAI] Supabase unreachable — switching to Demo mode:', err);
          return new Response(JSON.stringify([]), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }
      },
    },
  }
);

export type SupabaseClient = typeof supabase;
