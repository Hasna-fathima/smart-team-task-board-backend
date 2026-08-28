import express from 'express';
import {
  getWorkspaces,
  getWorkspaceById,
  createWorkspace,
  updateWorkspace,
  deleteWorkspace,
} from '../controllers/workspaceController';
import { protect } from '../middleware/auth';
import { authorize } from '../middleware/authorize';

const router = express.Router();

router.get('/', protect, getWorkspaces);
router.get('/:id', protect, getWorkspaceById);
router.post('/', protect, authorize('admin', 'manager'), createWorkspace);
router.put('/:id', protect, authorize('admin', 'manager'), updateWorkspace);
router.delete('/:id', protect, authorize('admin'), deleteWorkspace);

export default router;
