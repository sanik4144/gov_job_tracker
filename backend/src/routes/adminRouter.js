import express from "express";
import {
  approvePaymentHandler,
  grantSubscriptionHandler,
  listPayments,
  listUsers,
  rejectPaymentHandler,
} from "../controllers/adminController.js";
import { authenticate } from "../middleware/auth.js";
import { requireAdmin } from "../middleware/requireAdmin.js";

const adminRouter = express.Router();

adminRouter.use(authenticate, requireAdmin);
adminRouter.get("/users", listUsers);
adminRouter.post("/users/:id/grant", grantSubscriptionHandler);
adminRouter.get("/payments", listPayments);
adminRouter.post("/payments/:id/approve", approvePaymentHandler);
adminRouter.post("/payments/:id/reject", rejectPaymentHandler);

export default adminRouter;
