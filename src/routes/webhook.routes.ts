import { Router } from 'express';
import {
  getWebhookEndpoints, createWebhookEndpoint,
  deleteWebhookEndpoint, updateWebhookEndpoint, getWebhookDeliveries
} from '../controllers/webhook.controller';
import { authenticate } from '../middleware/auth';

const router = Router();

router.use(authenticate);

router.get('/endpoints', getWebhookEndpoints);
router.post('/endpoints', createWebhookEndpoint);
router.put('/endpoints/:id', updateWebhookEndpoint);
router.delete('/endpoints/:id', deleteWebhookEndpoint);
router.get('/endpoints/:id/deliveries', getWebhookDeliveries);

export default router;
