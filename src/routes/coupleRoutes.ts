import { Router } from 'express';
import { createCouple, joinCouple, getCoupleInfo } from '../controllers/coupleController';

const router = Router();

router.post('/couple/create', createCouple);
router.post('/couple/join', joinCouple);
router.get('/couple/info', getCoupleInfo);

export default router;