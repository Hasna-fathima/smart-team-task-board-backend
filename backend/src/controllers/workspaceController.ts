import { Response } from 'express';
import Workspace from '../models/Workspace';
import Sprint from '../models/Sprint';
import Task from '../models/Task';
import { logActivity } from '../utils/activityLogger';
import { getIO } from '../socket';
import { AuthRequest } from '../middleware/auth';

export const getWorkspaces = async (req: AuthRequest, res: Response) => {
  try {
    const workspaces = await Workspace.find()
      .populate('owner', 'name email avatar role')
      .populate('members', 'name email avatar role')
      .sort({ createdAt: -1 });

    return res.json({ success: true, count: workspaces.length, workspaces });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getWorkspaceById = async (req: AuthRequest, res: Response) => {
  try {
    const workspace = await Workspace.findById(req.params.id)
      .populate('owner', 'name email avatar role')
      .populate('members', 'name email avatar role');

    if (!workspace) {
      return res.status(404).json({ success: false, message: 'Workspace not found' });
    }

    return res.json({ success: true, workspace });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const createWorkspace = async (req: AuthRequest, res: Response) => {
  try {
    const { name, description, members } = req.body;

    if (!name) {
      return res.status(400).json({ success: false, message: 'Workspace name is required' });
    }

    const workspace = await Workspace.create({
      name,
      description: description || '',
      owner: req.user!._id,
      members: members || [req.user!._id],
    });

    const populatedWorkspace = await Workspace.findById(workspace._id)
      .populate('owner', 'name email avatar role')
      .populate('members', 'name email avatar role');

    await logActivity({
      user: req.user!._id,
      action: 'workspace_created',
      entityType: 'workspace',
      entityId: workspace._id,
      entityTitle: workspace.name,
      workspace: workspace._id,
    });

    const io = getIO();
    if (io) {
      io.emit('workspace:created', populatedWorkspace);
    }

    return res.status(201).json({ success: true, workspace: populatedWorkspace });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const updateWorkspace = async (req: AuthRequest, res: Response) => {
  try {
    const { name, description, members, isArchived } = req.body;

    const workspace = await Workspace.findById(req.params.id);
    if (!workspace) {
      return res.status(404).json({ success: false, message: 'Workspace not found' });
    }

    if (name !== undefined) workspace.name = name;
    if (description !== undefined) workspace.description = description;
    if (members !== undefined) workspace.members = members;
    if (isArchived !== undefined) workspace.isArchived = isArchived;

    await workspace.save();

    const populatedWorkspace = await Workspace.findById(workspace._id)
      .populate('owner', 'name email avatar role')
      .populate('members', 'name email avatar role');

    await logActivity({
      user: req.user!._id,
      action: isArchived ? 'workspace_archived' : 'workspace_updated',
      entityType: 'workspace',
      entityId: workspace._id,
      entityTitle: workspace.name,
      workspace: workspace._id,
      details: { isArchived: workspace.isArchived },
    });

    const io = getIO();
    if (io) {
      io.emit('workspace:updated', populatedWorkspace);
    }

    return res.json({ success: true, workspace: populatedWorkspace });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteWorkspace = async (req: AuthRequest, res: Response) => {
  try {
    const workspaceId = req.params.id;
    const workspace = await Workspace.findById(workspaceId);

    if (!workspace) {
      return res.status(404).json({ success: false, message: 'Workspace not found' });
    }

    // Business Rule: Workspaces with active sprints cannot be deleted.
    const activeSprints = await Sprint.find({ workspace: workspaceId, status: 'active' });
    if (activeSprints.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete workspace '${workspace.name}'. It has ${activeSprints.length} active sprint(s). Complete or complete active sprints before deleting.`,
      });
    }

    await Sprint.deleteMany({ workspace: workspaceId });
    await Task.deleteMany({ workspace: workspaceId });

    await logActivity({
      user: req.user!._id,
      action: 'workspace_deleted',
      entityType: 'workspace',
      entityId: workspace._id,
      entityTitle: workspace.name,
    });

    await Workspace.findByIdAndDelete(workspaceId);

    const io = getIO();
    if (io) {
      io.emit('workspace:deleted', { workspaceId });
    }

    return res.json({ success: true, message: `Workspace '${workspace.name}' deleted successfully.` });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
