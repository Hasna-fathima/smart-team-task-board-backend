import { Router } from 'express';
import { protect } from '../middleware/auth';
import { authorize } from '../middleware/authorize';
import { getChatContacts, getConversation, sendMessage, deleteMessage } from '../controllers/messageController';

const router = Router();

// Only admin and manager roles can access messaging
router.use(protect);
router.use(authorize('admin', 'manager'));

router.get('/contacts', getChatContacts);
router.get('/:userId', getConversation);
router.post('/:userId', sendMessage);
router.delete('/:messageId', deleteMessage);

export default router;