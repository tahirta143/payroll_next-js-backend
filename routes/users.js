const express = require('express');
const router = express.Router();
const {
  getUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  uploadAvatar,
  changePassword,
} = require('../controllers/userController');
const authMiddleware = require('../middleware/authMiddleware');
const roleGuard = require('../middleware/roleGuard');
const upload = require('../middleware/upload');

// All routes require authentication
router.use(authMiddleware);

// GET /api/users — Admin/Manager only, paginated list
router.get('/', roleGuard('admin', 'manager'), getUsers);

// GET /api/users/:id — Get single user (admin/manager or self)
router.get('/:id', getUserById);

// POST /api/users — Admin only, create employee
router.post('/', roleGuard('admin'), createUser);

// PUT /api/users/:id — Admin only, update user details
router.put('/:id', roleGuard('admin'), updateUser);

// DELETE /api/users/:id — Admin only, soft-delete user
router.delete('/:id', roleGuard('admin'), deleteUser);

// POST /api/users/:id/avatar — Upload avatar (admin or self)
router.post('/:id/avatar', upload.single('avatar'), uploadAvatar);

// PUT /api/users/:id/change-password — Change password (admin or self)
router.put('/:id/change-password', changePassword);

module.exports = router;
