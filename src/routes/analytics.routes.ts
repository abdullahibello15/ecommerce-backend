import { Router } from 'express';
import { getRevenueAnalytics, getGatewayAnalytics, getKPIs } from '../controllers/analytics.controller';
import { authenticate } from '../middleware/auth';

const router = Router();

router.use(authenticate);

router.get('/revenue', getRevenueAnalytics);
router.get('/gateways', getGatewayAnalytics);
router.get('/kpis', getKPIs);

export default router;
