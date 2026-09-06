import mongoose from "mongoose";
import dns from "node:dns";
import { env } from "./config/env.js";
import { DeadlineReminder } from "./models/DeadlineReminder.js";
import { JobNotification } from "./models/JobNotification.js";
import { TelegramLinkToken } from "./models/TelegramLinkToken.js";
import { Keyword } from "./models/Keyword.js";
import User from "./models/User.js";

let dbReadyPromise = null;
let dbConnectionError = null;

export async function connectDb() {
  if (!env.mongodbUri) {
    throw new Error("MONGODB_URI is required");
  }

  if (env.dnsServers.length) {
    dns.setServers(env.dnsServers);
  }

  mongoose.set("strictQuery", true);
  await mongoose.connect(env.mongodbUri);
  await dropLegacyKeywordIndexes();
  await Keyword.createIndexes();
  await JobNotification.createIndexes();
  await DeadlineReminder.createIndexes();
  await TelegramLinkToken.createIndexes();

  // A pre-existing duplicate telegramId would make this throw; that must not take
  // the whole app down, so surface it and carry on.
  try {
    await User.createIndexes();
  } catch (error) {
    console.error("Could not build user indexes (duplicate telegramId?):", error.message);
  }

  console.log("MongoDB connected");
}

export function initDbConnection() {
  dbReadyPromise = connectDb().catch((error) => {
    dbConnectionError = error;
    console.error("MongoDB connection failed:", error);
    throw error;
  });

  return dbReadyPromise;
}

export async function ensureDbReady() {
  if (dbConnectionError) throw dbConnectionError;
  if (!dbReadyPromise) {
    dbReadyPromise = initDbConnection();
  }
  await dbReadyPromise;
}

async function dropLegacyKeywordIndexes() {
  try {
    const collection = mongoose.connection.collection("keywords");
    const indexes = await collection.indexes();
    const legacyIndexes = indexes.filter((index) =>
      ["value_1", "normalizedValue_1"].includes(index.name)
    );

    for (const index of legacyIndexes) {
      await collection.dropIndex(index.name);
      console.log(`Dropped legacy keyword index: ${index.name}`);
    }
  } catch (error) {
    if (error.code !== 26 && error.codeName !== "NamespaceNotFound") {
      throw error;
    }
  }
}
