const PUBLICATION_FUNDING_FILE_FIELDS = [
  'frontPageOrArticleFiles',
  'proofOfPaymentFiles',
  'acceptanceLetterFiles',
  'publishedArticleFiles',
  'invoiceReceiptFiles',
  'irbApprovalFiles',
  'copeDoajProofFiles',
  'additionalSupportingFiles',
];

export const parseMultipartPublicationFunding = (req, res, next) => {
  if (!req.body.formDataJson) {
    return next();
  }

  try {
    const formData = JSON.parse(req.body.formDataJson);

    for (const field of PUBLICATION_FUNDING_FILE_FIELDS) {
      const existing = Array.isArray(formData[field])
        ? formData[field].filter((x) => x && typeof x === 'object' && x.path)
        : [];
      const newRefs = (req.files?.[field] || []).map((f) => ({
        filename: f.filename,
        originalName: f.originalname,
        path: `/api/uploads/${f.filename}`,
      }));
      if (newRefs.length > 0) {
        formData[field] = [...existing, ...newRefs];
      }
    }

    req.body.formData = formData;
    delete req.body.formDataJson;
  } catch (err) {
    return next(err);
  }
  next();
};
