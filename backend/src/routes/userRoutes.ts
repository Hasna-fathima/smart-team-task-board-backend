import express from 'express';
import { getUsers, updateUser, deleteUser, getUserProfile } from '../controllers/userController';
import { protect } from '../middleware/auth';
import { authorize } from '../middleware/authorize';

const router = express.Router();

router.get('/', protect, getUsers);
router.get('/:id/profile', protect, getUserProfile);
router.put('/:id', protect, authorize('admin'), updateUser);
router.delete('/:id', protect, authorize('admin'), deleteUser);

export default router;
