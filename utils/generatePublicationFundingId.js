export const generatePublicationFundingId = (numericId, applicationDate = null) => {
  const year = applicationDate
    ? new Date(applicationDate).getFullYear()
    : new Date().getFullYear();
  return `MCMSS-PF ${numericId}/${year}`;
};
