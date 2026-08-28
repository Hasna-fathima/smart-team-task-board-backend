import { saveAvatar } from '../utils/imageSaver';
import { Response } from 'express';
import User from '../models/User';
import Task from '../models/Task';
import { logActivity } from '../utils/activityLogger';
import { getIO } from '../socket';
import { AuthRequest } from '../middleware/auth';

export const getUsers = async (req: AuthRequest, res: Response) => {
  try {
    const { page, limit } = req.query;

    if (page && limit) {
      const pageNum = parseInt(page as string, 10) || 1;
      const limitNum = parseInt(limit as string, 10) || 10;
      const skip = (pageNum - 1) * limitNum;

      const total = await User.countDocuments();
      const users = await User.find()
        .select('-password')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum);

      return res.json({
        success: true,
        count: users.length,
        users,
        pagination: {
          total,
          page: pageNum,
          limit: limitNum,
          pages: Math.ceil(total / limitNum)
        }
      });
    }

    const users = await User.find().select('-password').sort({ createdAt: -1 });
    return res.json({ success: true, count: users.length, users });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const updateUser = async (req: AuthRequest, res: Response) => {
  try {
    const { name, role, email, avatar } = req.body;
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (name) user.name = name;
    if (role && ['admin', 'manager', 'employee'].includes(role)) user.role = role;
    if (email) user.email = email.toLowerCase();
    if (avatar) {
      user.avatar = saveAvatar(avatar);
    }

    await user.save();

    await logActivity({
      user: req.user!._id,
      action: 'user_updated',
      entityType: 'user',
      entityId: user._id,
      entityTitle: user.name,
      details: { role: user.role, email: user.email },
    });

    return res.json({ success: true, user });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteUser = async (req: AuthRequest, res: Response) => {
  try {
    const userIdToDelete = req.params.id;

    if (userIdToDelete === req.user!._id.toString()) {
      return res.status(400).json({ success: false, message: 'You cannot delete your own account while logged in.' });
    }

    const userToDelete = await User.findById(userIdToDelete);
    if (!userToDelete) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Business Rule: Deleted users' tasks become Unassigned (assignedTo: null)
    const updateResult = await Task.updateMany(
      { assignedTo: userIdToDelete },
      { $set: { assignedTo: null } }
    );

    await logActivity({
      user: req.user!._id,
      action: 'user_deleted',
      entityType: 'user',
      entityId: userToDelete._id,
      entityTitle: userToDelete.name,
      details: {
        unassignedTasksCount: updateResult.modifiedCount,
        deletedUserEmail: userToDelete.email,
      },
    });

    await User.findByIdAndDelete(userIdToDelete);

    const io = getIO();
    if (io) {
      io.emit('user:deleted', { userId: userIdToDelete, unassignedTasksCount: updateResult.modifiedCount });
      io.emit('task:unassigned_bulk', { userId: userIdToDelete });
    }

    return res.json({
      success: true,
      message: `User ${userToDelete.name} deleted successfully. ${updateResult.modifiedCount} tasks were set to Unassigned.`,
      unassignedTasksCount: updateResult.modifiedCount,
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getUserProfile = async (req: AuthRequest, res: Response) => {
  try {
    const targetId = req.params.id === 'me' ? req.user!._id : req.params.id;
    const user = await User.findById(targetId).select('-password');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const { workspace } = req.query;
    const filter: Record<string, any> = { assignedTo: targetId };
    if (workspace) {
      filter.workspace = workspace;
    }

    const totalTasks = await Task.countDocuments(filter);
    const completedTasks = await Task.countDocuments({ ...filter, status: 'done' });
    const activeTasks = await Task.countDocuments({ ...filter, status: { $ne: 'done' } });
    const overdueTasks = await Task.countDocuments({
      ...filter,
      status: { $ne: 'done' },
      dueDate: { $lt: new Date() }
    });

    const tasksList = await Task.find(filter)
      .populate('workspace', 'name')
      .populate('sprint', 'name')
      .sort({ updatedAt: -1 });

    return res.json({
      success: true,
      user,
      stats: {
        totalTasks,
        completedTasks,
        activeTasks,
        overdueTasks
      },
      tasks: tasksList
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
