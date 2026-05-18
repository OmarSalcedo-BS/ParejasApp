import { Router } from 'express';
import { register, login, getProfile } from '../controllers/authController';

const router = Router();

router.post('/auth/register', register);
router.post('/auth/login', login);
router.get('/auth/profile', getProfile);

export default router;