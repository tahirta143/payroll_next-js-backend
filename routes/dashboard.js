const express = require('express');
const router = express.Router();
const {
  getStats,
  getRecentActivity,
  getAttendanceTrend,
  getDepartmentStats,
  getNotifications,
  markNotificationsRead,
} = require('../controllers/dashboardController');
const authMiddleware = require('../middleware/authMiddleware');

// All routes require authentication
router.use(authMiddleware);

// GET /api/dashboard/stats — KPI summary cards
router.get('/stats', getStats);

// GET /api/dashboard/recent-activity — latest check-ins + leave requests
router.get('/recent-activity', getRecentActivity);

// GET /api/dashboard/attendance-trend?days=30 — daily counts for line chart
router.get('/attendance-trend', getAttendanceTrend);

// GET /api/dashboard/department-stats — per-department breakdown for today
router.get('/department-stats', getDepartmentStats);

// GET /api/dashboard/notifications — current user's notifications
router.get('/notifications', getNotifications);

// PUT /api/dashboard/notifications/read — mark all as read
router.put('/notifications/read', markNotificationsRead);

module.exports = router;
