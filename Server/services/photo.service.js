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
