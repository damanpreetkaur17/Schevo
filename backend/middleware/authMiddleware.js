import jwt from "jsonwebtoken";
import pool from "../config/db.js";

const authMiddleware = async (req, res, next) => {
  const authHeader = req.headers.authorization || "";
  const cookieToken = req.cookies?.auth_token;
  const bearerToken = authHeader.startsWith("Bearer ") ? authHeader.split(" ")[1] : null;
  const token = bearerToken || cookieToken;

  if (!token) {
    return res.status(401).json({
      success: false,
      message: "Authentication required.",
    });
  }

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return res.status(401).json({
      success: false,
      message: "Invalid or expired token.",
    });
  }

  if (!decoded || !decoded.id) {
    return res.status(401).json({
      success: false,
      message: "Invalid token payload.",
    });
  }

  try {
    const { rows } = await pool.query(
      `SELECT id, name, email, created_at, updated_at
       FROM users
       WHERE id = $1`,
      [decoded.id]
    );

    if (!rows[0]) {
      return res.status(401).json({
        success: false,
        message: "User account not found.",
      });
    }

    req.user = rows[0];
    next();
  } catch (error) {
    next(error);
  }
};

export default authMiddleware;
