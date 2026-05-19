import { Router } from 'express';
import { getTeamMembers, inviteTeamMember, updateTeamMemberRole, removeTeamMember } from '../controllers/team.controller';
import { authenticate, requireRole } from '../middleware/auth';

const router = Router();

router.use(authenticate);

router.get('/', getTeamMembers);
router.post('/invite', requireRole('OWNER', 'ADMIN'), inviteTeamMember);
router.put('/:id/role', requireRole('OWNER', 'ADMIN'), updateTeamMemberRole);
router.delete('/:id', requireRole('OWNER', 'ADMIN'), removeTeamMember);

export default router;
