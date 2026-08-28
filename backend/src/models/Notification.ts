import mongoose, { Document, Schema } from 'mongoose';

export interface INotification extends Document {
  sender: mongoose.Types.ObjectId;
  message: string;
  createdAt: Date;
}

const notificationSchema = new Schema<INotification>(
  {
    sender: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    message: {
      type: String,
      required: [true, 'Message is required'],
      trim: true,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

export default mongoose.model<INotification>('Notification', notificationSchema);
