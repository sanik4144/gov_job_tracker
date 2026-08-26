import mongoose from "mongoose";
import dns from "node:dns";
import { env } from "./config/env.js";
import { Keyword } from "./models/Keyword.js";

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
  console.log("MongoDB connected");
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
