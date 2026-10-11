import fs from 'fs';
import path from 'path';
import { uploadsDir } from '../config/uploads.js';
import Submission from '../models/Submission.model.js';


const SUBMISSION_FILE_FIELDS = [
  'informationSheetFiles',
  'consentFormFiles',
  'grantDocuments',
  'ethicsApprovalDocuments',
  'sampleSizeFiles',
  'dataVariablesFiles',
  'researchProposalFiles',
  'bloodTissueAbroadDocuments',
];

const collectFilenames = (submission) => {
  const filenames = [];
  for (const formData of [submission.formData, ...(submission.submissionVersions || []).map((version) => version.formData)]) {
    for (const field of SUBMISSION_FILE_FIELDS) {
      const refs = formData?.[field];
      if (!Array.isArray(refs)) continue;
      for (const ref of refs) {
        if (ref?.filename) filenames.push(ref.filename);
      }
    }
    for (const document of formData?.documentUploads || []) {
      for (const file of [...(document.englishFiles || []), ...(document.arabicFiles || [])]) {
        if (file?.filename) filenames.push(file.filename);
      }
    }
  }
  if (submission.approvalCertificate?.filename) filenames.push(submission.approvalCertificate.filename);
  return [...new Set(filenames)];
};

const removeFiles = async (submission) => {
  await Promise.allSettled(
    collectFilenames(submission).map((filename) =>
      fs.promises.unlink(path.join(uploadsDir, path.basename(filename)))
    )
  );
};

export const permanentlyDeleteSubmission = async (submission) => {
  await removeFiles(submission);
  await Submission.deleteOne({ _id: submission._id, deletedAt: { $ne: null } });
};

/** Permanently removes submissions whose 30-day retention period has ended. */
export const processExpiredDeletedSubmissions = async () => {
  try {
    const expired = await Submission.find({
      deletedAt: { $ne: null },
      deleteAfter: { $lte: new Date() },
    });
    for (const submission of expired) {
      await permanentlyDeleteSubmission(submission);
    }
  } catch (error) {
    console.error('processExpiredDeletedSubmissions failed:', error.message);
  }
};

/* Sweep at startup and hourly thereafter. */
export const startDeletedSubmissionScheduler = (intervalHours = 1) => {
  processExpiredDeletedSubmissions();
  return setInterval(processExpiredDeletedSubmissions, intervalHours * 60 * 60 * 1000);
};
