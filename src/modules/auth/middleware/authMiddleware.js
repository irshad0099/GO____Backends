import { verifyToken } from "../services/tokenService.js";
import { findUserById } from "../repositories/userRepository.js";
import { sendError } from "../../../core/utils/response.js";

export const authenticate = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
      return sendError(res, 401, "No token provided");
    }

    const decoded = verifyToken(token);
    const user = await findUserById(decoded.userId);

    if (!user) {
      return sendError(res, 401, "Invalid token");
    }

    req.user = user;
    next();
  } catch (err) {
    return sendError(res, 401, "Unauthorized");
  }
};