import swaggerJsdoc from 'swagger-jsdoc';
import { env } from './env';

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
        url: `http://localhost:${env.port}`,
        description: 'Servidor local',
      },
      {
        url: 'https://tu-app-parejas.onrender.com', // Cambiar cuando tengas deploy
        description: 'Producción',
      },
    ],
  },
  apis: ['./src/routes/*.ts', './src/controllers/*.ts'], // Archivos donde documentaremos
};

export const swaggerSpec = swaggerJsdoc(options);