import multer from "multer";
import multerS3 from "multer-s3";
import { S3Client } from "@aws-sdk/client-s3";

const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
});

export const s3Upload = multer({
  storage: multerS3({
    s3: s3,
    bucket: process.env.AWS_BUCKET_NAME,
    key: function (req, file, cb) {

  const type = req.body.type; // aadhaar, pan etc
  const userId = req.user.id; // driver_id or rider_id
  const isFront = req.body.isFront === "true";
  console.log("userId from req.user:", {...req.user});
        console.log("Upload request received:", { type, userId, isFront, originalname: file.originalname });
  const folderMap = {
    aadhaar: "aadhaar",
    pan: "pan",
    bank: "bank",
    license: "license",
    vehicle: "vehicle"
  };

  const folder = folderMap[type];

  if (!folder) {
    return cb(new Error("Invalid upload type"));
  }

  const side = isFront ? "front" : "back";

  const fileName = `drivers/${userId}/${folder}/${side}-${Date.now()}-${file.originalname}`;

  cb(null, fileName);
}
  }),
  limits: {
    fileSize: 5 * 1024 * 1024
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|webp/;
    const extname = allowedTypes.test(file.originalname.toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      cb(null, true);
    } else {
      cb(new Error("Only image files allowed"));
    }
  }
});