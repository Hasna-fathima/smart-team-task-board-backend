import { Response } from 'express';
import Task, { ITask } from '../models/Task';
import User from '../models/User';
import { logActivity } from '../utils/activityLogger';
import { getIO } from '../socket';
import { AuthRequest } from '../middleware/auth';

const isValidStatusTransition = (currentStatus: string, newStatus: string): boolean => {
  if (currentStatus === newStatus) return true;

  const validTransitions: Record<string, string[]> = {
    todo: ['in_progress'],
    in_progress: ['todo', 'review'],
    review: ['in_progress', 'done'],
    done: ['review'],
  };

  return validTransitions[currentStatus]?.includes(newStatus) || false;
};

const checkEmployeeWorkload = async (userId: any): Promise<boolean> => {
  if (!userId) return true;

  const activeTaskCount = await Task.countDocuments({
    assignedTo: userId,
    status: { $in: ['todo', 'in_progress', 'review'] },
  });

  return activeTaskCount < 8;
};

export const getTasks = async (req: AuthRequest, res: Response) => {
  try {
    const { workspace, sprint, status, priority, assignedTo, search } = req.query;
    const filter: Record<string, any> = {};

    if (workspace) filter.workspace = workspace;
    if (sprint) filter.sprint = sprint;
    if (status) filter.status = status;
    if (priority) filter.priority = priority;
    if (assignedTo) {
      if (assignedTo === 'unassigned') {
        filter.assignedTo = null;
      } else {
        filter.assignedTo = assignedTo;
      }
    }

    if (search) {
      filter.$or = [
        { title: { $regex: search as string, $options: 'i' } },
        { description: { $regex: search as string, $options: 'i' } },
      ];
    }

    const tasks = await Task.find(filter)
      .populate('workspace', 'name')
      .populate('sprint', 'name status')
      .populate('assignedTo', 'name email avatar role')
      .populate('createdBy', 'name email avatar role')
      .populate('comments.user', 'name email avatar role')
      .sort({ createdAt: -1 });

    return res.json({ success: true, count: tasks.length, tasks });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getTaskById = async (req: AuthRequest, res: Response) => {
  try {
    const task = await Task.findById(req.params.id)
      .populate('workspace', 'name')
      .populate('sprint', 'name status')
      .populate('assignedTo', 'name email avatar role')
      .populate('createdBy', 'name email avatar role')
      .populate('comments.user', 'name email avatar role');

    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }

    return res.json({ success: true, task });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const createTask = async (req: AuthRequest, res: Response) => {
  try {
    const { title, description, workspace, sprint, priority, status, dueDate, assignedTo, labels } = req.body;

    if (!title || !workspace || !dueDate) {
      return res.status(400).json({ success: false, message: 'Title, workspace, and due date are required' });
    }

    if (assignedTo) {
      const isUnderLimit = await checkEmployeeWorkload(assignedTo);
      if (!isUnderLimit) {
        const user = await User.findById(assignedTo);
        return res.status(400).json({
          success: false,
          message: `Employee workload limit exceeded: ${user ? user.name : 'Assigned user'} already has 8 active tasks (max 8 permitted).`,
        });
      }
    }

    const taskStatus = status || 'todo';

    const task = await Task.create({
      title,
      description: description || '',
      workspace,
      sprint: sprint || null,
      priority: priority || 'medium',
      status: taskStatus,
      dueDate,
      assignedTo: assignedTo || null,
      createdBy: req.user!._id,
      labels: labels || [],
    });

    const populatedTask = await Task.findById(task._id)
      .populate('workspace', 'name')
      .populate('sprint', 'name status')
      .populate('assignedTo', 'name email avatar role')
      .populate('createdBy', 'name email avatar role');

    await logActivity({
      user: req.user!._id,
      action: 'task_created',
      entityType: 'task',
      entityId: task._id,
      entityTitle: task.title,
      workspace,
      details: { status: task.status, priority: task.priority, assignedTo: (populatedTask?.assignedTo as any)?.name || 'Unassigned' },
    });

    const io = getIO();
    if (io) {
      io.emit('task:created', populatedTask);
      io.to(`workspace:${workspace}`).emit('workspace:task_created', populatedTask);
    }

    return res.status(201).json({ success: true, task: populatedTask });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const updateTask = async (req: AuthRequest, res: Response) => {
  try {
    const { title, description, sprint, priority, status, dueDate, assignedTo, labels } = req.body;

    const task = await Task.findById(req.params.id);
    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }

    if (req.user!.role === 'employee') {
      if (title || sprint !== undefined || priority || assignedTo !== undefined || dueDate) {
        return res.status(403).json({
          success: false,
          message: 'Employees are only permitted to update task status.',
        });
      }
    }

    if (status && status !== task.status) {
      if (!isValidStatusTransition(task.status, status)) {
        return res.status(400).json({
          success: false,
          message: `Invalid task status transition from '${task.status}' to '${status}'. Task flow must proceed sequentially: Todo -> In Progress -> Review -> Done. Tasks must pass through Review before Done.`,
        });
      }
    }

    const targetAssignedTo = assignedTo !== undefined ? assignedTo : task.assignedTo;
    const targetStatus = status !== undefined ? status : task.status;

    const isReassigning = assignedTo !== undefined && String(assignedTo) !== String(task.assignedTo);
    const isActivatingDoneTask = task.status === 'done' && targetStatus !== 'done';

    if ((isReassigning || isActivatingDoneTask) && targetAssignedTo) {
      const activeCount = await Task.countDocuments({
        _id: { $ne: task._id },
        assignedTo: targetAssignedTo,
        status: { $in: ['todo', 'in_progress', 'review'] },
      });

      if (activeCount >= 8 && targetStatus !== 'done') {
        const user = await User.findById(targetAssignedTo);
        return res.status(400).json({
          success: false,
          message: `Employee workload limit exceeded: ${user ? user.name : 'Assigned user'} already has 8 active tasks (max 8 permitted).`,
        });
      }
    }

    const previousStatus = task.status;
    const previousAssignedTo = task.assignedTo;

    if (title !== undefined && req.user!.role !== 'employee') task.title = title;
    if (description !== undefined && req.user!.role !== 'employee') task.description = description;
    if (sprint !== undefined && req.user!.role !== 'employee') task.sprint = sprint || null;
    if (priority !== undefined && req.user!.role !== 'employee') task.priority = priority;
    if (dueDate !== undefined && req.user!.role !== 'employee') task.dueDate = dueDate;
    if (labels !== undefined && req.user!.role !== 'employee') task.labels = labels;
    if (assignedTo !== undefined && req.user!.role !== 'employee') task.assignedTo = assignedTo || null;
    if (status !== undefined) task.status = status;

    await task.save();

    const populatedTask = await Task.findById(task._id)
      .populate('workspace', 'name')
      .populate('sprint', 'name status')
      .populate('assignedTo', 'name email avatar role')
      .populate('createdBy', 'name email avatar role')
      .populate('comments.user', 'name email avatar role');

    if (status && status !== previousStatus) {
      await logActivity({
        user: req.user!._id,
        action: 'task_status_changed',
        entityType: 'task',
        entityId: task._id,
        entityTitle: task.title,
        workspace: task.workspace,
        details: { from: previousStatus, to: status },
      });
    }

    if (assignedTo !== undefined && String(assignedTo) !== String(previousAssignedTo)) {
      await logActivity({
        user: req.user!._id,
        action: 'task_assigned',
        entityType: 'task',
        entityId: task._id,
        entityTitle: task.title,
        workspace: task.workspace,
        details: { assignedTo: (populatedTask?.assignedTo as any)?.name || 'Unassigned' },
      });
    }

    const io = getIO();
    if (io) {
      io.emit('task:updated', populatedTask);
      io.to(`workspace:${task.workspace}`).emit('workspace:task_updated', populatedTask);
    }

    return res.json({ success: true, task: populatedTask });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteTask = async (req: AuthRequest, res: Response) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }

    const workspaceId = task.workspace;
    const taskTitle = task.title;

    await logActivity({
      user: req.user!._id,
      action: 'task_deleted',
      entityType: 'task',
      entityId: task._id,
      entityTitle: taskTitle,
      workspace: workspaceId,
    });

    await Task.findByIdAndDelete(req.params.id);

    const io = getIO();
    if (io) {
      io.emit('task:deleted', { taskId: req.params.id, workspaceId });
      io.to(`workspace:${workspaceId}`).emit('workspace:task_deleted', { taskId: req.params.id });
    }

    return res.json({ success: true, message: `Task '${taskTitle}' deleted successfully` });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const addComment = async (req: AuthRequest, res: Response) => {
  try {
    const { text } = req.body;
    if (!text) {
      return res.status(400).json({ success: false, message: 'Comment text is required' });
    }

    const task = await Task.findById(req.params.id);
    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }

    task.comments.push({
      user: req.user!._id,
      text,
    });

    await task.save();

    const populatedTask = await Task.findById(task._id)
      .populate('workspace', 'name')
      .populate('sprint', 'name status')
      .populate('assignedTo', 'name email avatar role')
      .populate('createdBy', 'name email avatar role')
      .populate('comments.user', 'name email avatar role');

    await logActivity({
      user: req.user!._id,
      action: 'comment_added',
      entityType: 'task',
      entityId: task._id,
      entityTitle: task.title,
      workspace: task.workspace,
      details: { comment: text.slice(0, 50) },
    });

    const io = getIO();
    if (io) {
      io.emit('task:updated', populatedTask);
    }

    return res.status(201).json({ success: true, task: populatedTask });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const addAttachment = async (req: AuthRequest, res: Response) => {
  try {
    const { name, url, size } = req.body;
    if (!name || !url) {
      return res.status(400).json({ success: false, message: 'Please provide attachment name and URL' });
    }

    const task = await Task.findById(req.params.id);
    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }

    task.attachments.push({
      name,
      url,
      size: size || '1.0 MB',
    });

    await task.save();

    const populatedTask = await Task.findById(task._id)
      .populate('workspace', 'name')
      .populate('sprint', 'name status')
      .populate('assignedTo', 'name email avatar role')
      .populate('createdBy', 'name email avatar role')
      .populate('comments.user', 'name email avatar role');

    await logActivity({
      user: req.user!._id,
      action: 'task_updated',
      entityType: 'task',
      entityId: task._id,
      entityTitle: task.title,
      workspace: task.workspace,
      details: { attachment: name },
    });

    const io = getIO();
    if (io) {
      io.emit('task:updated', populatedTask);
    }

    return res.status(201).json({ success: true, task: populatedTask });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
