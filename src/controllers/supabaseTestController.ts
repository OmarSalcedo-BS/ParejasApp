import { Request, Response } from 'express';
import { supabase } from '../config/supabase';
import { successResponse, errorResponse } from '../utils/responseUtils';

export const testSupabaseConnection = async (req: Request, res: Response) => {
  try {
    // Prueba simple: obtener la versión de la BD
    const { data, error } = await supabase
      .from('users')
      .select('count', { count: 'exact', head: true });
    
    if (error) throw error;
    
    res.status(200).json(successResponse({
      connected: true,
      message: 'Conexión a Supabase exitosa',
      tableExists: true,
    }));
  } catch (error: any) {
    res.status(500).json(errorResponse(`Error de conexión: ${error.message}`, 500));
  }
};