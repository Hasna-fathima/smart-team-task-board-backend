import express from 'express';
import {
  getTasks,
  getTaskById,
  createTask,
  updateTask,
  deleteTask,
  addComment,
  addAttachment,
} from '../controllers/taskController';
import { protect } from '../middleware/auth';
import { authorize } from '../middleware/authorize';

const router = express.Router();

router.get('/', protect, getTasks);
router.get('/:id', protect, getTaskById);
router.post('/', protect, authorize('admin', 'manager'), createTask);
router.put('/:id', protect, updateTask);
router.delete('/:id', protect, authorize('admin', 'manager'), deleteTask);
router.post('/:id/comments', protect, addComment);
router.post('/:id/attachments', protect, addAttachment);

export default router;
