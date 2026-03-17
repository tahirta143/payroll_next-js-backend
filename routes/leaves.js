const express = require('express');
const router = express.Router();
const {
  submitLeave,
  getMyLeaves,
  getAllLeaves,
  getLeaveById,
  approveLeave,
  rejectLeave,
  getLeaveBalance,
  cancelLeave,
  adminCreateLeave,
} = require('../controllers/leaveController');
const authMiddleware = require('../middleware/authMiddleware');
const roleGuard = require('../middleware/roleGuard');

// All routes require authentication
router.use(authMiddleware);

// POST /api/leaves — Employee submits a leave request
router.post('/', submitLeave);

// POST /api/leaves/admin-create — Admin creates leave for any employee
router.post('/admin-create', roleGuard('admin'), adminCreateLeave);

// GET /api/leaves/my — Employee views their own requests
router.get('/my', getMyLeaves);

// GET /api/leaves/all — Admin/Manager views all requests
router.get('/all', roleGuard('admin', 'manager'), getAllLeaves);

// GET /api/leaves/balance/:userId — Get leave balance for a user
router.get('/balance/:userId', getLeaveBalance);

// GET /api/leaves/:id — Get single leave request
router.get('/:id', getLeaveById);

// PUT /api/leaves/:id/approve — Admin/Manager approves
router.put('/:id/approve', roleGuard('admin', 'manager'), approveLeave);

// PUT /api/leaves/:id/reject — Admin/Manager rejects
router.put('/:id/reject', roleGuard('admin', 'manager'), rejectLeave);

// DELETE /api/leaves/:id — Employee cancels their own pending request
router.delete('/:id', cancelLeave);

module.exports = router;
