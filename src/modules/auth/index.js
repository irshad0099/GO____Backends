import express from "express";
import authRoutes from "../modules/auth/routes/authRoutes.js";

// import userRoutes from "../domains/users/routes/userRoutes.js";
// import driverRoutes from "../domains/drivers/routes/driverRoutes.js";
// import rideRoutes from "../domains/rides/routes/rideRoutes.js";

const router = express.Router();

router.use("/auth", authRoutes);
// router.use("/users", userRoutes);
// router.use("/drivers", driverRoutes);
// router.use("/rides", rideRoutes);

export default router;