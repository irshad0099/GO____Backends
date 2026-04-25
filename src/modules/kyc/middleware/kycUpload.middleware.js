import multer from 'multer';

// In-memory storage — buffer direct Cashfree ko bhej denge (disk pe save karna zaroori nahi)
const storage = multer.memoryStorage();

// Allowed: JPEG, JPG, PNG, PDF (per Cashfree Smart OCR spec)
const fileFilter = (req, file, cb) => {
    const allowedMimes = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];
    if (allowedMimes.includes(file.mimetype)) {
        return cb(null, true);
    }
    cb(new Error('Only JPEG, JPG, PNG or PDF files are allowed'));
};

// Images 5MB, PDF 1MB — per Cashfree. Express limit 5MB and enforce PDF-size at route/service level.
export const kycUpload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter,
});

// PDF wale request pe 1MB cap check karo (multer ka single limit 5MB hai — PDF ke liye alag check)
export const enforcePdfSize = (req, res, next) => {
    if (req.file?.mimetype === 'application/pdf' && req.file.size > 1 * 1024 * 1024) {
        return res.status(400).json({
            success: false,
            message: 'PDF files must be under 1MB. Use an image for better performance.',
        });
    }
    next();
};

export const handleKycUploadError = (err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        const msg = err.code === 'LIMIT_FILE_SIZE'
            ? 'File too large. Max 5MB for images, 1MB for PDF.'
            : err.message;
        return res.status(400).json({ success: false, message: msg });
    }
    if (err?.message?.includes('Only JPEG')) {
        return res.status(400).json({ success: false, message: err.message });
    }
    next(err);
};
