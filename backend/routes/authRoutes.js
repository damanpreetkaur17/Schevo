import { Router } from "express";
import { body } from "express-validator";
import { signup, login, getCurrentUser, logout } from "../controllers/authController.js";
import authMiddleware from "../middleware/authMiddleware.js";

const router = Router();

const signupValidation = [
  body("name")
    .trim()
    .notEmpty()
    .withMessage("Name is required."),
  body("email")
    .trim()
    .isEmail()
    .withMessage("Please provide a valid email address."),
  body("password")
    .isLength({ min: 8 })
    .withMessage("Password must contain at least 8 characters."),
  body("confirmPassword")
    .custom((value, { req }) => value === req.body.password)
    .withMessage("Passwords do not match."),
];

const loginValidation = [
  body("email")
    .trim()
    .isEmail()
    .withMessage("Please provide a valid email address."),
  body("password")
    .notEmpty()
    .withMessage("Password is required."),
];

router.post("/signup", signupValidation, signup);
router.post("/login", loginValidation, login);
router.get("/me", authMiddleware, getCurrentUser);
router.post("/logout", authMiddleware, logout);

export default router;
