const express = require('express');
const router = express.Router();
const {
  register,
  login,
  logout,
  refreshToken,
  getMe,
} = require('../controllers/authController');
const authMiddleware = require('../middleware/authMiddleware');
const { authLimiter } = require('../middleware/rateLimiter');

// POST /api/auth/register
router.post('/register', authLimiter, register);

// POST /api/auth/login
router.post('/login', authLimiter, login);

// POST /api/auth/logout  (protected)
router.post('/logout', authMiddleware, logout);

// POST /api/auth/refresh-token
router.post('/refresh-token', refreshToken);

// GET /api/auth/me  (protected)
router.get('/me', authMiddleware, getMe);

module.exports = router;
