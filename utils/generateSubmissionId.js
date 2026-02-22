export const generateSubmissionId = (numericId, submissionDate = null) => {
  const year = submissionDate
    ? new Date(submissionDate).getFullYear()
    : new Date().getFullYear();
  return `MCMSS-MREC ${numericId}/${year}`;
};
