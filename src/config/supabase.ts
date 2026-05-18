// Esto DEBE ir ANTES de importar cualquier cosa que use process.env
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Faltan variables de Supabase en .env');
  console.error('SUPABASE_URL:', supabaseUrl ? '✅' : '❌');
  console.error('SUPABASE_ANON_KEY:', supabaseAnonKey ? '✅' : '❌');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export const checkSupabaseConnection = async () => {
  try {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    console.log('✅ Supabase conectado correctamente');
    return true;
  } catch (error) {
    console.error('❌ Error conectando a Supabase:', error);
    return false;
  }
};