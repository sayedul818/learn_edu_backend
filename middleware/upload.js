const multer = require('multer');

const allowedMimeTypes = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/zip',
  'text/plain',
  'image/jpeg',
  'image/png',
  'image/webp',
]);

const uploadAssignmentFiles = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 12 * 1024 * 1024,
    files: 5,
  },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype || allowedMimeTypes.has(file.mimetype)) return cb(null, true);
    cb(new Error('Unsupported file type'));
  },
});

module.exports = {
  uploadAssignmentFiles,
};
