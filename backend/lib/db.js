import { createClient } from '@supabase/supabase-js';

let client;

/** Service-role Supabase client. Server-only: the key never leaves the backend. */
export function db() {
  if (!client) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
    client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  }
  return client;
}

/** Throws on a Supabase error so handlers can use plain try/catch. */
export function must({ data, error }) {
  if (error) throw new Error(error.message);
  return data;
}
