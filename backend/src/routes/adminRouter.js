import express from "express";
import { listUsers } from "../controllers/adminController.js";
import { authenticate } from "../middleware/auth.js";
import { requireAdmin } from "../middleware/requireAdmin.js";

const adminRouter = express.Router();

adminRouter.use(authenticate, requireAdmin);
adminRouter.get("/users", listUsers);

export default adminRouter;
