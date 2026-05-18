import { PrismaClient } from '@prisma/client';

// Declaración global para singleton
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Crear instancia de PrismaClient
export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

// Función para verificar conexión
export const checkDatabaseConnection = async () => {
  try {
    await prisma.$connect();
    console.log('✅ Base de datos conectada correctamente');
    return true;
  } catch (error) {
    console.error('❌ Error conectando a la base de datos:', error);
    return false;
  }
};