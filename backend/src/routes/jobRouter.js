import express from "express";
import { listJobs, updateAppliedStatus } from "../controllers/jobController.js";
import { authenticate } from "../middleware/auth.js";

const jobRouter = express.Router();

jobRouter.get("/", authenticate, listJobs);
jobRouter.patch("/:id/applied", authenticate, updateAppliedStatus);

export default jobRouter;
