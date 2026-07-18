/**
 * Runs after multer. Parses formDataJson and merges uploaded file paths into formData.
 * Normalizes req.body so existing validation and controllers work.
 */
export const parseMultipartSubmission = (req, res, next) => {
  if (!req.body.formDataJson) {
    return next();
  }

  try {
    const formData = JSON.parse(req.body.formDataJson);
    const fileFields = [
      'informationSheetFiles',
      'consentFormFiles',
      'grantDocuments',
      'ethicsApprovalDocuments',
      'bloodTissueAbroadDocuments',
    ];

    for (const field of fileFields) {
      const existing = Array.isArray(formData[field]) ? formData[field].filter((x) => x && typeof x === 'object' && x.path) : [];
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
