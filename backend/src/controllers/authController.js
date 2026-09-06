import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import User from '../models/User.js';
import {
  buildDeepLink,
  createLinkToken,
  unlinkTelegram,
} from '../services/telegramLink.js';

function createToken(user) {
  return jwt.sign({ userId: user._id.toString(), role: user.role }, env.jwtSecret, {
    expiresIn: env.jwtExpiresIn,
  });
}

function sendAuthResponse(res, user, message = 'Authenticated successfully', status = 200) {
  return res.status(status).json({
    message,
    token: createToken(user),
    user: user.toSafeJSON(),
  });
}

export const registerUser = async (req, res) => {
  const { name, email, password, phone, avatar, telegramId, whatsappId } = req.body;

  // Validate required fields
  if (!name || !email || !password) {
    return res.status(400).json({ message: 'Name, email, and password are required' });
  }

  if (password.length < 6) {
    return res.status(400).json({ message: 'Password must be at least 6 characters long' });
  }

  try {
    // Check if user already exists
    const normalizedEmail = email.trim().toLowerCase();
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.status(400).json({ message: 'User with this email already exists' });
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create a new user
    const newUser = new User({
      name: name.trim(),
      email: normalizedEmail,
      password: hashedPassword,
      phone,
      avatar,
      telegramId,
      whatsappId,
    });

    // Save the user to the database
    await newUser.save();

    return sendAuthResponse(res, newUser, 'User registered successfully', 201);
  } catch (error) {
    return res.status(500).json({ message: 'Server error', error: error.message });
  }
};

export const loginUser = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required' });
  }

  try {
    const user = await User.findOne({ email: email.trim().toLowerCase() });
    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    if (!user.isActive) {
      return res.status(403).json({ message: 'This account is disabled' });
    }

    const passwordMatches = await bcrypt.compare(password, user.password);
    if (!passwordMatches) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    return sendAuthResponse(res, user, 'Logged in successfully');
  } catch (error) {
    return res.status(500).json({ message: 'Server error', error: error.message });
  }
};

export const getCurrentUser = async (req, res) => {
  return res.json({ user: req.user.toSafeJSON() });
};

export const updateProfile = async (req, res) => {
  // telegramId is deliberately absent: it is set only by the Telegram link flow, so
  // a user cannot type someone else's chat ID and receive their job alerts.
  const allowedFields = ["name", "phone", "avatar", "whatsappId"];

  for (const field of allowedFields) {
    if (Object.prototype.hasOwnProperty.call(req.body, field)) {
      req.user[field] = typeof req.body[field] === "string" ? req.body[field].trim() : req.body[field];
    }
  }

  if (!req.user.name) {
    return res.status(400).json({ message: "Name is required" });
  }

  const scheduleFields = [
    "notificationsEnabled",
    "notificationFrequency",
    "notificationTime",
    "notificationDayOfWeek",
  ];
  const previousSchedule = JSON.stringify(scheduleFields.map((field) => req.user[field]));

  if (Object.prototype.hasOwnProperty.call(req.body, "notificationsEnabled")) {
    req.user.notificationsEnabled = Boolean(req.body.notificationsEnabled);
  }

  // Not a schedule field: it changes what is sent at a slot, not when the slot is,
  // so it must not re-baseline notificationScheduleUpdatedAt.
  if (Object.prototype.hasOwnProperty.call(req.body, "deadlineRemindersEnabled")) {
    req.user.deadlineRemindersEnabled = Boolean(req.body.deadlineRemindersEnabled);
  }

  if (Object.prototype.hasOwnProperty.call(req.body, "notificationFrequency")) {
    if (!["daily", "weekly"].includes(req.body.notificationFrequency)) {
      return res.status(400).json({ message: "Notification frequency must be daily or weekly" });
    }
    req.user.notificationFrequency = req.body.notificationFrequency;
  }

  if (Object.prototype.hasOwnProperty.call(req.body, "notificationTime")) {
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(req.body.notificationTime)) {
      return res.status(400).json({ message: "Notification time must be in HH:mm format" });
    }
    req.user.notificationTime = req.body.notificationTime;
  }

  if (Object.prototype.hasOwnProperty.call(req.body, "notificationDayOfWeek")) {
    const dayOfWeek = Number(req.body.notificationDayOfWeek);
    if (!Number.isInteger(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) {
      return res.status(400).json({ message: "Notification day must be between Sunday and Saturday" });
    }
    req.user.notificationDayOfWeek = dayOfWeek;
  }

  // Re-baseline the schedule so a newly chosen time never fires retroactively for a
  // slot that already passed today under the old settings.
  if (JSON.stringify(scheduleFields.map((field) => req.user[field])) !== previousSchedule) {
    req.user.notificationScheduleUpdatedAt = new Date();
  }

  try {
    await req.user.save();
    return res.json({
      message: "Profile updated successfully",
      user: req.user.toSafeJSON(),
    });
  } catch (error) {
    return res.status(500).json({ message: "Server error", error: error.message });
  }
};

export const startTelegramLink = async (req, res) => {
  try {
    const link = await createLinkToken(req.user._id);

    return res.json({
      code: link.code,
      deepLink: buildDeepLink(link.token),
      botUsername: env.telegramBotUsername || null,
      expiresAt: link.expiresAt,
    });
  } catch (error) {
    return res.status(500).json({ message: "Server error", error: error.message });
  }
};

export const disconnectTelegram = async (req, res) => {
  try {
    await unlinkTelegram(req.user);

    return res.json({
      message: "Telegram disconnected",
      user: req.user.toSafeJSON(),
    });
  } catch (error) {
    return res.status(500).json({ message: "Server error", error: error.message });
  }
};

export const logoutUser = (_req, res) => {
  return res.json({ message: 'Logged out successfully' });
};
