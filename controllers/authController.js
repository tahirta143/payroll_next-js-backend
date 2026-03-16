const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const jwtConfig = require('../config/jwt');
const { User } = require('../models');

const generateTokens = (user) => {
  const payload = { id: user.id, email: user.email, role: user.role };
  const accessToken = jwt.sign(payload, jwtConfig.secret, { expiresIn: jwtConfig.expiresIn });
  const refreshToken = jwt.sign({ id: user.id }, jwtConfig.refreshSecret, { expiresIn: jwtConfig.refreshExpiresIn });
  return { accessToken, refreshToken };
};

/**
 * POST /api/auth/register
 */
const register = async (req, res, next) => {
  try {
    const { name, email, password, role, department_id } = req.body;
    if (!name || !email || !password)
      return res.status(400).json({ success: false, message: 'Name, email and password are required' });

    const existing = await User.findOne({ where: { email } });
    if (existing)
      return res.status(409).json({ success: false, message: 'Email already registered' });

    const password_hash = await bcrypt.hash(password, 12);
    const user = await User.create({
      name,
      email,
      password_hash,
      role: role || 'employee',
      department_id: department_id || null,
    });

    const { accessToken, refreshToken } = generateTokens(user);
    await user.update({ refresh_token: refreshToken });

    res.status(201).json({
      success: true,
      message: 'Registration successful',
      data: {
        accessToken,
        refreshToken,
        user: { id: user.id, name: user.name, email: user.email, role: user.role },
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/auth/login
 */
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ success: false, message: 'Email and password are required' });

    const user = await User.findOne({
      where: { email },
      include: [{ association: 'department', attributes: ['id', 'name'] }],
    });

    if (!user || !user.is_active)
      return res.status(401).json({ success: false, message: 'Invalid credentials' });

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid)
      return res.status(401).json({ success: false, message: 'Invalid credentials' });

    const { accessToken, refreshToken } = generateTokens(user);
    await user.update({ refresh_token: refreshToken });

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        accessToken,
        refreshToken,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          avatar_url: user.avatar_url,
          phone: user.phone,
          department: user.department,
        },
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/auth/logout
 */
const logout = async (req, res, next) => {
  try {
    await req.user.update({ refresh_token: null });
    res.json({ success: true, message: 'Logged out successfully' });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/auth/refresh-token
 */
const refreshToken = async (req, res, next) => {
  try {
    const { refreshToken: token } = req.body;
    if (!token)
      return res.status(400).json({ success: false, message: 'Refresh token is required' });

    let decoded;
    try {
      decoded = jwt.verify(token, jwtConfig.refreshSecret);
    } catch (err) {
      return res.status(401).json({ success: false, message: 'Invalid or expired refresh token' });
    }

    const user = await User.findByPk(decoded.id);
    if (!user || user.refresh_token !== token)
      return res.status(401).json({ success: false, message: 'Refresh token mismatch' });

    const { accessToken, refreshToken: newRefreshToken } = generateTokens(user);
    await user.update({ refresh_token: newRefreshToken });

    res.json({
      success: true,
      data: { accessToken, refreshToken: newRefreshToken },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/auth/me
 */
const getMe = async (req, res) => {
  res.json({ success: true, data: { user: req.user } });
};

module.exports = { register, login, logout, refreshToken, getMe };
