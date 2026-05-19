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
    
    // Verificar si ya tiene pareja
    const { data: existingUser } = await supabase
      .from('users')
      .select('couple_id')
      .eq('id', user.id)
      .single();

    if (existingUser?.couple_id) {
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

    // Generar ID manualmente usando timestamp + random
    const coupleId = `cp_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    // Crear la pareja con ID manual
    const { data: couple, error: coupleError } = await supabase
      .from('couples')
      .insert({ 
        id: coupleId,
        code 
      })
      .select()
      .single();

    if (coupleError) {
      console.error('Error creando pareja:', coupleError);
      throw coupleError;
    }

    // Asignar usuario a la pareja
    const { error: updateError } = await supabase
      .from('users')
      .update({ couple_id: couple.id })
      .eq('id', user.id);

    if (updateError) throw updateError;

    // Crear invitación (válida 7 días)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);
    
    const invitationId = `inv_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    const { error: invitationError } = await supabase
      .from('couple_invitations')
      .insert({
        id: invitationId,
        code,
        inviter_id: user.id,
        expires_at: expiresAt.toISOString(),
      });

    if (invitationError) {
      console.error('Error creando invitación:', invitationError);
      // No fallamos la creación de la pareja, solo logueamos
    }

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

    const supabaseUser = await getAuthenticatedUser(token);

    // 1. Primero obtener el usuario y su couple_id
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, email, display_name, couple_id')
      .eq('id', supabaseUser.id)
      .single();

    if (userError || !user) {
      console.error('Error obteniendo usuario:', userError);
      return res.status(404).json(errorResponse('Usuario no encontrado', 404));
    }

    // 2. Verificar si tiene pareja
    if (!user.couple_id) {
      return res.status(200).json(successResponse(null, 'Sin pareja asignada'));
    }

    // 3. Obtener la información de la pareja
    const { data: couple, error: coupleError } = await supabase
      .from('couples')
      .select('id, code, created_at')
      .eq('id', user.couple_id)
      .single();

    if (coupleError || !couple) {
      console.error('Error obteniendo pareja:', coupleError);
      return res.status(404).json(errorResponse('Pareja no encontrada', 404));
    }

    // 4. Obtener todos los miembros de la pareja
    const { data: members, error: membersError } = await supabase
      .from('users')
      .select('id, email, display_name')
      .eq('couple_id', user.couple_id);

    if (membersError) {
      console.error('Error obteniendo miembros:', membersError);
    }

    const membersList = members || [];
    const partner = membersList.find((m: any) => m.id !== supabaseUser.id);
    const myInfo = membersList.find((m: any) => m.id === supabaseUser.id);

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
      memberCount: membersList.length,
      since: couple.created_at,
    }, 'Información de pareja'));

  } catch (error: any) {
    console.error('Error en getCoupleInfo:', error);
    res.status(500).json(errorResponse(error.message, 500));
  }
};


/**
 * @swagger
 * /couple/anniversary:
 *   post:
 *     summary: Establecer fecha de aniversario
 *     description: Guarda la fecha de aniversario de la pareja
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
 *               - anniversaryDate
 *             properties:
 *               anniversaryDate:
 *                 type: string
 *                 format: date
 *                 example: "2024-01-15"
 *               celebrateMonths:
 *                 type: boolean
 *                 example: true
 *     responses:
 *       200:
 *         description: Aniversario guardado exitosamente
 *       401:
 *         description: No autorizado
 *       404:
 *         description: No tiene pareja asignada
 */
export const setAnniversary = async (req: Request, res: Response) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json(errorResponse('Token no proporcionado', 401));
    }

    const { anniversaryDate, celebrateMonths } = req.body;
    
    if (!anniversaryDate) {
      return res.status(400).json(errorResponse('Fecha de aniversario requerida', 400));
    }

    const supabaseUser = await getAuthenticatedUser(token);

    // Obtener el usuario y su couple_id
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('couple_id')
      .eq('id', supabaseUser.id)
      .single();

    if (userError || !user?.couple_id) {
      return res.status(404).json(errorResponse('No tienes una pareja asignada', 404));
    }

    // Actualizar la pareja con la fecha de aniversario
    const { data: couple, error: coupleError } = await supabase
      .from('couples')
      .update({ 
        anniversary_date: anniversaryDate,
        celebrate_months: celebrateMonths ?? true
      })
      .eq('id', user.couple_id)
      .select()
      .single();

    if (coupleError) {
      console.error('Error actualizando aniversario:', coupleError);
      throw coupleError;
    }

    res.status(200).json(successResponse({
      coupleId: couple.id,
      anniversaryDate: couple.anniversary_date,
      celebrateMonths: couple.celebrate_months,
    }, 'Aniversario actualizado'));

  } catch (error: any) {
    console.error('Error en setAnniversary:', error);
    res.status(500).json(errorResponse(error.message, 500));
  }
};

/**
 * @swagger
 * /couple/anniversary:
 *   get:
 *     summary: Obtener información de aniversario
 *     description: Retorna días juntos, próximos aniversarios, etc.
 *     tags: [Parejas]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Información obtenida exitosamente
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
 *                     anniversaryDate:
 *                       type: string
 *                     daysSince:
 *                       type: integer
 *                     daysUntil:
 *                       type: integer
 *                     monthsTogether:
 *                       type: integer
 *       401:
 *         description: No autorizado
 */
export const getAnniversaryInfo = async (req: Request, res: Response) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json(errorResponse('Token no proporcionado', 401));
    }

    const supabaseUser = await getAuthenticatedUser(token);

    // Obtener el usuario y su pareja
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('couple_id')
      .eq('id', supabaseUser.id)
      .single();

    if (userError || !user?.couple_id) {
      return res.status(404).json(errorResponse('No tienes una pareja asignada', 404));
    }

    // Obtener la pareja con la fecha de aniversario
    const { data: couple, error: coupleError } = await supabase
      .from('couples')
      .select('anniversary_date, celebrate_months, created_at')
      .eq('id', user.couple_id)
      .single();

    if (coupleError || !couple?.anniversary_date) {
      return res.status(200).json(successResponse(null, 'No hay fecha de aniversario configurada'));
    }

    // Calcular días y meses
    const anniversaryDate = new Date(couple.anniversary_date);
    const today = new Date();
    
    // Días desde el aniversario
    const daysSince = Math.floor((today.getTime() - anniversaryDate.getTime()) / (1000 * 60 * 60 * 24));
    
    // Próximo aniversario
    const nextAnniversary = new Date(today.getFullYear(), anniversaryDate.getMonth(), anniversaryDate.getDate());
    if (nextAnniversary < today) {
      nextAnniversary.setFullYear(today.getFullYear() + 1);
    }
    const daysUntil = Math.floor((nextAnniversary.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    
    // Meses juntos
    let monthsTogether = (today.getFullYear() - anniversaryDate.getFullYear()) * 12;
    monthsTogether += today.getMonth() - anniversaryDate.getMonth();
    if (today.getDate() < anniversaryDate.getDate()) monthsTogether--;

    res.status(200).json(successResponse({
      anniversaryDate: couple.anniversary_date,
      celebrateMonths: couple.celebrate_months,
      daysSince: daysSince,
      daysUntil: daysUntil,
      monthsTogether: monthsTogether,
      nextAnniversaryDate: nextAnniversary.toISOString().split('T')[0],
    }, 'Información de aniversario'));

  } catch (error: any) {
    console.error('Error en getAnniversaryInfo:', error);
    res.status(500).json(errorResponse(error.message, 500));
  }
};