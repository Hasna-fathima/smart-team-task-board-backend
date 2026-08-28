import express from 'express';
import { getActivityLogs, deleteActivityLog } from '../controllers/activityController';
import { protect } from '../middleware/auth';

const router = express.Router();

router.get('/', protect, getActivityLogs);
router.delete('/:id', protect, deleteActivityLog);

export default router;
