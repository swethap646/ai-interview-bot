/**
 * storageService.js
 * ─────────────────────────────────────────────────────────────────
 * Handles file storage for recorded interviews.
 * Currently saves locally to disk.
 * TODO: Replace with cloud storage (AWS S3, Google Cloud Storage, etc.)
 * ─────────────────────────────────────────────────────────────────
 */

const fs = require('fs');
const path = require('path');

const uploadDir = process.env.UPLOAD_DIR || 'uploads';

/**
 * Save a file buffer to local storage.
 * @param {Buffer} buffer - File data
 * @param {string} filename - Target filename
 * @returns {string} - Full path of saved file
 */
function saveLocal(buffer, filename) {
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }
  const filePath = path.join(uploadDir, filename);
  fs.writeFileSync(filePath, buffer);
  return filePath;
}

/**
 * TODO: Upload a file to cloud storage.
 * @param {string} localPath - Path of the local file
 * @param {string} destination - Cloud storage destination key/path
 * @returns {Promise<string>} - Public URL of the uploaded file
 */
async function uploadToCloud(localPath, destination) {
  throw new Error('uploadToCloud not implemented yet. Configure cloud storage provider.');
}

module.exports = { saveLocal, uploadToCloud };
