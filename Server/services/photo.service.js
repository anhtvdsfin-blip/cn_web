import cloudinary from '../config/cloudinary.js';

export const uploadProfilePhoto = async (userId, fileBuffer, fileMimetype) => {
  if (!userId) {
    throw new Error('uploadProfilePhoto requires a userId.');
  }
  if (!fileBuffer || !Buffer.isBuffer(fileBuffer) || fileBuffer.length === 0) {
    throw new Error('uploadProfilePhoto requires a non-empty file buffer.');
  }

  const mimeType = typeof fileMimetype === 'string' && fileMimetype.trim().length > 0
    ? fileMimetype
    : 'image/jpeg';
  const base64Payload = fileBuffer.toString('base64');
  const dataUri = `data:${mimeType};base64,${base64Payload}`;

  try {
    const uploadResult = await cloudinary.uploader.upload(dataUri, {
      folder: `HUSTLove/users/${userId}`,
      public_id: `profile-${userId}-${Date.now()}`,
      overwrite: true,
      resource_type: 'image',
      transformation: [
        {
          width: 500,
          height: 750,
          crop: 'fill',
          fetch_format: 'auto',
          quality: 'auto',
        },
      ],
    });

    return uploadResult.secure_url;
  } catch (error) {
    console.error('Failed to upload profile photo to Cloudinary:', error);
    throw error;
  }
};

export const uploadPostImage = async (userId, fileBuffer, fileMimetype) => {
  if (!userId || !fileBuffer || fileBuffer.length === 0) {
    throw new Error('uploadPostImage requires userId and file buffer.');
  }

  const mimeType = fileMimetype || 'image/jpeg';
  const base64Payload = fileBuffer.toString('base64');
  const dataUri = `data:${mimeType};base64,${base64Payload}`;
  
  try {
    const uploadResult = await cloudinary.uploader.upload(dataUri, {
      // ✅ THAY ĐỔI FOLDER: Lưu vào thư mục riêng cho bài đăng
      folder: `HUSTLove/posts/${userId}`, 
      public_id: `post-${userId}-${Date.now()}`,
      overwrite: true,
      resource_type: 'image',
      // ✅ CÁC THAM SỐ CROP KHÁC CHO BÀI ĐĂNG (Ví dụ: tỷ lệ 16:9 hoặc không crop)
      transformation: [
        {
          width: 800,
          height: 450,
          crop: 'limit', // Giới hạn kích thước nhưng không cắt
          fetch_format: 'auto',
          quality: 'auto',
        },
      ],
    });

    return uploadResult.secure_url;
  } catch (error) {
    console.error('Failed to upload post image to Cloudinary:', error);
    throw error;
  }
};

export const uploadChatImage = async (userId, fileBuffer, fileMimetype) => {
  if (!userId || !fileBuffer || fileBuffer.length === 0) {
    throw new Error('uploadChatImage requires userId and file buffer.');
  }

  const mimeType = fileMimetype || 'image/jpeg';
  const base64Payload = fileBuffer.toString('base64');
  const dataUri = `data:${mimeType};base64,${base64Payload}`;

  try {
    const uploadResult = await cloudinary.uploader.upload(dataUri, {
      folder: `HUSTLove/chats/${userId}`,
      public_id: `chat-${userId}-${Date.now()}`,
      overwrite: false,
      resource_type: 'image',
      transformation: [
        { width: 1200, height: 1200, crop: 'limit', fetch_format: 'auto', quality: 'auto' }
      ]
    });

    return uploadResult.secure_url;
  } catch (error) {
    console.error('Failed to upload chat image to Cloudinary:', error);
    throw error;
  }
};
