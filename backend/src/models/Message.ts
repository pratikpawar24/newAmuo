import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IMessage extends Document {
  chatRoomId: string;
  sender: Types.ObjectId;
  content: string;
  messageType: 'text' | 'system' | 'price_offer' | 'price_accept' | 'price_reject';
  priceOffer?: number;
  readBy: Types.ObjectId[];
  createdAt: Date;
}

const MessageSchema = new Schema<IMessage>(
  {
    chatRoomId: { type: String, required: true, index: true },
    sender: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    content: { type: String, required: true },
    messageType: {
      type: String,
      enum: ['text', 'system', 'price_offer', 'price_accept', 'price_reject'],
      default: 'text',
    },
    priceOffer: { type: Number },
    readBy: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  },
  { timestamps: true }
);

MessageSchema.index({ chatRoomId: 1, createdAt: 1 });

export const Message = mongoose.model<IMessage>('Message', MessageSchema);
