import { Router } from 'express';
import { getTodaysQuestion, answerQuestion, getAnswerHistory } from '../controllers/questionController';

const router = Router();

router.get('/questions/today', getTodaysQuestion);
router.post('/questions/answer', answerQuestion);
router.get('/questions/history', getAnswerHistory);

export default router;