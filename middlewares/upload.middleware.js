import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadsDir = path.join(__dirname, '../uploads');

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = path.extname(file.originalname) || '.bin';
    const safeName = `${uniqueSuffix}${ext}`;
    cb(null, safeName);
  },
});

const fileFilter = (req, file, cb) => {
  const allowed = ['.pdf', '.doc', '.docx'];
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowed.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('Only PDF, DOC, and DOCX files are allowed.'), false);
  }
};

export const submissionUpload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 1024 * 1024 * 1024 }, // 1 GB per file (for consent forms and grant documents)
}).fields([
  { name: 'informationSheetFiles', maxCount: 5 },
  { name: 'consentFormFiles', maxCount: 5 },
  { name: 'grantDocuments', maxCount: 5 },
  { name: 'ethicsApprovalDocuments', maxCount: 5 },
  { name: 'sampleSizeFiles', maxCount: 5 },
  { name: 'dataVariablesFiles', maxCount: 5 },
  { name: 'researchProposalFiles', maxCount: 5 },
]);
