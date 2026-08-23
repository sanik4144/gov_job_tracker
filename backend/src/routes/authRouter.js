import express from "express";
import { registerUser } from "../controllers/authController.js";

const authRouter = express.Router();

// Registration route
authRouter.post("/register", registerUser);

export default authRouter;