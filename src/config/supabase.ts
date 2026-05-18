import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Faltan variables de Supabase en .env');
  console.error('SUPABASE_URL:', supabaseUrl ? '✅' : '❌');
  console.error('SUPABASE_ANON_KEY:', supabaseAnonKey ? '✅' : '❌');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Tipos para nuestras tablas (documentación)
export type User = {
  id: string;
  email: string;
  display_name: string | null;
  couple_id: string | null;
  created_at: string;
  updated_at: string;
};

export type Couple = {
  id: string;
  code: string;
  created_at: string;
};

export type CoupleInvitation = {
  id: string;
  code: string;
  inviter_id: string;
  used: boolean;
  used_by: string | null;
  expires_at: string;
  created_at: string;
};