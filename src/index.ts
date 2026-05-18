import express from 'express';
import cors from 'cors';
import { env } from './config/env';
import healthRoutes from './routes/healthRoutes';
import docsRoutes from './routes/docsRoutes';
import { errorResponse } from './utils/responseUtils';
import supabaseTestRoutes from './routes/supabaseTestRoutes';
import authRoutes from './routes/authRoutes';
import coupleRoutes from './routes/coupleRoutes';

const app = express();

// ================= MIDDLEWARES GLOBALES =================
app.use(cors());
app.use(express.json({ limit: '10mb' })); // Limitamos tamaño por seguridad
app.use(express.urlencoded({ extended: true }));

// ================= RUTAS =================
// Ruta principal (redirige a docs)
app.get('/', (req, res) => {
  res.json({
    message: 'Bienvenido a la API de App Parejas',
    documentation: `http://localhost:${env.port}/docs`,
    version: env.apiVersion,
  });
});

// Endpoints de la API
app.use('/', healthRoutes);    
app.use('/', docsRoutes); 
app.use('/', supabaseTestRoutes);     
app.use('/', authRoutes);
app.use('/', coupleRoutes);

// ================= MANEJO DE ERRORES =================
// Ruta no encontrada (404)
app.use((req, res) => {
  res.status(404).json(errorResponse(`Ruta ${req.method} ${req.url} no encontrada`, 404));
});

// Manejador de errores global (500)
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error no manejado:', err.stack);
  res.status(500).json(errorResponse('Error interno del servidor', 500));
});

// ================= INICIAR SERVIDOR =================
app.listen(env.port, () => {
  console.log('\n=================================');
  console.log(`🚀 SERVIDOR CORRIENDO`);
  console.log(`📍 Local: http://localhost:${env.port}`);
  console.log(`📚 Documentación: http://localhost:${env.port}/docs`);
  console.log(`💚 Health check: http://localhost:${env.port}/health`);
  console.log(`🌍 Modo: ${env.nodeEnv}`);
  console.log('=================================\n');
});