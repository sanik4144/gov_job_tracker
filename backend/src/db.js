import mongoose from "mongoose";
import dns from "node:dns";
import { env } from "./config/env.js";

export async function connectDb() {
  if (!env.mongodbUri) {
    throw new Error("MONGODB_URI is required");
  }

  if (env.dnsServers.length) {
    dns.setServers(env.dnsServers);
  }

  mongoose.set("strictQuery", true);
  await mongoose.connect(env.mongodbUri);
  console.log("MongoDB connected");
}
