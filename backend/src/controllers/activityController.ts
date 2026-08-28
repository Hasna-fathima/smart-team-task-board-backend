import User from '../models/User';
import { Response } from 'express';
import ActivityLog from '../models/ActivityLog';
import { AuthRequest } from '../middleware/auth';

import { getIO } from '../socket';

export const getActivityLogs = async (req: AuthRequest, res: Response) => {
  try {
    const { workspace, page, limit = '10', entityType } = req.query;
    const filter: Record<string, any> = {};

    if (workspace) filter.workspace = workspace;
    if (entityType) filter.entityType = entityType;

    // Enforce role-based visibility restrictions for audit trails
    if (req.user) {
      if (req.user.role === 'employee') {
        filter.user = req.user._id;
      } else if (req.user.role === 'manager') {
        const allowedUsers = await User.find({ role: { $in: ['manager', 'employee'] } }).select('_id');
        const allowedUserIds = allowedUsers.map(u => u._id);
        filter.$or = [
          { user: { $in: allowedUserIds } },
          { user: null }
        ];
      }
    }

    if (page) {
      const pageNum = parseInt(page as string, 10) || 1;
      const limitNum = parseInt(limit as string, 10) || 10;
      const skip = (pageNum - 1) * limitNum;

      const total = await ActivityLog.countDocuments(filter);
      const logs = await ActivityLog.find(filter)
        .populate('user', 'name email avatar role')
        .populate('workspace', 'name')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum);

      return res.json({
        success: true,
        count: logs.length,
        logs,
        pagination: {
          total,
          page: pageNum,
          limit: limitNum,
          pages: Math.ceil(total / limitNum)
        }
      });
    }

    const logs = await ActivityLog.find(filter)
      .populate('user', 'name email avatar role')
      .populate('workspace', 'name')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit as string, 10));

    return res.json({ success: true, count: logs.length, logs });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteActivityLog = async (req: AuthRequest, res: Response) => {
  try {
    const logId = req.params.id;
    const log = await ActivityLog.findById(logId);
    if (!log) {
      return res.status(404).json({ success: false, message: 'Activity log not found' });
    }

    await ActivityLog.findByIdAndDelete(logId);

    const io = getIO();
    if (io) {
      io.emit('activity:deleted', { logId });
    }

    return res.json({ success: true, message: 'Activity log deleted successfully' });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
