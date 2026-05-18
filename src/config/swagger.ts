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
        name: 'Omar Salcedo',
      },
    },
    servers: [
      {
        url: `http://localhost:${env.port}`,
        description: 'Servidor local',
      },
      {
        url: 'https://tu-app-parejas.onrender.com',
        description: 'https://tu-app-parejas.onrender.com',
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
        AuthResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            message: { type: 'string', example: 'Login exitoso' },
            data: {
              type: 'object',
              properties: {
                session: {
                  type: 'object',
                  properties: {
                    access_token: { type: 'string' },
                    refresh_token: { type: 'string' },
                  },
                },
                user: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    email: { type: 'string' },
                  },
                },
              },
            },
          },
        },
        ErrorResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            message: { type: 'string' },
            code: { type: 'number' },
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