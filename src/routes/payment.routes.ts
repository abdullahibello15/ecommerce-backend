import { Router } from 'express';
import { initializePayment, verifyPayment } from '../controllers/payment.controller';
import { authenticate } from '../middleware/auth';

const router = Router();

router.use(authenticate);

router.post('/initialize', initializePayment);
router.get('/verify/:reference', verifyPayment);

export default router;
