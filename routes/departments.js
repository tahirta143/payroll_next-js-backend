const express = require('express');
const router = express.Router();
const {
  getDepartments,
  getDepartmentById,
  createDepartment,
  updateDepartment,
  deleteDepartment,
  getDepartmentEmployees,
} = require('../controllers/departmentController');
const authMiddleware = require('../middleware/authMiddleware');
const roleGuard = require('../middleware/roleGuard');

// All routes require authentication
router.use(authMiddleware);

// GET /api/departments — All authenticated users can list departments
router.get('/', getDepartments);

// GET /api/departments/:id — Get single department with employees
router.get('/:id', getDepartmentById);

// GET /api/departments/:id/employees — Get employees in a department
router.get('/:id/employees', getDepartmentEmployees);

// POST /api/departments — Admin only
router.post('/', roleGuard('admin'), createDepartment);

// PUT /api/departments/:id — Admin only
router.put('/:id', roleGuard('admin'), updateDepartment);

// DELETE /api/departments/:id — Admin only
router.delete('/:id', roleGuard('admin'), deleteDepartment);

module.exports = router;
