import mongoose, { Document, Schema } from 'mongoose';

export interface ISprint extends Document {
  workspace: mongoose.Types.ObjectId;
  name: string;
  goal: string;
  startDate: Date;
  endDate: Date;
  status: 'planned' | 'active' | 'completed';
  createdBy: mongoose.Types.ObjectId;
  expiryWarningSent?: boolean;
  expiryAlertSent?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const sprintSchema = new Schema<ISprint>(
  {
    workspace: {
      type: Schema.Types.ObjectId,
      ref: 'Workspace',
      required: [true, 'Workspace ID is required'],
    },
    name: {
      type: String,
      required: [true, 'Sprint name is required'],
      trim: true,
    },
    goal: {
      type: String,
      default: '',
    },
    startDate: {
      type: Date,
      required: [true, 'Start date is required'],
    },
    endDate: {
      type: Date,
      required: [true, 'End date is required'],
    },
    status: {
      type: String,
      enum: ['planned', 'active', 'completed'],
      default: 'planned',
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    expiryWarningSent: {
      type: Boolean,
      default: false,
    },
    expiryAlertSent: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model<ISprint>('Sprint', sprintSchema);
