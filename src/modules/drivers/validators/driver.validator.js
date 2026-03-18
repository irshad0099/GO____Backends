import { body } from 'express-validator';

export const validateVehicleType = () => {
    return body('vehicleType')
        .notEmpty().withMessage('Vehicle type is required')
        .isIn(['bike', 'auto', 'car']).withMessage('Vehicle type must be bike, auto, or car');
};

export const validateVehicleNumber = () => {
    return body('vehicleNumber')
        .notEmpty().withMessage('Vehicle number is required')
        .matches(/^[A-Z]{2}[0-9]{1,2}[A-Z]{1,2}[0-9]{4}$/).withMessage('Please enter a valid Indian vehicle number (e.g., MH12AB1234)');
};

export const validateVehicleModel = () => {
    return body('vehicleModel')
        .notEmpty().withMessage('Vehicle model is required')
        .isLength({ min: 2, max: 100 }).withMessage('Vehicle model must be between 2 and 100 characters');
};

export const validateVehicleColor = () => {
    return body('vehicleColor')
        .notEmpty().withMessage('Vehicle color is required')
        .isLength({ min: 2, max: 50 }).withMessage('Vehicle color must be between 2 and 50 characters');
};

export const validateLicenseNumber = () => {
    return body('licenseNumber')
        .notEmpty().withMessage('License number is required')
        .matches(/^[A-Z]{2}[0-9]{13}$/).withMessage('Please enter a valid Indian driving license number');
};

export const validateLicenseExpiry = () => {
    return body('licenseExpiry')
        .notEmpty().withMessage('License expiry date is required')
        .isDate().withMessage('Please enter a valid date')
        .custom((value) => {
            const expiryDate = new Date(value);
            const today = new Date();
            if (expiryDate <= today) {
                throw new Error('License expiry date must be in the future');
            }
            return true;
        });
};

export const driverRegistrationValidators = [
  // Driver row is auto-created at signup for role=driver.
];

export const updateLocationValidators = [
    body('latitude')
        .notEmpty().withMessage('Latitude is required')
        .isFloat({ min: -90, max: 90 }).withMessage('Please enter a valid latitude'),
    body('longitude')
        .notEmpty().withMessage('Longitude is required')
        .isFloat({ min: -180, max: 180 }).withMessage('Please enter a valid longitude')
];


export const aadhaarUploadValidator = [
  body("driver_id").notEmpty().withMessage("Driver ID is required"),

  body("aadhaar_name")
    .notEmpty()
    .withMessage("Aadhaar name is required"),

  body("aadhaar_number")
    .isLength({ min: 12, max: 12 })
    .withMessage("Aadhaar must be 12 digits"),

  body("aadhaar_front")
    .notEmpty()
    .withMessage("Aadhaar front image required"),

  body("aadhaar_back")
    .notEmpty()
    .withMessage("Aadhaar back image required"),

  body("consent_given")
    .equals("true")
    .withMessage("Consent must be given")
];



export const panUploadValidator = [

  body("driver_id")
    .notEmpty()
    .withMessage("Driver ID is required"),

  body("pan_name")
    .notEmpty()
    .withMessage("PAN name is required"),

  body("pan_number")
    .notEmpty()
    .withMessage("PAN number is required")
    .isLength({ min: 10, max: 10 })
    .withMessage("PAN must be 10 characters")
    .matches(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/)
    .withMessage("Invalid PAN format"),

  body("pan_dob")
    .notEmpty()
    .withMessage("Date of birth is required")
    .isISO8601()
    .withMessage("DOB must be a valid date"),

  body("pan_front")
    .notEmpty()
    .withMessage("PAN front image is required")

];



export const bankUploadValidator = [

  body("account_holder_name")
    .notEmpty()
    .withMessage("Account holder name is required"),

  body("account_number")
    .notEmpty()
    .withMessage("Account number is required")
    .isLength({ min: 6, max: 18 })
    .withMessage("Invalid account number"),

  body("ifsc_code")
    .notEmpty()
    .withMessage("IFSC code is required")
    .matches(/^[A-Z]{4}0[A-Z0-9]{6}$/)
    .withMessage("Invalid IFSC code"),

  body("account_type")
    .notEmpty()
    .withMessage("Account type is required")
    .isIn(["saving", "current"])
    .withMessage("Account type must be saving or current"),

  body("bank_proof_document")
    .notEmpty()
    .withMessage("Bank proof document is required")

];




export const licenseUploadValidator = [

  body("license_number")
    .notEmpty()
    .withMessage("License number is required")
    .isLength({ min: 5, max: 20 })
    .withMessage("Invalid license number"),

  body("license_name")
    .notEmpty()
    .withMessage("License name is required"),

  body("license_dob")
    .notEmpty()
    .withMessage("DOB is required")
    .isISO8601()
    .withMessage("DOB must be a valid date"),

  body("license_issue_date")
    .notEmpty()
    .withMessage("Issue date is required")
    .isISO8601()
    .withMessage("Issue date must be valid"),

  body("license_expiry_date")
    .notEmpty()
    .withMessage("Expiry date is required")
    .isISO8601()
    .withMessage("Expiry date must be valid"),

  body("license_front")
    .notEmpty()
    .withMessage("License front image is required"),

  body("license_back")
    .notEmpty()
    .withMessage("License back image is required")

];

export const vehicleUploadValidator = [


  body("vehicle_type")
    .notEmpty()
    .withMessage("Vehicle type is required")
    .isIn(["bike", "auto", "car"])
    .withMessage("Vehicle type must be bike, auto, or car"),

  body("vehicle_number")
    .notEmpty()
    .withMessage("Vehicle number is required")
    .matches(/^[A-Z]{2}[0-9]{1,2}[A-Z]{1,2}[0-9]{4}$/)
    .withMessage("Invalid vehicle number"),

  body("vehicle_model")
    .optional()
    .isLength({ min: 2, max: 100 }),

  body("vehicle_color")
    .optional()
    .isLength({ min: 2, max: 50 }),

  // RC
  body("rc_number")
    .notEmpty()
    .withMessage("RC number is required"),

  body("owner_name")
    .notEmpty()
    .withMessage("Owner name is required"),

  body("rc_front")
    .notEmpty()
    .withMessage("RC front required"),

  body("rc_back")
    .notEmpty()
    .withMessage("RC back required"),

  // Insurance (optional)
  body("policy_number").optional(),
  body("insurance_provider").optional(),

  body("insurance_valid_until")
    .optional()
    .isISO8601()
    .withMessage("Invalid insurance date"),

  body("insurance_front").optional(),
  body("insurance_back").optional(),

  // Permit (optional)
  body("permit_number").optional(),
  body("permit_type").optional(),
  body("permit_document").optional(),

  body("permit_valid_until")
    .optional()
    .isISO8601()
    .withMessage("Invalid permit date")
];