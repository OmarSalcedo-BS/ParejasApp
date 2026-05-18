// sync-users.js
const { PrismaClient } = require('@prisma/client');
const { createClient } = require('@supabase/supabase-js');
require('dotenv/config');

const prisma = new PrismaClient();
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

async function syncUsers() {
  console.log('🔄 Sincronizando usuarios...');
  
  // Obtener todos los usuarios de Supabase Auth
  const { data: { users }, error } = await supabase.auth.admin.listUsers();
  
  if (error) {
    console.error('Error obteniendo usuarios:', error);
    return;
  }
  
  console.log(`📋 Encontrados ${users.length} usuarios en Supabase Auth`);
  
  let created = 0;
  let skipped = 0;
  
  for (const user of users) {
    // Verificar si ya existe en Prisma
    const existing = await prisma.user.findUnique({
      where: { id: user.id }
    });
    
    if (!existing) {
      await prisma.user.create({
        data: {
          id: user.id,
          email: user.email,
          displayName: user.user_metadata?.display_name || user.email.split('@')[0],
        }
      });
      console.log(`✅ Creado: ${user.email}`);
      created++;
    } else {
      console.log(`⏭️ Existente: ${user.email}`);
      skipped++;
    }
  }
  
  console.log(`\n📊 Resumen: ${created} creados, ${skipped} existentes`);
}

syncUsers()
  .catch(console.error)
  .finally(() => prisma.$disconnect());