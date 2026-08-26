import express from "express";
import { runCheck } from "../controllers/runCheckController.js";
import { authorizeRunCheck } from "../middleware/authorizeRunCheck.js";

const runCheckRouter = express.Router();

runCheckRouter.get("/", authorizeRunCheck, runCheck);
runCheckRouter.post("/", authorizeRunCheck, runCheck);

export default runCheckRouter;
