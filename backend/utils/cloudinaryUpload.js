const cloudinary = require("../config/cloudinary");
const streamifier = require("streamifier");

// resourceType: "image" (default) or "video" — Cloudinary stores audio files
// under the "video" resource type, there is no separate "audio" type.
const uploadToCloudinary = (buffer, folder, resourceType = "image") => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder, resource_type: resourceType },
      (error, result) => {
        if (result) {
          resolve(result);
        } else {
          reject(error);
        }
      }
    );
    streamifier.createReadStream(buffer).pipe(stream);
  });
};

// Best-effort delete — used for view-once media and delete-for-everyone.
// Never throws: a failed Cloudinary cleanup shouldn't block the message flow,
// since we always clear the DB fields regardless.
const deleteFromCloudinary = async (publicId, resourceType = "image") => {
  if (!publicId) return;
  try {
    await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
  } catch (error) {
    console.log("Cloudinary delete error:", error.message);
  }
};

module.exports = uploadToCloudinary;
module.exports.deleteFromCloudinary = deleteFromCloudinary;