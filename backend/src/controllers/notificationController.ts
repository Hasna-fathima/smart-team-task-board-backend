import { Response } from 'express';
import Notification from '../models/Notification';
import { AuthRequest } from '../middleware/auth';
import { getIO } from '../socket';

export const getNotifications = async (req: AuthRequest, res: Response) => {
  try {
    if (req.user!.role !== 'admin' && req.user!.role !== 'manager') {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    const notifications = await Notification.find()
      .populate('sender', 'name email avatar role')
      .sort({ createdAt: -1 })
      .limit(20);

    return res.json({ success: true, notifications });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const createNotification = async (req: AuthRequest, res: Response) => {
  try {
    if (req.user!.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Only administrators can broadcast notifications.' });
    }

    const { message } = req.body;
    if (!message || !message.trim()) {
      return res.status(400).json({ success: false, message: 'Please provide a message' });
    }

    const notification = await Notification.create({
      sender: req.user!._id,
      message: message.trim(),
    });

    const populated = await Notification.findById(notification._id).populate(
      'sender',
      'name email avatar role'
    );

    const io = getIO();
    if (io) {
      io.emit('notification:created', populated);
    }

    return res.status(201).json({ success: true, notification: populated });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
