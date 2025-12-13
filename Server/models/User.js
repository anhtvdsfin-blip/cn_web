// models/User.js
import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: true 
  },
  email: { 
    type: String, 
    required: true, 
    unique: true 
  },
  password: { 
    type: String, 
    required: true 
  },
  gender: { 
    type: String, 
    enum: ['Male', 'Female', 'Other'], 
    default: 'Other'  // Thêm default
  },

  classYear: {
    type: String,
    default: 'Not updated'
  },

  preferences: {
    lookingFor: { 
      type: String, 
      enum: ['Male', 'Female', 'All'],
      default: 'All'
    },
    connectionGoal: {
      type: String,
      enum: ['study', 'friendship', 'relationship', ''],
      default: ''
    },
    studySubjects: {
      type: [String],
      default: []
    },
    ageRange: {
      min: { type: Number, default: 18 },
      max: { type: Number, default: 26 }
    },
    distance: { type: Number, default: 50 } 
  },

  dob: { 
    type: Date,
    default: null
  },
  career: { 
    type: String,
    default: 'Not updated'  // Thêm default
  },
  hobbies: { 
    type: [String],
    default: []
  },
  studySubjects: {
    type: [String],
    default: []
  },
  academicHighlights: {
    type: String,
    default: ''
  },
  connectionGoal: {
    type: String,
    enum: ['friendship', 'relationship', ''],
    default: ''
  },
  location: {
    type: String,
    default: 'Not updated'
  },
  geoLocation: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: {
      type: [Number],
      default: [0, 0]
    } // [longitude, latitude]
  },
  hometown: {
    type: String,
    default: 'Not updated'
  },
  zodiac: { 
    type: String,
    default: 'Unknown'  // Thêm default
  },
  bio: {
    type: String,
    default: 'Not updated'
  },

  height: {
    type: Number,
    default: 0
  },

  avatar: {
    type: String,
    default: ''
  },
  
  photoGallery: {
    type: [String],
    default: []
  },

  
  // Profile completion status
  profileCompleted: {
    type: Boolean,
    default: false
  },

  // Users that this user has blocked
  blockedUsers: {
    type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    default: []
  },
  
  createdAt: { 
    type: Date, 
    default: Date.now 
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  lastActive: { 
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true  // Tự động tạo createdAt và updatedAt
});

userSchema.index({ geoLocation: '2dsphere' });
userSchema.methods.isProfileComplete = function() {
  const normalizeString = (value) =>
    typeof value === 'string' ? value.trim() : '';

  const hasGender = normalizeString(this.gender).length > 0;
  const hasDob = this.dob instanceof Date && !Number.isNaN(this.dob.valueOf());
  const hometownFilled = normalizeString(this.hometown) && this.hometown !== 'Not updated';
  const locationFilled = normalizeString(this.location) && this.location !== 'Not updated';
  const careerFilled = normalizeString(this.career) && this.career !== 'Not updated';
  const classYearFilled = normalizeString(this.classYear) && this.classYear !== 'Not updated';
  const normalizedBio = normalizeString(this.bio);
  const bioFilled = normalizedBio.length >= 10 && this.bio !== 'Not updated';
  const hasHobbies = Array.isArray(this.hobbies) && this.hobbies.length > 0;
  const connectionGoalFilled = normalizeString(this.connectionGoal).length > 0
    || normalizeString(this.preferences?.connectionGoal).length > 0;

  const hasAvatar = typeof this.avatar === 'string' && normalizeString(this.avatar).length > 0;
  const hasGallery = Array.isArray(this.photoGallery)
    && this.photoGallery.some((url) => normalizeString(url).length > 0);
  const hasVisualIdentity = hasAvatar || hasGallery || normalizeString(this.name).length > 0;
  const heightValue = typeof this.height === 'number' ? this.height : Number(this.height);
  const hasHeight = Number.isFinite(heightValue) && heightValue >= 120 && heightValue <= 220;

  const hasLocation = hometownFilled || locationFilled;
  return Boolean(
    hasGender
    && hasDob
    && hasLocation
    && connectionGoalFilled
    && hasHeight
    && hasVisualIdentity
    && careerFilled
    && classYearFilled
    && (bioFilled || hasHobbies)
  );
};

userSchema.virtual('avatarInitial').get(function() {
  const normalizedName = typeof this.name === 'string' ? this.name.trim() : '';
  return normalizedName ? normalizedName.charAt(0).toUpperCase() : '';
});

userSchema.virtual('age').get(function() {
    if (!this.dob) return null;
    const today = new Date();
    const birthDate = new Date(this.dob);
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
        age--;
    }
    return age;
});


// Thiết lập JSON/Object để bao gồm Virtuals
userSchema.set('toJSON', { virtuals: true });
userSchema.set('toObject', { virtuals: true });

export default mongoose.model('User', userSchema);