const clone = (value) => JSON.parse(JSON.stringify(value || {}));

export function ensureReviewHistory(submission) {
  if (submission.reviewHistory?.length) return;
  submission.reviewHistory = (submission.reviewCommentHistory || []).map((entry) => ({
    event: 'decision_released', decision: entry.decision, comment: entry.comment,
    round: entry.round, author: entry.author, createdAt: entry.createdAt || null,
  }));
}

export function recordReviewEvent(submission, event, details = {}) {
  ensureReviewHistory(submission);
  submission.reviewHistory.push({
    event, round: submission.revision?.round || 0,
    version: submission.submissionVersions?.at(-1)?.version || null,
    createdAt: new Date(), ...details,
  });
  return submission.reviewHistory.at(-1);
}

export function recordSubmissionVersion(submission, revised) {
  const version = (submission.submissionVersions?.at(-1)?.version || 0) + 1;
  submission.submissionVersions.push({
    version, round: submission.revision?.round || 0,
    researchTitle: submission.researchTitle, principalInvestigator: submission.principalInvestigator,
    formData: clone(submission.formData), submittedAt: submission.submittedDate,
  });
  recordReviewEvent(submission, revised ? 'revision_submitted' : 'submitted', { version });
}

export function researcherHistory(history = []) {
  const withdrawn = new Set(history.filter((entry) => entry.event === 'decision_retrieved').map((entry) => entry.relatedEventId));
  return history
    .filter((entry) => ['submitted', 'revision_submitted', 'decision_released', 'deadline_extended'].includes(entry.event) && !withdrawn.has(String(entry._id)))
    .map(({ author, relatedEventId, ...entry }) => entry);
}
