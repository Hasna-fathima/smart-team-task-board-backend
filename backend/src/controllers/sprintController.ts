import { Response } from 'express';
import Sprint from '../models/Sprint';
import Workspace from '../models/Workspace';
import { logActivity } from '../utils/activityLogger';
import { getIO } from '../socket';
import { AuthRequest } from '../middleware/auth';

export const getSprints = async (req: AuthRequest, res: Response) => {
  try {
    const filter: Record<string, any> = {};
    if (req.query.workspace) {
      filter.workspace = req.query.workspace;
    }

    const { page, limit } = req.query;

    if (page && limit) {
      const pageNum = parseInt(page as string, 10) || 1;
      const limitNum = parseInt(limit as string, 10) || 10;
      const skip = (pageNum - 1) * limitNum;

      const total = await Sprint.countDocuments(filter);
      const sprints = await Sprint.find(filter)
        .populate('workspace', 'name')
        .populate('createdBy', 'name email avatar')
        .sort({ startDate: 1 })
        .skip(skip)
        .limit(limitNum);

      return res.json({
        success: true,
        count: sprints.length,
        sprints,
        pagination: {
          total,
          page: pageNum,
          limit: limitNum,
          pages: Math.ceil(total / limitNum)
        }
      });
    }

    const sprints = await Sprint.find(filter)
      .populate('workspace', 'name')
      .populate('createdBy', 'name email avatar')
      .sort({ startDate: 1 });

    return res.json({ success: true, count: sprints.length, sprints });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const createSprint = async (req: AuthRequest, res: Response) => {
  try {
    const { workspace, name, goal, startDate, endDate, status } = req.body;

    if (!workspace || !name || !startDate || !endDate) {
      return res.status(400).json({ success: false, message: 'Workspace, name, start date, and end date are required' });
    }

    const ws = await Workspace.findById(workspace);
    if (!ws) {
      return res.status(404).json({ success: false, message: 'Workspace not found' });
    }

    const sprint = await Sprint.create({
      workspace,
      name,
      goal: goal || '',
      startDate,
      endDate,
      status: status || 'planned',
      createdBy: req.user!._id,
    });

    const populatedSprint = await Sprint.findById(sprint._id)
      .populate('workspace', 'name')
      .populate('createdBy', 'name email avatar');

    await logActivity({
      user: req.user!._id,
      action: 'sprint_created',
      entityType: 'sprint',
      entityId: sprint._id,
      entityTitle: sprint.name,
      workspace,
      details: { status: sprint.status, startDate, endDate },
    });

    const io = getIO();
    if (io) {
      io.emit('sprint:created', populatedSprint);
      io.to(`workspace:${workspace}`).emit('workspace:sprint_created', populatedSprint);
    }

    return res.status(201).json({ success: true, sprint: populatedSprint });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const updateSprint = async (req: AuthRequest, res: Response) => {
  try {
    const { name, goal, startDate, endDate, status } = req.body;

    const sprint = await Sprint.findById(req.params.id);
    if (!sprint) {
      return res.status(404).json({ success: false, message: 'Sprint not found' });
    }

    if (name) sprint.name = name;
    if (goal !== undefined) sprint.goal = goal;
    if (startDate) sprint.startDate = startDate;
    if (endDate) sprint.endDate = endDate;
    if (status && ['planned', 'active', 'completed'].includes(status)) {
      sprint.status = status;
    }

    await sprint.save();

    const populatedSprint = await Sprint.findById(sprint._id)
      .populate('workspace', 'name')
      .populate('createdBy', 'name email avatar');

    await logActivity({
      user: req.user!._id,
      action: 'sprint_updated',
      entityType: 'sprint',
      entityId: sprint._id,
      entityTitle: sprint.name,
      workspace: sprint.workspace,
      details: { status: sprint.status },
    });

    const io = getIO();
    if (io) {
      io.emit('sprint:updated', populatedSprint);
      io.to(`workspace:${sprint.workspace}`).emit('workspace:sprint_updated', populatedSprint);
    }

    return res.json({ success: true, sprint: populatedSprint });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteSprint = async (req: AuthRequest, res: Response) => {
  try {
    const sprint = await Sprint.findById(req.params.id);
    if (!sprint) {
      return res.status(404).json({ success: false, message: 'Sprint not found' });
    }

    const workspaceId = sprint.workspace;
    const sprintTitle = sprint.name;

    await logActivity({
      user: req.user!._id,
      action: 'sprint_deleted',
      entityType: 'sprint',
      entityId: sprint._id,
      entityTitle: sprintTitle,
      workspace: workspaceId,
    });

    await Sprint.findByIdAndDelete(req.params.id);

    const io = getIO();
    if (io) {
      io.emit('sprint:deleted', { sprintId: req.params.id });
    }

    return res.json({ success: true, message: `Sprint '${sprintTitle}' deleted successfully` });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
