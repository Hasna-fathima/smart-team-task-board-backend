import mongoose from 'mongoose';
import { Response } from 'express';
import Task from '../models/Task';
import User from '../models/User';
import { AuthRequest } from '../middleware/auth';

export const getDashboardStats = async (req: AuthRequest, res: Response) => {
  try {
    const { workspace } = req.query;
    const filter: Record<string, any> = {};
    if (workspace) {
      filter.workspace = new mongoose.Types.ObjectId(workspace as string);
    }

    const now = new Date();

    const totalTasks = await Task.countDocuments(filter);
    const completedTasks = await Task.countDocuments({ ...filter, status: 'done' });
    const overdueTasks = await Task.countDocuments({
      ...filter,
      dueDate: { $lt: now },
      status: { $ne: 'done' },
    });

    const priorityBreakdownRaw = await Task.aggregate([
      { $match: filter },
      { $group: { _id: '$priority', count: { $sum: 1 } } },
    ]);

    const priorityBreakdown: Record<string, number> = {
      low: 0,
      medium: 0,
      high: 0,
      urgent: 0,
    };
    priorityBreakdownRaw.forEach((item) => {
      if (item._id && priorityBreakdown[item._id] !== undefined) {
        priorityBreakdown[item._id] = item.count;
      }
    });

    const statusBreakdownRaw = await Task.aggregate([
      { $match: filter },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);

    const statusBreakdown: Record<string, number> = {
      todo: 0,
      in_progress: 0,
      review: 0,
      done: 0,
    };
    statusBreakdownRaw.forEach((item) => {
      if (item._id && statusBreakdown[item._id] !== undefined) {
        statusBreakdown[item._id] = item.count;
      }
    });

    const employees = await User.find({ role: 'employee' }).select('name email avatar role');

    const employeeStats = await Promise.all(
      employees.map(async (emp) => {
        const empFilter = { ...filter, assignedTo: emp._id };

        const empTotal = await Task.countDocuments(empFilter);
        const empActive = await Task.countDocuments({
          ...empFilter,
          status: { $in: ['todo', 'in_progress', 'review'] },
        });
        const empCompleted = await Task.countDocuments({ ...empFilter, status: 'done' });
        const empOverdue = await Task.countDocuments({
          ...empFilter,
          dueDate: { $lt: now },
          status: { $ne: 'done' },
        });

        return {
          user: emp,
          totalTasks: empTotal,
          activeTasks: empActive,
          completedTasks: empCompleted,
          overdueTasks: empOverdue,
          isAtCapacity: empActive >= 8,
          capacityPercentage: Math.min(100, Math.round((empActive / 8) * 100)),
        };
      })
    );

    return res.json({
      success: true,
      stats: {
        totalTasks,
        completedTasks,
        overdueTasks,
        activeTasks: totalTasks - completedTasks,
        completionRate: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0,
        priorityBreakdown,
        statusBreakdown,
        employeeStats,
      },
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
