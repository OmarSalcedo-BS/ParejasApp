import { Router } from 'express';
import { createCouple, joinCouple, getCoupleInfo, setAnniversary, getAnniversaryInfo } from '../controllers/coupleController';

const router = Router();

router.post('/couple/create', createCouple);
router.post('/couple/join', joinCouple);
router.get('/couple/info', getCoupleInfo);
router.post('/couple/anniversary', setAnniversary);   
router.get('/couple/anniversary', getAnniversaryInfo);

export default router;