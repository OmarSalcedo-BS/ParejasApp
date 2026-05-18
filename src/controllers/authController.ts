import { Request, Response } from 'express';
import { supabase } from '../config/supabase';
import { successResponse, errorResponse } from '../utils/responseUtils';

/**
 * @swagger
 * /auth/register:
 *   post:
 *     summary: Registrar un nuevo usuario
 *     tags: [Autenticación]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *               displayName:
 *                 type: string
 *     responses:
 *       201:
 *         description: Usuario registrado exitosamente
 *       400:
 *         description: Datos inválidos
 *       500:
 *         description: Error del servidor
 */
export const register = async (req: Request, res: Response) => {
  try {
    const { email, password, displayName } = req.body;

    if (!email || !password) {
      return res.status(400).json(errorResponse('Email y contraseña son requeridos', 400));
    }

    // 1. Registrar en Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { display_name: displayName || email.split('@')[0] }
      }
    });

    if (authError) throw authError;

    if (!authData.user) {
      throw new Error('No se pudo crear el usuario en Auth');
    }

    // 2. Crear el usuario en nuestra tabla public.users
    const { error: insertError } = await supabase
      .from('users')
      .insert({
        id: authData.user.id,  // Supabase usa UUID, pero lo guardamos como TEXT
        email: authData.user.email,
        display_name: displayName || email.split('@')[0],
      });

    if (insertError) {
      console.error('Error insertando en users:', insertError);

    }

    res.status(201).json(successResponse({
      user: {
        id: authData.user.id,
        email: authData.user.email,
        displayName: displayName || email.split('@')[0],
      }
    }, 'Registro exitoso'));

  } catch (error: any) {
    console.error('Error en registro:', error);
    res.status(500).json(errorResponse(error.message, 500));
  }
};


/**
 * @swagger
 * /auth/login:
 *   post:
 *     summary: Iniciar sesión
 *     tags: [Autenticación]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Login exitoso
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
      user: {
        id: data.user.id,
        email: data.user.email,
        displayName: data.user.user_metadata?.display_name,
      }
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
 *     tags: [Autenticación]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Perfil obtenido
 *       401:
 *         description: No autorizado
 */
export const getProfile = async (req: Request, res: Response) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json(errorResponse('Token no proporcionado', 401));
    }

    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      return res.status(401).json(errorResponse('Token inválido o expirado', 401));
    }

    res.status(200).json(successResponse({
      id: user.id,
      email: user.email,
      displayName: user.user_metadata?.display_name,
    }, 'Perfil obtenido'));

  } catch (error: any) {
    console.error('Error en getProfile:', error);
    res.status(500).json(errorResponse(error.message, 500));
  }
};
