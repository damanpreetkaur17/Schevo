import { validationResult } from "express-validator";
import pool from "../config/db.js";
import { hashPassword, isBcryptHash, verifyPassword } from "../src/auth/passwords.js";
import generateToken from "../utils/generateToken.js";

const sanitizeUser = (user) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  created_at: user.created_at,
  updated_at: user.updated_at,
});

const getTokenLifetimeMs = () => {
  const value = process.env.JWT_EXPIRES_IN || "1d";
  const match = value.match(/^(\d+)([smhd])$/i);

  if (!match) {
    return 24 * 60 * 60 * 1000;
  }

  const amount = Number(match[1]);
  const unit = match[2].toLowerCase();
  const multipliers = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
  };

  return amount * (multipliers[unit] || multipliers.d);
};

const setAuthCookie = (res, token) => {
  res.cookie("auth_token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: getTokenLifetimeMs(),
  });
};

export const signup = async (req, res) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: errors.array()[0].msg,
    });
  }

  try {
    const { name, email, password, confirmPassword } = req.body;

    if (!name || !email || !password || !confirmPassword) {
      return res.status(400).json({
        success: false,
        message: "All fields are required.",
      });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: "Passwords do not match.",
      });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const nameTrimmed = String(name).trim();

    const existingUser = await pool.query(
      "SELECT id FROM users WHERE LOWER(email) = LOWER($1)",
      [normalizedEmail]
    );

    if (existingUser.rows[0]) {
      return res.status(409).json({
        success: false,
        message: "An account with this email already exists.",
      });
    }

    const passwordHash = await hashPassword(password);

    const result = await pool.query(
      `INSERT INTO users (name, display_name, email, password_hash)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, email, created_at, updated_at`,
      [nameTrimmed, nameTrimmed, normalizedEmail, passwordHash]
    );

    const user = result.rows[0];
    const token = generateToken(user.id);

    setAuthCookie(res, token);

    return res.status(201).json({
      success: true,
      message: "Account created successfully",
      token,
      user: sanitizeUser(user),
    });
  } catch (error) {
    console.error("Signup error:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to create your account right now.",
    });
  }
};

export const login = async (req, res) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: errors.array()[0].msg,
    });
  }

  try {
    const { email, password } = req.body;
    const normalizedEmail = String(email).trim().toLowerCase();

    const result = await pool.query(
      `SELECT id, name, email, password_hash, created_at, updated_at
       FROM users
       WHERE LOWER(email) = LOWER($1)`,
      [normalizedEmail]
    );

    const user = result.rows[0];

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password.",
      });
    }

    const isMatch = await verifyPassword(user.password_hash, password);

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password.",
      });
    }

    if (isBcryptHash(user.password_hash)) {
      const passwordHash = await hashPassword(password);
      await pool.query(
        "UPDATE users SET password_hash = $1 WHERE id = $2 AND password_hash = $3",
        [passwordHash, user.id, user.password_hash]
      );
    }

    const token = generateToken(user.id);
    setAuthCookie(res, token);

    return res.status(200).json({
      success: true,
      message: "Login successful",
      token,
      user: sanitizeUser(user),
    });
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to sign you in right now.",
    });
  }
};

export const getCurrentUser = async (req, res) => {
  return res.status(200).json({
    success: true,
    user: sanitizeUser(req.user),
  });
};

export const logout = (req, res) => {
  res.clearCookie("auth_token", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
  });

  return res.status(200).json({
    success: true,
    message: "Logged out successfully.",
  });
};
