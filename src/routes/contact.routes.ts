import { Router } from 'express';
import { submitContact } from '../controllers/contact.controller';

const router = Router();

router.post('/', submitContact);  // Public — no auth required

export default router;
