const express = require('express');
const router = express.Router();
const {
  getShifts,
  getShiftById,
  createShift,
  updateShift,
  deleteShift,
  getHolidays,
  getHolidayById,
  createHoliday,
  updateHoliday,
  deleteHoliday,
  getUpcomingHolidays,
} = require('../controllers/shiftController');
const authMiddleware = require('../middleware/authMiddleware');
const roleGuard = require('../middleware/roleGuard');

// All routes require authentication
router.use(authMiddleware);

// ─────────────────────────────────────────────
//  SHIFT ROUTES
// ─────────────────────────────────────────────

// GET /api/shifts — All authenticated users can list shifts
router.get('/shifts', getShifts);

// GET /api/shifts/upcoming — not applicable for shifts, skip
// GET /api/shifts/:id — Get single shift
router.get('/shifts/:id', getShiftById);

// POST /api/shifts — Admin only
router.post('/shifts', roleGuard('admin'), createShift);

// PUT /api/shifts/:id — Admin only
router.put('/shifts/:id', roleGuard('admin'), updateShift);

// DELETE /api/shifts/:id — Admin only
router.delete('/shifts/:id', roleGuard('admin'), deleteShift);

// ─────────────────────────────────────────────
//  HOLIDAY ROUTES
// ─────────────────────────────────────────────

// GET /api/shifts/holidays/upcoming — upcoming holidays (before /:id to avoid conflict)
router.get('/holidays/upcoming', getUpcomingHolidays);

// GET /api/shifts/holidays — All authenticated users can list holidays
router.get('/holidays', getHolidays);

// GET /api/shifts/holidays/:id — Get single holiday
router.get('/holidays/:id', getHolidayById);

// POST /api/shifts/holidays — Admin only
router.post('/holidays', roleGuard('admin'), createHoliday);

// PUT /api/shifts/holidays/:id — Admin only
router.put('/holidays/:id', roleGuard('admin'), updateHoliday);

// DELETE /api/shifts/holidays/:id — Admin only
router.delete('/holidays/:id', roleGuard('admin'), deleteHoliday);

module.exports = router;
