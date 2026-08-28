import express from 'express';
import { getSprints, createSprint, updateSprint, deleteSprint } from '../controllers/sprintController';
import { protect } from '../middleware/auth';
import { authorize } from '../middleware/authorize';

const router = express.Router();

router.get('/', protect, getSprints);
router.post('/', protect, authorize('admin', 'manager'), createSprint);
router.put('/:id', protect, authorize('admin', 'manager'), updateSprint);
router.delete('/:id', protect, authorize('admin', 'manager'), deleteSprint);

export default router;
