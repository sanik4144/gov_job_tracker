import { ensureDbReady } from "../db.js";
import { Keyword } from "../models/Keyword.js";
import User from "../models/User.js";
import { buildUserPayload } from "../utils/userView.js";

export async function listUsers(req, res, next) {
  try {
    await ensureDbReady();
    const users = await User.find().sort({ createdAt: -1 });
    const keywordCounts = await Keyword.aggregate([
      { $match: { userId: { $ne: null } } },
      { $group: { _id: "$userId", count: { $sum: 1 } } },
    ]);
    const keywordCountByUserId = new Map(
      keywordCounts.map((item) => [item._id.toString(), item.count])
    );

    res.json({
      users: users.map((user) => ({
        ...buildUserPayload(user),
        keywordCount: keywordCountByUserId.get(user._id.toString()) || 0,
        appliedJobCount: user.appliedJobs?.length || 0,
      })),
    });
  } catch (error) {
    next(error);
  }
}
