import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import Message from '../models/Message';
import User from '../models/User';
import { getIO } from '../socket';

export const getChatContacts = async (req: AuthRequest, res: Response) => {
  try {
    const me = req.user!._id;
    const contacts = await User.find({
      _id: { $ne: me },
      role: { $in: ['admin', 'manager'] },
    }).select('name email role avatar');

    const contactsWithUnread = await Promise.all(
      contacts.map(async (c) => {
        const unread = await Message.countDocuments({ sender: c._id, receiver: me, read: false });
        return { ...c.toObject(), unread };
      })
    );

    res.json({ success: true, data: contactsWithUnread });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};

export const getConversation = async (req: AuthRequest, res: Response) => {
  try {
    const me = req.user!._id;
    const other = req.params.userId;

    const messages = await Message.find({
      $or: [
        { sender: me, receiver: other },
        { sender: other, receiver: me },
      ],
    })
      .sort({ createdAt: 1 })
      .limit(200)
      .populate('sender', 'name role avatar')
      .populate('receiver', 'name role avatar');

    await Message.updateMany({ sender: other, receiver: me, read: false }, { read: true });

    const io = getIO();
    if (io) {
      io.to('user:' + other).emit('messages:read', { by: me.toString(), from: other });
    }

    res.json({ success: true, data: messages });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};

export const sendMessage = async (req: AuthRequest, res: Response) => {
  try {
    const me = req.user!._id;
    const other = req.params.userId;
    const { text } = req.body;

    if (!text || !text.trim()) {
      return res.status(400).json({ success: false, message: 'Message text is required' });
    }

    const message = await Message.create({
      sender: me,
      receiver: other,
      text: text.trim(),
    });

    const populated = await message.populate([
      { path: 'sender', select: 'name role avatar' },
      { path: 'receiver', select: 'name role avatar' },
    ]);

    const io = getIO();
    if (io) {
      io.to('user:' + other).emit('message:new', populated);
      io.to('user:' + me.toString()).emit('message:new', populated);
    }

    res.status(201).json({ success: true, data: populated });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};

// DELETE /api/messages/:messageId - delete your own message
export const deleteMessage = async (req: AuthRequest, res: Response) => {
  try {
    const me = req.user!._id;
    const { messageId } = req.params;

    const message = await Message.findById(messageId);

    if (!message) {
      return res.status(404).json({ success: false, message: 'Message not found' });
    }

    // Only the sender can delete their own message
    if (message.sender.toString() !== me.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized to delete this message' });
    }

    const receiverId = message.receiver.toString();
    await message.deleteOne();

    // Notify both users in real-time
    const io = getIO();
    if (io) {
      io.to('user:' + me.toString()).emit('message:deleted', { messageId });
      io.to('user:' + receiverId).emit('message:deleted', { messageId });
    }

    res.json({ success: true, data: { messageId } });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};