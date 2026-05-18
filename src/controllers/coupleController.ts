import { Request, Response } from 'express';
import { supabase } from '../config/supabase';
import { prisma } from '../config/prisma';
import { generateCoupleCode, isValidCoupleCode } from '../utils/codeGenerator';
import { successResponse, errorResponse } from '../utils/responseUtils';

// Obtener el usuario autenticado desde el token
const getAuthenticatedUser = async (token: string) => {
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) throw new Error('Usuario no autenticado');
  return user;
};

/**
 * @swagger
 * /couple/create:
 *   post:
 *     summary: Crear una nueva pareja
 *     description: Genera un código de invitación único para compartir con tu pareja
 *     tags: [Parejas]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       201:
 *         description: Pareja creada exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     coupleId:
 *                       type: string
 *                     code:
 *                       type: string
 *                       example: "A3B9C2"
 *                     expiresAt:
 *                       type: string
 *       400:
 *         description: Ya tienes una pareja asignada
 *       401:
 *         description: No autorizado
 */
export const createCouple = async (req: Request, res: Response) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json(errorResponse('Token no proporcionado', 401));
    }

    const user = await getAuthenticatedUser(token);
    
    // Verificar si el usuario ya tiene pareja
    const existingUser = await prisma.user.findUnique({
      where: { id: user.id },
    });

    if (existingUser?.coupleId) {
      return res.status(400).json(errorResponse('Ya tienes una pareja asignada', 400));
    }

    // Generar código único
    let code = generateCoupleCode();
    let existingCouple = await prisma.couple.findUnique({ where: { code } });
    
    // Asegurar que el código sea único
    while (existingCouple) {
      code = generateCoupleCode();
      existingCouple = await prisma.couple.findUnique({ where: { code } });
    }

    // Crear la pareja
    const couple = await prisma.couple.create({
      data: { code }
    });

    // Asignar el usuario a la pareja
    await prisma.user.update({
      where: { id: user.id },
      data: { coupleId: couple.id }
    });

    // Crear registro de invitación (válido por 7 días)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await prisma.coupleInvitation.create({
      data: {
        code,
        inviterId: user.id,
        expiresAt,
      }
    });

    res.status(201).json(successResponse({
      coupleId: couple.id,
      code: couple.code,
      expiresAt,
      message: 'Comparte este código de 6 letras con tu pareja'
    }, 'Pareja creada'));

  } catch (error: any) {
    console.error('Error en createCouple:', error);
    res.status(500).json(errorResponse(error.message, 500));
  }
};

/**
 * @swagger
 * /couple/join:
 *   post:
 *     summary: Unirse a una pareja existente
 *     description: Usa el código de invitación para unirte a la pareja de otra persona
 *     tags: [Parejas]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - code
 *             properties:
 *               code:
 *                 type: string
 *                 example: "A3B9C2"
 *                 description: Código de 6 caracteres (letras mayúsculas y números)
 *     responses:
 *       200:
 *         description: Te has unido exitosamente
 *       400:
 *         description: Código inválido o ya tienes pareja
 *       401:
 *         description: No autorizado
 *       404:
 *         description: Código no encontrado
 */
export const joinCouple = async (req: Request, res: Response) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json(errorResponse('Token no proporcionado', 401));
    }

    const { code } = req.body;
    
    if (!code) {
      return res.status(400).json(errorResponse('Código de invitación requerido', 400));
    }

    const normalizedCode = code.toUpperCase().trim();
    
    if (!isValidCoupleCode(normalizedCode)) {
      return res.status(400).json(errorResponse('Código inválido. Debe tener 6 caracteres (letras y números)', 400));
    }

    const user = await getAuthenticatedUser(token);

    // Verificar si el usuario ya tiene pareja
    const existingUser = await prisma.user.findUnique({
      where: { id: user.id }
    });

    if (existingUser?.coupleId) {
      return res.status(400).json(errorResponse('Ya tienes una pareja asignada', 400));
    }

    // Buscar la pareja por código
    const couple = await prisma.couple.findUnique({
      where: { code: normalizedCode },
      include: { users: true }
    });

    if (!couple) {
      return res.status(404).json(errorResponse('Código de invitación inválido', 404));
    }

    // Verificar que la invitación esté vigente
    const invitation = await prisma.coupleInvitation.findFirst({
      where: {
        code: normalizedCode,
        used: false,
        expiresAt: { gt: new Date() }
      }
    });

    if (!invitation) {
      return res.status(400).json(errorResponse('El código ha expirado o ya fue usado', 400));
    }

    // Verificar que no sea el mismo usuario que creó la invitación
    if (invitation.inviterId === user.id) {
      return res.status(400).json(errorResponse('No puedes unirte a tu propia pareja', 400));
    }

    // Unir al usuario a la pareja
    await prisma.user.update({
      where: { id: user.id },
      data: { coupleId: couple.id }
    });

    // Marcar la invitación como usada
    await prisma.coupleInvitation.update({
      where: { id: invitation.id },
      data: { used: true, usedBy: user.id }
    });

    // Obtener el nombre del compañero
    const partner = couple.users.find(u => u.id !== user.id);
    const partnerName = partner?.displayName || partner?.email?.split('@')[0] || 'tu pareja';

    res.status(200).json(successResponse({
      coupleId: couple.id,
      partner: partnerName,
      message: `Te has unido con ${partnerName}`
    }, 'Bienvenido a la pareja'));

  } catch (error: any) {
    console.error('Error en joinCouple:', error);
    res.status(500).json(errorResponse(error.message, 500));
  }
};

/**
 * @swagger
 * /couple/info:
 *   get:
 *     summary: Obtener información de mi pareja
 *     description: Retorna los detalles de la pareja actual y el compañero
 *     tags: [Parejas]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Información de la pareja
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     coupleId:
 *                       type: string
 *                     code:
 *                       type: string
 *                     myInfo:
 *                       type: object
 *                     partner:
 *                       type: object
 *                     memberCount:
 *                       type: number
 *       401:
 *         description: No autorizado
 *       404:
 *         description: No tienes una pareja asignada
 */
export const getCoupleInfo = async (req: Request, res: Response) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json(errorResponse('Token no proporcionado', 401));
    }

    const user = await getAuthenticatedUser(token);

    const userWithCouple = await prisma.user.findUnique({
      where: { id: user.id },
      include: {
        couple: {
          include: {
            users: {
              select: {
                id: true,
                email: true,
                displayName: true,
              }
            }
          }
        }
      }
    });

    if (!userWithCouple?.couple) {
      return res.status(404).json(errorResponse('No tienes una pareja asignada', 404));
    }

    const partner = userWithCouple.couple.users.find(u => u.id !== user.id);
    const currentUser = userWithCouple.couple.users.find(u => u.id === user.id);

    res.status(200).json(successResponse({
      coupleId: userWithCouple.couple.id,
      code: userWithCouple.couple.code,
      myInfo: currentUser,
      partner: partner || null,
      memberCount: userWithCouple.couple.users.length,
      since: userWithCouple.createdAt,
    }, 'Información de pareja'));

  } catch (error: any) {
    console.error('Error en getCoupleInfo:', error);
    res.status(500).json(errorResponse(error.message, 500));
  }
};