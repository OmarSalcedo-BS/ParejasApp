import { Request, Response } from 'express';
import { supabase } from '../config/supabase';
import { successResponse, errorResponse } from '../utils/responseUtils';
import { prisma } from '../config/prisma'; 

/**
 * @swagger
 * /auth/register:
 *   post:
 *     summary: Registrar un nuevo usuario
 *     description: Crea una cuenta nueva en la aplicación
 *     tags: [Autenticación]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RegisterRequest'
 *     responses:
 *       201:
 *         description: Usuario registrado exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthResponse'
 *       400:
 *         description: Faltan datos requeridos
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Error del servidor
 */
export const register = async (req: Request, res: Response) => {
  try {
    const { email, password, displayName } = req.body;

    if (!email || !password) {
      return res.status(400).json(errorResponse('Email y contraseña son requeridos', 400));
    }

    // 1. Registrar usuario en Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { display_name: displayName || email.split('@')[0] }
      }
    });

    if (authError) throw authError;

    if (!authData.user) {
      throw new Error('No se pudo crear el usuario');
    }

    // 2. Crear el usuario en nuestra tabla de Prisma
    await prisma.user.create({
      data: {
        id: authData.user.id,  // Mismo ID que en Supabase
        email: authData.user.email!,
        displayName: displayName || email.split('@')[0],
      }
    });

    res.status(201).json(successResponse({
      user: {
        id: authData.user.id,
        email: authData.user.email,
        displayName: displayName || email.split('@')[0],
      },
      message: 'Usuario registrado exitosamente'
    }, 'Registro exitoso'));

  } catch (error: any) {
    console.error('Error en registro:', error);
    res.status(500).json(errorResponse(error.message, 500));
  }
};

const syncUserToPrisma = async (userId: string, email: string, displayName?: string) => {
  const existingUser = await prisma.user.findUnique({
    where: { id: userId }
  });
  
  if (!existingUser) {
    await prisma.user.create({
      data: {
        id: userId,
        email: email,
        displayName: displayName || email.split('@')[0],
      }
    });
    console.log(`✅ Usuario ${email} sincronizado con Prisma`);
  }
  
  return true;
};


/**
 * @swagger
 * /auth/login:
 *   post:
 *     summary: Iniciar sesión
 *     description: Autentica un usuario y devuelve un token JWT
 *     tags: [Autenticación]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LoginRequest'
 *     responses:
 *       200:
 *         description: Login exitoso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthResponse'
 *       400:
 *         description: Faltan datos requeridos
 *       401:
 *         description: Credenciales inválidas
 */
export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json(errorResponse('Email y contraseña son requeridos', 400));
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw error;

    res.status(200).json(successResponse({
      session: data.session,
      user: data.user
    }, 'Login exitoso'));

  } catch (error: any) {
    console.error('Error en login:', error);
    res.status(401).json(errorResponse(error.message, 401));
  }
};

/**
 * @swagger
 * /auth/profile:
 *   get:
 *     summary: Obtener perfil del usuario
 *     description: Retorna la información del usuario autenticado
 *     tags: [Autenticación]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Perfil obtenido exitosamente
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
 *                     id:
 *                       type: string
 *                     email:
 *                       type: string
 *                     displayName:
 *                       type: string
 *       401:
 *         description: No autorizado - Token inválido o no proporcionado
 */
export const getProfile = async (req: Request, res: Response) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json(errorResponse('Token no proporcionado', 401));
    }

    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      return res.status(401).json(errorResponse('Token inválido', 401));
    }

    res.status(200).json(successResponse({
      id: user.id,
      email: user.email,
      displayName: user.user_metadata?.display_name,
    }, 'Perfil obtenido'));

  } catch (error: any) {
    res.status(500).json(errorResponse(error.message, 500));
  }
};

