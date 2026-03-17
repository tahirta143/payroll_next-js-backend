const bcrypt = require('bcryptjs');
const { User, Department } = require('../models');
const { paginate, paginatedResponse } = require('../utils/paginationHelper');
const { Op } = require('sequelize');

/**
 * GET /api/users
 * Admin/Manager only — paginated, searchable, filterable list of users
 */
const getUsers = async (req, res, next) => {
  try {
    const { page, limit, offset } = paginate(req.query);
    const { search, department, role } = req.query;

    const where = { 
      is_active: true,
      password_hash: { [Op.not]: null } // Only show users with passwords (actual user accounts)
    };

    if (search) {
      where[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { email: { [Op.like]: `%${search}%` } },
      ];
    }
    if (department) where.department_id = department;
    if (role) where.role = role;

    const { count, rows } = await User.findAndCountAll({
      where,
      limit,
      offset,
      include: [{ association: 'department', attributes: ['id', 'name'] }],
      attributes: { exclude: ['password_hash', 'refresh_token'] },
      order: [['created_at', 'DESC']],
    });

    res.json({ success: true, ...paginatedResponse(rows, count, page, limit) });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/users/:id
 * Get a single user by ID
 */
const getUserById = async (req, res, next) => {
  try {
    const user = await User.findByPk(req.params.id, {
      include: [{ association: 'department', attributes: ['id', 'name'] }],
      attributes: { exclude: ['password_hash', 'refresh_token'] },
    });

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.json({ success: true, data: user });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/users
 * Admin only — create a new employee/manager
 */
const createUser = async (req, res, next) => {
  try {
    const { name, email, password, role, department_id, phone } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: 'Name, email and password are required' });
    }

    const existing = await User.findOne({ where: { email } });
    if (existing) {
      return res.status(409).json({ success: false, message: 'Email already exists' });
    }

    const password_hash = await bcrypt.hash(password, 12);
    const user = await User.create({
      name,
      email,
      password_hash,
      role: role || 'employee',
      department_id: department_id || null,
      phone: phone || null,
    });

    res.status(201).json({
      success: true,
      message: 'User created successfully',
      data: { id: user.id, name: user.name, email: user.email, role: user.role },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /api/users/:id
 * Admin only — update user details
 */
const updateUser = async (req, res, next) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const { name, email, role, department_id, phone, is_active } = req.body;

    // If email is being changed, check it's not taken by another user
    if (email && email !== user.email) {
      const emailTaken = await User.findOne({ where: { email } });
      if (emailTaken) {
        return res.status(409).json({ success: false, message: 'Email already in use' });
      }
    }

    await user.update({
      name: name !== undefined ? name : user.name,
      email: email !== undefined ? email : user.email,
      role: role !== undefined ? role : user.role,
      department_id: department_id !== undefined ? department_id : user.department_id,
      phone: phone !== undefined ? phone : user.phone,
      is_active: is_active !== undefined ? is_active : user.is_active,
    });

    const updated = await User.findByPk(user.id, {
      include: [{ association: 'department', attributes: ['id', 'name'] }],
      attributes: { exclude: ['password_hash', 'refresh_token'] },
    });

    res.json({ success: true, message: 'User updated successfully', data: updated });
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /api/users/:id
 * Admin only — soft-delete (deactivate) a user
 */
const deleteUser = async (req, res, next) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Prevent deleting yourself
    if (req.user && req.user.id === user.id) {
      return res.status(400).json({ success: false, message: 'You cannot deactivate your own account' });
    }

    await user.update({ is_active: false });
    res.json({ success: true, message: 'User deactivated successfully' });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/users/:id/avatar
 * Upload/update avatar for a user
 */
const uploadAvatar = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    const user = await User.findByPk(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const avatar_url = `/uploads/avatars/${req.file.filename}`;
    await user.update({ avatar_url });

    res.json({
      success: true,
      message: 'Avatar uploaded successfully',
      data: { avatar_url },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /api/users/:id/change-password
 * Change password for a user (admin or self)
 */
const changePassword = async (req, res, next) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const { current_password, new_password } = req.body;
    if (!new_password || new_password.length < 6) {
      return res.status(400).json({ success: false, message: 'New password must be at least 6 characters' });
    }

    // If the user is changing their own password, verify current password
    if (req.user && req.user.id === user.id) {
      if (!current_password) {
        return res.status(400).json({ success: false, message: 'Current password is required' });
      }
      const valid = await bcrypt.compare(current_password, user.password_hash);
      if (!valid) {
        return res.status(401).json({ success: false, message: 'Current password is incorrect' });
      }
    }

    const password_hash = await bcrypt.hash(new_password, 12);
    await user.update({ password_hash });

    res.json({ success: true, message: 'Password changed successfully' });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  uploadAvatar,
  changePassword,
};
