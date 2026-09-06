import express from "express";
import {
  createPayment,
  listMyPayments,
  listPlans,
} from "../controllers/billingController.js";
import { authenticate } from "../middleware/auth.js";

const billingRouter = express.Router();

billingRouter.get("/plans", listPlans);
billingRouter.get("/payments", authenticate, listMyPayments);
billingRouter.post("/payments", authenticate, createPayment);

export default billingRouter;
