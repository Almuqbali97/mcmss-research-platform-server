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

    if (Array.isArray(formData.documentUploads)) {
      for (const language of ['english', 'arabic']) {
        const documentField = `${language}Files`;
        const uploadField = `documentUpload${language[0].toUpperCase()}${language.slice(1)}`;
        const pendingFileField = `${language}HasNewFile`;
        let fileIndex = 0;
        formData.documentUploads = formData.documentUploads.map((document) => {
          const existing = Array.isArray(document[documentField])
            ? document[documentField].filter((file) => file && typeof file === 'object' && file.path)
            : [];
          if (!document[pendingFileField]) {
            const { [pendingFileField]: _, ...documentWithoutPendingFile } = document;
            return { ...documentWithoutPendingFile, [documentField]: existing };
          }
          const uploadedFile = req.files?.[uploadField]?.[fileIndex++];
          const newRef = uploadedFile
            ? { filename: uploadedFile.filename, originalName: uploadedFile.originalname, path: `/api/uploads/${uploadedFile.filename}` }
            : null;
          const { [pendingFileField]: _, ...documentWithoutPendingFile } = document;
          return { ...documentWithoutPendingFile, [documentField]: newRef ? [...existing, newRef] : existing };
        });
      }
    }

    req.body.formData = formData;
    delete req.body.formDataJson;
  } catch (err) {
    return next(err);
  }
  next();
};
