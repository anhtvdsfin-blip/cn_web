import mongoose from 'mongoose';

const libraryRoomSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  subject: { type: String, trim: true },
  description: { type: String, trim: true },
  startTime: { type: Date },
  endTime: { type: Date },
  capacity: { type: Number, required: true, default: 4 },
  occupants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  invites: [
    {
      senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
      receiverId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
      status: { type: String, enum: ['pending', 'accepted', 'declined', 'expired'], default: 'pending' },
      schedule: {
        startTime: { type: Date },
        endTime: { type: Date },
      },
      note: { type: String, maxlength: 300 },
      expiresAt: { type: Date },
    },
  ],
}, { timestamps: true });

export default mongoose.model('LibraryRoom', libraryRoomSchema);
