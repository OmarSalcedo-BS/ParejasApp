import swaggerJsdoc from 'swagger-jsdoc';
import { env } from './env';

// Detectar si estamos en producción
const isProduction = process.env.NODE_ENV === 'production';

// URL base según entorno
const serverUrl = isProduction
  ? 'https://app-parejas-backend.onrender.com' 
  : `http://localhost:${env.port}`;

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: env.apiName,
      version: env.apiVersion,
      description: 'API para aplicación de parejas con preguntas diarias, mascota virtual y más',
      contact: {
        name: 'Tu Nombre',
      },
    },
    servers: [
      {
        url: serverUrl,
        description: isProduction ? 'Servidor de Producción' : 'Servidor Local',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Ingresa el token que recibes al hacer login',
        },
      },
      schemas: {
        RegisterRequest: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email: { type: 'string', format: 'email', example: 'usuario@ejemplo.com' },
            password: { type: 'string', format: 'password', minLength: 6, example: '12345678' },
            displayName: { type: 'string', example: 'Juan Pérez' },
          },
        },
        LoginRequest: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email: { type: 'string', format: 'email', example: 'usuario@ejemplo.com' },
            password: { type: 'string', format: 'password', example: '12345678' },
          },
        },
      },
    },
    security: [
      {
        bearerAuth: [],
      },
    ],
  },
  apis: ['./src/routes/*.ts', './src/controllers/*.ts'],
};

export const swaggerSpec = swaggerJsdoc(options);