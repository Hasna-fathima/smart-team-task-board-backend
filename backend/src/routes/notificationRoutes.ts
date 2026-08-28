import express from 'express';
import { getNotifications, createNotification } from '../controllers/notificationController';
import { protect } from '../middleware/auth';

const router = express.Router();

router.get('/', protect, getNotifications);
router.post('/', protect, createNotification);

export default router;
