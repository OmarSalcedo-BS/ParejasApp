import { Router } from 'express';
import { testSupabaseConnection } from '../controllers/supabaseTestController';

const router = Router();

router.get('/test-supabase', testSupabaseConnection);

export default router;