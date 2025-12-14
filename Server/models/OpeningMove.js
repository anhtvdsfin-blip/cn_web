import mongoose from 'mongoose';

const openingMoveSchema = new mongoose.Schema({
  text: {
    type: String,
    required: true,
    trim: true,
  },
  category: {
    type: String,
    required: true,
    trim: true,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
}, {
  timestamps: true,
});

export default mongoose.model('OpeningMove', openingMoveSchema);
