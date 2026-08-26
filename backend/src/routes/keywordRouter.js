import express from "express";
import {
  createKeyword,
  deleteKeyword,
  listKeywords,
} from "../controllers/keywordController.js";
import { authenticate } from "../middleware/auth.js";

const keywordRouter = express.Router();

keywordRouter.get("/", authenticate, listKeywords);
keywordRouter.post("/", authenticate, createKeyword);
keywordRouter.delete("/:id", authenticate, deleteKeyword);

export default keywordRouter;
