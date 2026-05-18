import swaggerJsdoc from 'swagger-jsdoc';
import { env } from './env';

const isProduction = process.env.NODE_ENV === 'production';
const serverUrl = isProduction
  ? 'https://app-parejas-backend.onrender.com'
  : `http://localhost:${env.port}`;

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: env.apiName,
      version: env.apiVersion,
      description: 'API para aplicación de parejas con preguntas diarias',
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