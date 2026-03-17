const { User, Department } = require('../models');
const { paginate, paginatedResponse } = require('../utils/paginationHelper');
const { Op } = require('sequelize');

/**
 * GET /api/employees
 * Admin/Manager only — paginated, searchable, filterable list of employees only
 */
const getEmployees = async (req, res, next) => {
  try {
    const { page, limit, offset } = paginate(req.query);
    const { search, department, role, status } = req.query;

    const where = { 
      role: { [Op.in]: ['employee', 'manager'] } // Only show employees and managers, not admins
    };

    // Allow filtering by active status, but show all by default
    if (status === 'active') {
      where.is_active = true;
    } else if (status === 'inactive') {
      where.is_active = false;
    }
    // If no status filter, show both active and inactive

    if (search) {
      where[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { email: { [Op.like]: `%${search}%` } },
      ];
    }
    if (department) where.department_id = department;
    if (role && ['employee', 'manager'].includes(role)) where.role = role;

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
 * POST /api/employees
 * Admin/Manager only — create a new employee profile (without password)
 */
const createEmployee = async (req, res, next) => {
  try {
    const { name, email, role, department_id, phone, is_active } = req.body;

    if (!name || !email) {
      return res.status(400).json({ success: false, message: 'Name and email are required' });
    }

    // Check if email already exists
    const existing = await User.findOne({ where: { email } });
    if (existing) {
      return res.status(409).json({ success: false, message: 'Email already exists' });
    }

    // Create employee profile - can be active or inactive based on admin choice
    const employee = await User.create({
      name,
      email,
      role: role || 'employee',
      department_id: department_id || null,
      phone: phone || null,
      is_active: is_active !== undefined ? is_active : true, // Active by default now
      password_hash: null, // No password initially
    });

    // Fetch the created employee with department info
    const createdEmployee = await User.findByPk(employee.id, {
      include: [{ association: 'department', attributes: ['id', 'name'] }],
      attributes: { exclude: ['password_hash', 'refresh_token'] },
    });

    const message = employee.is_active 
      ? 'Employee profile created successfully and is now active.'
      : 'Employee profile created successfully. Employee is inactive until user account is created.';

    res.status(201).json({
      success: true,
      message,
      data: createdEmployee,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /api/employees/:id
 * Admin/Manager only — update employee profile
 */
const updateEmployee = async (req, res, next) => {
  try {
    const employee = await User.findByPk(req.params.id);
    if (!employee) {
      return res.status(404).json({ success: false, message: 'Employee not found' });
    }

    const { name, email, role, department_id, phone, is_active } = req.body;

    // If email is being changed, check it's not taken by another user
    if (email && email !== employee.email) {
      const emailTaken = await User.findOne({ where: { email } });
      if (emailTaken) {
        return res.status(409).json({ success: false, message: 'Email already in use' });
      }
    }

    await employee.update({
      name: name !== undefined ? name : employee.name,
      email: email !== undefined ? email : employee.email,
      role: role !== undefined ? role : employee.role,
      department_id: department_id !== undefined ? department_id : employee.department_id,
      phone: phone !== undefined ? phone : employee.phone,
      is_active: is_active !== undefined ? is_active : employee.is_active,
    });

    const updated = await User.findByPk(employee.id, {
      include: [{ association: 'department', attributes: ['id', 'name'] }],
      attributes: { exclude: ['password_hash', 'refresh_token'] },
    });

    res.json({ success: true, message: 'Employee updated successfully', data: updated });
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /api/employees/:id
 * Admin only — soft-delete (deactivate) an employee
 */
const deleteEmployee = async (req, res, next) => {
  try {
    const employee = await User.findByPk(req.params.id);
    if (!employee) {
      return res.status(404).json({ success: false, message: 'Employee not found' });
    }

    // Prevent deleting yourself
    if (req.user && req.user.id === employee.id) {
      return res.status(400).json({ success: false, message: 'You cannot deactivate your own account' });
    }

    await employee.update({ is_active: false });
    res.json({ success: true, message: 'Employee deactivated successfully' });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/employees/:id/activate
 * Admin only — activate employee (requires user account to exist)
 */
const activateEmployee = async (req, res, next) => {
  try {
    const employee = await User.findByPk(req.params.id);
    if (!employee) {
      return res.status(404).json({ success: false, message: 'Employee not found' });
    }

    if (!employee.password_hash) {
      return res.status(400).json({ 
        success: false, 
        message: 'Cannot activate employee without user account. Please create user account first.' 
      });
    }

    await employee.update({ is_active: true });
    res.json({ success: true, message: 'Employee activated successfully' });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getEmployees,
  createEmployee,
  updateEmployee,
  deleteEmployee,
  activateEmployee,
};