import bcrypt from 'bcrypt';
import User from '../models/User.js';

export const registerUser = async (req, res) => {
  const { name, email, password, phone, avatar, role, telegramId, whatsappId, isActive } = req.body;

  // Validate required fields
  if (!name || !email || !password) {
    return res.status(400).json({ message: 'Name, email, and password are required' });
  }

  try {
    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'User with this email already exists' });
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create a new user
    const newUser = new User({
      name,
      email,
      password: hashedPassword,
      phone,
      avatar,
      role: role || 'user', // Default role is 'user' if not provided
      telegramId,
      whatsappId,
      isActive: isActive !== undefined ? isActive : true, // Default isActive to true if not provided
    });

    // Save the user to the database
    await newUser.save();

    return res.status(201).json({ message: 'User registered successfully' });
  } catch (error) {
    return res.status(500).json({ message: 'Server error', error: error.message });
  }
};