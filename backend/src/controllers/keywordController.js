import { ensureDbReady } from "../db.js";
import { Keyword } from "../models/Keyword.js";
import { scrapeAndSaveJobs } from "../services/notifier.js";

function normalizeKeyword(value = "") {
  return value.trim().toLowerCase();
}

export async function listKeywords(req, res, next) {
  try {
    await ensureDbReady();
    const keywords = await Keyword.find({ userId: req.user._id, active: true }).sort({ value: 1 });
    res.json({ keywords });
  } catch (error) {
    next(error);
  }
}

export async function createKeyword(req, res, next) {
  try {
    await ensureDbReady();
    const value = String(req.body?.value || "").trim();
    if (!value) return res.status(400).json({ error: "Keyword is required" });

    const normalizedValue = normalizeKeyword(value);
    const keyword = await Keyword.findOneAndUpdate(
      { userId: req.user._id, normalizedValue },
      { value, normalizedValue, userId: req.user._id, active: true },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    let search = {
      found: 0,
      new: 0,
      error: null,
    };

    try {
      const searchResult = await scrapeAndSaveJobs([keyword.value]);
      search = {
        found: searchResult.found,
        new: searchResult.new,
        error: null,
      };
    } catch (error) {
      search.error = error.response?.data?.message || error.message;
      console.error("Keyword search failed:", search.error);
    }

    res.status(201).json({ keyword, search });
  } catch (error) {
    next(error);
  }
}

export async function deleteKeyword(req, res, next) {
  try {
    await ensureDbReady();
    const keyword = await Keyword.findOneAndDelete({ _id: req.params.id, userId: req.user._id });

    if (!keyword) return res.status(404).json({ error: "Keyword not found" });

    res.json({
      keyword,
      affectedJobs: 0,
      deletedJobs: 0,
    });
  } catch (error) {
    next(error);
  }
}
