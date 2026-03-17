const express = require('express');
const router = express.Router();
const {
  getEmployees,
  createEmployee,
  updateEmployee,
  deleteEmployee,
  activateEmployee,
} = require('../controllers/employeeController');
const authMiddleware = require('../middleware/authMiddleware');
const roleGuard = require('../middleware/roleGuard');

// All routes require authentication
router.use(authMiddleware);

// GET /api/employees — Admin/Manager only, paginated list of employees
router.get('/', roleGuard('admin', 'manager'), getEmployees);

// POST /api/employees — Admin/Manager only, create employee profile
router.post('/', roleGuard('admin', 'manager'), createEmployee);

// PUT /api/employees/:id — Admin/Manager only, update employee profile
router.put('/:id', roleGuard('admin', 'manager'), updateEmployee);

// DELETE /api/employees/:id — Admin only, soft-delete employee
router.delete('/:id', roleGuard('admin'), deleteEmployee);

// POST /api/employees/:id/activate — Admin only, activate employee
router.post('/:id/activate', roleGuard('admin'), activateEmployee);

module.exports = router;