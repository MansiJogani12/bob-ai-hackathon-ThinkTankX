import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const clientUrl = supabaseUrl ?? "https://placeholder.supabase.co";
const clientKey = supabaseAnonKey ?? "placeholder-anon-key";

/**
 * Single shared Supabase client for the entire frontend.
 * Uses the public anon key — safe for browser use.
 */
export const supabase = createClient(clientUrl, clientKey);
