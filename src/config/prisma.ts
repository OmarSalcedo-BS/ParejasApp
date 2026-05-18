import { PrismaClient } from '@prisma/client';

// Configuración simple para producción
const prisma = new PrismaClient();

export { prisma };