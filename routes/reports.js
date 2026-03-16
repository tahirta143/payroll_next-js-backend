const express = require('express');
const router = express.Router();
const {
  getMonthlySummary,
  getDepartmentReport,
  getLateArrivals,
  getAbsentees,
  exportReport,
  getYearOverview,
} = require('../controllers/reportController');
const authMiddleware = require('../middleware/authMiddleware');
const roleGuard = require('../middleware/roleGuard');

// All routes require authentication
router.use(authMiddleware);

// Admin/Manager only for all report routes
router.use(roleGuard('admin', 'manager'));

// GET /api/reports/summary?month=&year=&department=
router.get('/summary', getMonthlySummary);

// GET /api/reports/department?departmentId=&month=&year=
router.get('/department', getDepartmentReport);

// GET /api/reports/late-arrivals?month=&year=
router.get('/late-arrivals', getLateArrivals);

// GET /api/reports/absentees?month=&year=
router.get('/absentees', getAbsentees);

// GET /api/reports/export?format=csv&month=&year=&department=
router.get('/export', exportReport);

// GET /api/reports/overview?year=
router.get('/overview', getYearOverview);

module.exports = router;
