import Submission from '../models/Submission.model.js';
import { sendRevisionReminderEmail, sendRevisionArchivedEmail } from './email.service.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const REVISION_STATUSES = ['revisions_required', 'conditional_minor', 'major_revisions'];

const submitterName = (user) =>
  `${user?.firstName || ''} ${user?.lastName || ''}`.trim() || 'Researcher';

const daysBetween = (from, to) => Math.max(0, Math.ceil((to.getTime() - from.getTime()) / DAY_MS));

/**
 * Sweeps submissions in a revision cycle:
 *  - sends a first reminder ~1 week after the revision was issued,
 *  - sends a final reminder 3 days before the deadline,
 *  - archives (cancels) submissions whose deadline has passed.
 * Runs on an interval and once at startup. Never throws.
 */
export const processRevisionDeadlines = async () => {
  const now = new Date();
  try {
    const submissions = await Submission.find({
      status: { $in: REVISION_STATUSES },
      'revision.deadline': { $ne: null },
    }).populate('submittedBy', 'firstName lastName email');

    for (const sub of submissions) {
      const rev = sub.revision;
      if (!rev?.deadline) continue;
      const deadline = new Date(rev.deadline);
      const email = sub.submittedBy?.email;
      const name = submitterName(sub.submittedBy);

      // Past the deadline: cancel (archive) the submission.
      if (now >= deadline) {
        sub.status = 'archived';
        rev.deadline = null;
        await sub.save();
        if (email) {
          try {
            await sendRevisionArchivedEmail(email, name, sub.researchTitle, sub.submissionId);
          } catch (err) {
            console.error('Revision archived email failed:', err.message);
          }
        }
        continue;
      }

      const finalMark = new Date(deadline.getTime() - 3 * DAY_MS);
      const firstMark = rev.startedAt ? new Date(new Date(rev.startedAt).getTime() + 7 * DAY_MS) : null;

      // Final reminder: 3 days before the deadline.
      if (!rev.finalReminderSent && now >= finalMark) {
        rev.finalReminderSent = true;
        rev.firstReminderSent = true; // suppress a now-pointless first reminder
        await sub.save();
        if (email) {
          try {
            await sendRevisionReminderEmail(email, name, sub.researchTitle, deadline, daysBetween(now, deadline));
          } catch (err) {
            console.error('Revision reminder email failed:', err.message);
          }
        }
        continue;
      }

      // First reminder: about a week into the revision window (and before the final mark).
      if (!rev.firstReminderSent && firstMark && now >= firstMark && now < finalMark) {
        rev.firstReminderSent = true;
        await sub.save();
        if (email) {
          try {
            await sendRevisionReminderEmail(email, name, sub.researchTitle, deadline, daysBetween(now, deadline));
          } catch (err) {
            console.error('Revision reminder email failed:', err.message);
          }
        }
      }
    }
  } catch (err) {
    console.error('processRevisionDeadlines failed:', err.message);
  }
};

/* Runs the sweep now and every `intervalHours` thereafter. */
export const startRevisionDeadlineScheduler = (intervalHours = 12) => {
  processRevisionDeadlines();
  return setInterval(processRevisionDeadlines, intervalHours * 60 * 60 * 1000);
};
