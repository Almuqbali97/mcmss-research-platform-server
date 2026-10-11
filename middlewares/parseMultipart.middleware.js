/**
 * Runs after multer. Parses formDataJson and merges uploaded file paths into formData.
 * Normalizes req.body so existing validation and controllers work.
 */
export const parseMultipartSubmission = (req, res, next) => {
  try {
    if (!req.body?.formDataJson) throw new Error('Missing document upload data.');
    const formData = JSON.parse(req.body.formDataJson);
    if (!formData || typeof formData !== 'object' || Array.isArray(formData)) throw new Error('Invalid document upload data.');
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
      formData[field] = [...existing, ...newRefs];
    }

    if (Array.isArray(formData.documentUploads)) {
      for (const language of ['english', 'arabic']) {
        const documentField = `${language}Files`;
        const uploadField = `documentUpload${language[0].toUpperCase()}${language.slice(1)}`;
        const pendingFileField = `${language}HasNewFile`;
        const countField = `${language}NewFileCount`;
        let fileIndex = 0;
        formData.documentUploads = formData.documentUploads.map((document) => {
          const existing = Array.isArray(document[documentField])
            ? document[documentField].filter((file) => file && typeof file === 'object' && file.path)
            : [];
          const count = document[countField] ?? (document[pendingFileField] ? 1 : 0);
          if (!Number.isInteger(count) || count < 0 || count > 50) throw new Error('Invalid document file count.');
          const uploadedFiles = (req.files?.[uploadField] || []).slice(fileIndex, fileIndex + count);
          if (uploadedFiles.length !== count) throw new Error('A selected document was not received. Please select it again.');
          fileIndex += count;
          const newRefs = uploadedFiles.map((file) => ({ filename: file.filename, originalName: file.originalname, path: `/api/uploads/${file.filename}` }));
          const documentWithoutPendingFile = { ...document };
          delete documentWithoutPendingFile[pendingFileField];
          delete documentWithoutPendingFile[countField];
          return { ...documentWithoutPendingFile, [documentField]: [...existing, ...newRefs] };
        });
        if (fileIndex !== (req.files?.[uploadField]?.length || 0)) throw new Error('Document files do not match the upload form.');
      }
    } else if (req.files?.documentUploadEnglish?.length || req.files?.documentUploadArabic?.length) {
      throw new Error('Missing document descriptions.');
    }

    req.body.formData = formData;
    delete req.body.formDataJson;
  } catch (err) {
    err.statusCode = 400;
    return next(err);
  }
  next();
};
