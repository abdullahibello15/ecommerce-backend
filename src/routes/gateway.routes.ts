import { Router } from 'express';
import { getGateways, getGateway, updateGateway, getGatewayLogs } from '../controllers/gateway.controller';
import { authenticate, requireRole } from '../middleware/auth';

const router = Router();

router.use(authenticate);

router.get('/', getGateways);
router.get('/:id', getGateway);
router.put('/:id', requireRole('OWNER', 'ADMIN'), updateGateway);
router.get('/:id/logs', getGatewayLogs);

export default router;
