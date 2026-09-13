import Submission from '../models/Submission.model.js';
import SubmissionCounter from '../models/SubmissionCounter.model.js';
import { generateSubmissionId } from '../utils/generateSubmissionId.js';

const FIRST_NUMBER_BY_YEAR = new Map([[2026, 91]]);
const ID_PATTERN = /^MCMSS-MREC (\d+)\/(\d{4})$/;

const getFirstNumberForYear = (year) => FIRST_NUMBER_BY_YEAR.get(year) || 1;

const getHighestExistingNumber = async (year) => {
  const submissions = await Submission.find({
    submissionId: { $regex: `^MCMSS-MREC \\d+/${year}$` },
  })
    .select('submissionId')
    .lean();

  return submissions.reduce((highest, submission) => {
    const match = ID_PATTERN.exec(submission.submissionId || '');
    if (!match || Number(match[2]) !== year) return highest;
    return Math.max(highest, Number(match[1]));
  }, 0);
};

/** Allocates the next ethics-submission number atomically within the current year. */
export const getNextSubmissionId = async (referenceDate = new Date()) => {
  const year = referenceDate.getFullYear();
  const sequenceFloor = Math.max(
    getFirstNumberForYear(year) - 1,
    await getHighestExistingNumber(year)
  );

  const counter = await SubmissionCounter.findOneAndUpdate(
    { _id: `ethics-submission-${year}` },
    [
      {
        $set: {
          year,
          sequence: {
            $add: [
              { $max: [{ $ifNull: ['$sequence', sequenceFloor] }, sequenceFloor] },
              1,
            ],
          },
        },
      },
    ],
    { upsert: true, new: true }
  );

  return generateSubmissionId(counter.sequence, referenceDate);
};
