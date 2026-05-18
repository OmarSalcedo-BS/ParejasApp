import { Request, Response } from 'express';
import { supabase } from '../config/supabase';
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
    
    // Verificar si ya tiene pareja (consultar tabla couples)
    const { data: existingCouple } = await supabase
      .from('users')
      .select('couple_id')
      .eq('id', user.id)
      .single();

    if (existingCouple?.couple_id) {
      return res.status(400).json(errorResponse('Ya tienes una pareja asignada', 400));
    }

    // Generar código único
    let code = generateCoupleCode();
    let { data: existing } = await supabase
      .from('couples')
      .select('id')
      .eq('code', code)
      .single();

    while (existing) {
      code = generateCoupleCode();
      const { data: retry } = await supabase
        .from('couples')
        .select('id')
        .eq('code', code)
        .single();
      existing = retry;
    }

    // Crear la pareja
    const { data: couple, error: coupleError } = await supabase
      .from('couples')
      .insert({ code })
      .select()
      .single();

    if (coupleError) throw coupleError;

    // Asignar usuario a la pareja
    const { error: updateError } = await supabase
      .from('users')
      .update({ couple_id: couple.id })
      .eq('id', user.id);

    if (updateError) throw updateError;

    // Crear invitación (válida 7 días)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const { error: invitationError } = await supabase
      .from('couple_invitations')
      .insert({
        code,
        inviter_id: user.id,
        expires_at: expiresAt.toISOString(),
      });

    if (invitationError) throw invitationError;

    res.status(201).json(successResponse({
      coupleId: couple.id,
      code: couple.code,
      expiresAt,
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
      return res.status(400).json(errorResponse('Código requerido', 400));
    }

    const normalizedCode = code.toUpperCase().trim();
    
    if (!isValidCoupleCode(normalizedCode)) {
      return res.status(400).json(errorResponse('Código inválido (6 caracteres A-Z, 0-9)', 400));
    }

    const user = await getAuthenticatedUser(token);

    // Verificar si ya tiene pareja
    const { data: userData } = await supabase
      .from('users')
      .select('couple_id')
      .eq('id', user.id)
      .single();

    if (userData?.couple_id) {
      return res.status(400).json(errorResponse('Ya tienes una pareja asignada', 400));
    }

    // Buscar pareja por código
    const { data: couple, error: coupleError } = await supabase
      .from('couples')
      .select('*')
      .eq('code', normalizedCode)
      .single();

    if (coupleError || !couple) {
      return res.status(404).json(errorResponse('Código de invitación inválido', 404));
    }

    // Verificar invitación vigente
    const { data: invitation, error: invError } = await supabase
      .from('couple_invitations')
      .select('*')
      .eq('code', normalizedCode)
      .eq('used', false)
      .gt('expires_at', new Date().toISOString())
      .single();

    if (invError || !invitation) {
      return res.status(400).json(errorResponse('El código ha expirado o ya fue usado', 400));
    }

    if (invitation.inviter_id === user.id) {
      return res.status(400).json(errorResponse('No puedes unirte a tu propia pareja', 400));
    }

    // Unir usuario a la pareja
    const { error: updateError } = await supabase
      .from('users')
      .update({ couple_id: couple.id })
      .eq('id', user.id);

    if (updateError) throw updateError;

    // Marcar invitación como usada
    await supabase
      .from('couple_invitations')
      .update({ used: true, used_by: user.id })
      .eq('id', invitation.id);

    // Obtener información del compañero
    const { data: users } = await supabase
      .from('users')
      .select('display_name, email')
      .eq('couple_id', couple.id)
      .neq('id', user.id)
      .single();

    const partnerName = users?.display_name || users?.email?.split('@')[0] || 'tu pareja';

    res.status(200).json(successResponse({
      coupleId: couple.id,
      partner: partnerName,
    }, 'Te has unido a la pareja'));

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

    // Obtener usuario con su pareja
    const { data: userWithCouple, error: userError } = await supabase
      .from('users')
      .select(`
        *,
        couple:couples (
          *,
          users:users (
            id,
            email,
            display_name
          )
        )
      `)
      .eq('id', user.id)
      .single();

    if (userError || !userWithCouple?.couple) {
      return res.status(404).json(errorResponse('No tienes una pareja asignada', 404));
    }

    const couple = userWithCouple.couple;
    const partner = couple.users?.find((u: any) => u.id !== user.id);
    const myInfo = couple.users?.find((u: any) => u.id === user.id);

    res.status(200).json(successResponse({
      coupleId: couple.id,
      code: couple.code,
      myInfo: {
        id: myInfo?.id,
        email: myInfo?.email,
        displayName: myInfo?.display_name,
      },
      partner: partner ? {
        id: partner.id,
        email: partner.email,
        displayName: partner.display_name,
      } : null,
      memberCount: couple.users?.length || 0,
      since: userWithCouple.created_at,
    }, 'Información de pareja'));

  } catch (error: any) {
    console.error('Error en getCoupleInfo:', error);
    res.status(500).json(errorResponse(error.message, 500));
  }
};