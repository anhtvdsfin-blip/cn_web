import mongoose from 'mongoose';

const reportSchema = new mongoose.Schema({
  reporterId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  targetId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  reason: { type: String, default: 'Không hợp lệ / vi phạm' },
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model('Report', reportSchema);