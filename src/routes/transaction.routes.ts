import { Router } from 'express';
import { getTransactions, getTransaction, exportTransactions } from '../controllers/transaction.controller';
import { authenticate } from '../middleware/auth';

const router = Router();

router.use(authenticate);

router.get('/', getTransactions);
router.get('/export', exportTransactions);   // Must come BEFORE /:reference
router.get('/:reference', getTransaction);

export default router;
