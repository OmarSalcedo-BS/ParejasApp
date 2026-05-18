import { Request, Response } from 'express';
import { successResponse } from '../utils/responseUtils';

/**
 * @swagger
 * /health:
 *   get:
 *     summary: Verificar estado del servidor
 *     description: Endpoint para comprobar si el backend está funcionando
 *     tags: [Sistema]
 *     responses:
 *       200:
 *         description: Servidor funcionando correctamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Éxito"
 *                 data:
 *                   type: object
 *                   properties:
 *                     status:
 *                       type: string
 *                       example: "ok"
 *                     timestamp:
 *                       type: string
 *                       example: "2025-01-15T10:30:00.000Z"
 *                     uptime:
 *                       type: number
 *                       example: 123.45
 */
export const healthCheck = (req: Request, res: Response) => {
  const healthData = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
  };
  
  res.status(200).json(successResponse(healthData, 'Servidor funcionando'));
};