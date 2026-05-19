import { Router } from 'express';
import { getBillingPlans, getCurrentPlan, upgradePlan } from '../controllers/billing.controller';
import { authenticate, requireRole } from '../middleware/auth';

const router = Router();

router.use(authenticate);

router.get('/plans', getBillingPlans);
router.get('/plan', getCurrentPlan);
router.post('/upgrade', requireRole('OWNER'), upgradePlan);

export default router;
