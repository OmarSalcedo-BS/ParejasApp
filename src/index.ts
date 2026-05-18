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

const app = express();

// ================= CONFIGURACIÓN DE SEGURIDAD =================

// 1. Helmet - Headers de seguridad
app.use(helmet());

// 2. Rate Limiting
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Demasiadas peticiones desde esta IP',
  standardHeaders: true,
  legacyHeaders: false,
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  skipSuccessfulRequests: true,
  message: 'Demasiados intentos de inicio de sesión',
});

app.use('/api/', generalLimiter);
app.use('/auth/login', authLimiter);
app.use('/auth/register', authLimiter);

// 3. CORS - Configuración COMPLETA para desarrollo y producción
// Lista de orígenes permitidos
const allowedOrigins = [
  'http://localhost:3000',      // Frontend local
  'http://localhost:8080',      // Flutter web
  'http://localhost:5000',      // Otro frontend
  'http://localhost:10000',     // Swagger UI local
  'https://app-parejas-backend.onrender.com', // Producción
  'capacitor://localhost',      // App móvil
];

app.use(cors({
  origin: (origin, callback) => {
    // Permitir requests sin origin (apps móviles, curl, Postman)
    if (!origin) {
      return callback(null, true);
    }
    
    // Permitir orígenes en lista blanca
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    
    // Para desarrollo: permitir cualquier localhost
    if (origin && (origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:'))) {
      return callback(null, true);
    }
    
    console.log(`🔒 CORS bloqueó: ${origin}`);
    callback(new Error(`Origen ${origin} no permitido por CORS`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
  exposedHeaders: ['Authorization'],
}));

// ================= MIDDLEWARES =================
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ================= RUTAS =================
app.get('/', (req, res) => {
  res.json({
    message: 'Bienvenido a la API de App Parejas',
    documentation: `${req.protocol}://${req.get('host')}/docs`,
    version: env.apiVersion,
  });
});

app.use('/', healthRoutes);
app.use('/', docsRoutes);
app.use('/', authRoutes);
app.use('/', coupleRoutes);

// ================= MANEJO DE ERRORES =================
app.use((req, res) => {
  res.status(404).json(errorResponse(`Ruta ${req.method} ${req.url} no encontrada`, 404));
});

app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error no manejado:', err.stack);
  res.status(500).json(errorResponse('Error interno del servidor', 500));
});

// ================= INICIAR SERVIDOR =================
const PORT = env.port || 3000;
app.listen(PORT, () => {
  console.log('\n=================================');
  console.log(`🚀 SERVIDOR CORRIENDO`);
  console.log(`📍 Local: http://localhost:${PORT}`);
  console.log(`📚 Documentación: http://localhost:${PORT}/docs`);
  console.log(`💚 Health check: http://localhost:${PORT}/health`);
  console.log(`🌍 Modo: ${env.nodeEnv}`);
  console.log('=================================\n');
});