import ActivityLog from '../models/ActivityLog';
import { getIO } from '../socket';

interface LogActivityParams {
  user: any;
  action: string;
  entityType: 'task' | 'workspace' | 'sprint' | 'user';
  entityId: any;
  entityTitle?: string;
  workspace?: any;
  details?: Record<string, any>;
}

export const logActivity = async ({
  user,
  action,
  entityType,
  entityId,
  entityTitle = '',
  workspace = null,
  details = {},
}: LogActivityParams) => {
  try {
    const log = await ActivityLog.create({
      user: user._id || user,
      action,
      entityType,
      entityId,
      entityTitle,
      workspace,
      details,
    });

    const populatedLog = await ActivityLog.findById(log._id).populate('user', 'name email role avatar');

    const io = getIO();
    if (io) {
      io.emit('activity:created', populatedLog);
      if (workspace) {
        io.to(`workspace:${workspace}`).emit('workspace:activity', populatedLog);
      }
    }

    return populatedLog;
  } catch (error: any) {
    console.error('[ActivityLogger Error]:', error.message);
  }
};
