const express = require('express');
const router = express.Router();
const {
  checkIn,
  checkOut,
  getTodayAttendance,
  getUserAttendance,
  getAllAttendance,
  updateAttendance,
  markAbsent,
  markEmployeeAttendance,
} = require('../controllers/attendanceController');
const authMiddleware = require('../middleware/authMiddleware');
const roleGuard = require('../middleware/roleGuard');

// All routes require authentication
router.use(authMiddleware);

// POST /api/attendance/check-in
router.post('/check-in', checkIn);

// POST /api/attendance/check-out
router.post('/check-out', checkOut);

// GET /api/attendance/today — current user's today status
router.get('/today', getTodayAttendance);

// GET /api/attendance/all — Admin/Manager: all records with filters
router.get('/all', roleGuard('admin', 'manager'), getAllAttendance);

// POST /api/attendance/mark-absent — Admin utility
router.post('/mark-absent', roleGuard('admin'), markAbsent);

// POST /api/attendance/mark-employee — Admin only: manually mark attendance for any employee
router.post('/mark-employee', roleGuard('admin'), markEmployeeAttendance);

// GET /api/attendance/user/:id?startDate=&endDate=&status= — per-user records
router.get('/user/:id', getUserAttendance);

// PUT /api/attendance/:id — Admin correction of a record
router.put('/:id', roleGuard('admin'), updateAttendance);

module.exports = router;
