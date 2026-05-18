const { Pool } = require('pg');

const DATABASE_URL = "postgresql://postgres:K1TrJ1oDDpGOkAPS@db.hzoyhsweumgscnievawm.supabase.co:5432/postgres";

const pool = new Pool({ connectionString: DATABASE_URL });

async function test() {
  try {
    const result = await pool.query('SELECT NOW() as time');
    console.log('✅ Conexión exitosa!', result.rows[0]);
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
  pool.end();
}

test();