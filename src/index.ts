import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { env } from './config/env';
import healthRoutes from './routes/healthRoutes';
import docsRoutes from './routes/docsRoutes';
import authRoutes from './routes/authRoutes';
import coupleRoutes from './routes/coupleRoutes';
import { errorResponse } from './utils/responseUtils';
import questionRoutes from './routes/questionRoutes';

const app = express();
app.set('trust proxy', 1);
// ================= CONFIGURACIÓN DE SEGURIDAD =================

// 1. Helmet - Headers de seguridad (protege contra vulnerabilidades comunes)
app.use(helmet());

// 2. Rate Limiting - Previene ataques de fuerza bruta
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // Máximo 100 peticiones por IP
  message: 'Demasiadas peticiones desde esta IP, intenta más tarde',
  standardHeaders: true,
  legacyHeaders: false,
});

// Límite más estricto para endpoints de autenticación
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10, // Solo 10 intentos por 15 minutos
  skipSuccessfulRequests: true,
  message: 'Demasiados intentos de inicio de sesión',
});

app.use('/api/', generalLimiter);
app.use('/auth/login', authLimiter);
app.use('/auth/register', authLimiter);

// 3. CORS - Configurado para app móvil + desarrollo local
// Las apps móviles NO envían origin, por eso permitimos !origin
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:8080',
  'http://localhost:5000',
  'capacitor://localhost',  // Para apps con Capacitor
];

app.use(cors({
  origin: true,  
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
}));

// ================= MIDDLEWARES =================
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ================= RUTAS =================
app.get('/', (req, res) => {
  res.json({
    message: 'Bienvenido a la API de App Parejas',
    documentation: `http://localhost:${env.port}/docs`,
    version: env.apiVersion,
  });
});

// Endpoints públicos
app.use('/', healthRoutes);     
app.use('/', docsRoutes);      


app.use('/', authRoutes);       


app.use('/', coupleRoutes);     

app.use('/', questionRoutes);

// ================= MANEJO DE ERRORES =================
app.use((req, res) => {
  res.status(404).json(errorResponse(`Ruta ${req.method} ${req.url} no encontrada`, 404));
});

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