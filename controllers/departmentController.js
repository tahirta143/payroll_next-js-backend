const { Department, User } = require('../models');
const { Op } = require('sequelize');
const { paginate, paginatedResponse } = require('../utils/paginationHelper');

/**
 * GET /api/departments
 * Get all departments (paginated, searchable)
 */
const getDepartments = async (req, res, next) => {
  try {
    const { page, limit, offset } = paginate(req.query);
    const { search } = req.query;

    const where = {};
    if (search) {
      where.name = { [Op.like]: `%${search}%` };
    }

    const { count, rows } = await Department.findAndCountAll({
      where,
      limit,
      offset,
      include: [
        {
          association: 'manager',
          attributes: ['id', 'name', 'email', 'avatar_url'],
        },
        {
          association: 'employees',
          where: { is_active: true },
          attributes: ['id'],
          required: false,
        },
      ],
      order: [['name', 'ASC']],
    });

    // Append employee count to each department
    const data = rows.map((dept) => ({
      id: dept.id,
      name: dept.name,
      manager_id: dept.manager_id,
      manager: dept.manager || null,
      employeeCount: dept.employees ? dept.employees.length : 0,
      created_at: dept.created_at,
      updated_at: dept.updated_at,
    }));

    res.json({ success: true, ...paginatedResponse(data, count, page, limit) });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/departments/:id
 * Get a single department with its employees
 */
const getDepartmentById = async (req, res, next) => {
  try {
    const dept = await Department.findByPk(req.params.id, {
      include: [
        {
          association: 'manager',
          attributes: ['id', 'name', 'email', 'avatar_url'],
        },
        {
          association: 'employees',
          where: { is_active: true },
          attributes: ['id', 'name', 'email', 'avatar_url', 'role', 'phone'],
          required: false,
        },
      ],
    });

    if (!dept) {
      return res.status(404).json({ success: false, message: 'Department not found' });
    }

    res.json({
      success: true,
      data: {
        id: dept.id,
        name: dept.name,
        manager_id: dept.manager_id,
        manager: dept.manager || null,
        employees: dept.employees || [],
        employeeCount: dept.employees ? dept.employees.length : 0,
        created_at: dept.created_at,
        updated_at: dept.updated_at,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/departments
 * Admin only — create a new department
 */
const createDepartment = async (req, res, next) => {
  try {
    const { name, manager_id } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Department name is required' });
    }

    const existing = await Department.findOne({ where: { name: name.trim() } });
    if (existing) {
      return res.status(409).json({ success: false, message: 'A department with this name already exists' });
    }

    // If manager_id is given, verify the user exists and has an appropriate role
    if (manager_id) {
      const manager = await User.findByPk(manager_id);
      if (!manager) {
        return res.status(404).json({ success: false, message: 'Specified manager user not found' });
      }
      if (!['admin', 'manager'].includes(manager.role)) {
        return res.status(400).json({ success: false, message: 'Assigned manager must have role admin or manager' });
      }
    }

    const dept = await Department.create({
      name: name.trim(),
      manager_id: manager_id || null,
    });

    // Update the manager's department_id if provided
    if (manager_id) {
      await User.update({ department_id: dept.id }, { where: { id: manager_id } });
    }

    const created = await Department.findByPk(dept.id, {
      include: [{ association: 'manager', attributes: ['id', 'name', 'email'] }],
    });

    res.status(201).json({
      success: true,
      message: 'Department created successfully',
      data: created,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /api/departments/:id
 * Admin only — update department name or manager
 */
const updateDepartment = async (req, res, next) => {
  try {
    const dept = await Department.findByPk(req.params.id);
    if (!dept) {
      return res.status(404).json({ success: false, message: 'Department not found' });
    }

    const { name, manager_id } = req.body;

    // If name is changing, check uniqueness
    if (name && name.trim() !== dept.name) {
      const existing = await Department.findOne({
        where: { name: name.trim(), id: { [Op.ne]: dept.id } },
      });
      if (existing) {
        return res.status(409).json({ success: false, message: 'A department with this name already exists' });
      }
    }

    // Validate new manager if provided
    if (manager_id !== undefined && manager_id !== null) {
      const manager = await User.findByPk(manager_id);
      if (!manager) {
        return res.status(404).json({ success: false, message: 'Specified manager user not found' });
      }
      if (!['admin', 'manager'].includes(manager.role)) {
        return res.status(400).json({ success: false, message: 'Assigned manager must have role admin or manager' });
      }
    }

    await dept.update({
      name: name ? name.trim() : dept.name,
      manager_id: manager_id !== undefined ? manager_id : dept.manager_id,
    });

    const updated = await Department.findByPk(dept.id, {
      include: [
        { association: 'manager', attributes: ['id', 'name', 'email', 'avatar_url'] },
        {
          association: 'employees',
          where: { is_active: true },
          attributes: ['id', 'name', 'email'],
          required: false,
        },
      ],
    });

    res.json({
      success: true,
      message: 'Department updated successfully',
      data: {
        ...updated.toJSON(),
        employeeCount: updated.employees ? updated.employees.length : 0,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /api/departments/:id
 * Admin only — delete a department (only if no active employees)
 */
const deleteDepartment = async (req, res, next) => {
  try {
    const dept = await Department.findByPk(req.params.id, {
      include: [
        {
          association: 'employees',
          where: { is_active: true },
          attributes: ['id'],
          required: false,
        },
      ],
    });

    if (!dept) {
      return res.status(404).json({ success: false, message: 'Department not found' });
    }

    if (dept.employees && dept.employees.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete department with ${dept.employees.length} active employee(s). Reassign them first.`,
      });
    }

    await dept.destroy();

    res.json({ success: true, message: 'Department deleted successfully' });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/departments/:id/employees
 * Get all active employees in a department
 */
const getDepartmentEmployees = async (req, res, next) => {
  try {
    const { page, limit, offset } = paginate(req.query);

    const dept = await Department.findByPk(req.params.id);
    if (!dept) {
      return res.status(404).json({ success: false, message: 'Department not found' });
    }

    const { count, rows } = await User.findAndCountAll({
      where: { department_id: req.params.id, is_active: true },
      limit,
      offset,
      attributes: { exclude: ['password_hash', 'refresh_token'] },
      order: [['name', 'ASC']],
    });

    res.json({ success: true, ...paginatedResponse(rows, count, page, limit) });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getDepartments,
  getDepartmentById,
  createDepartment,
  updateDepartment,
  deleteDepartment,
  getDepartmentEmployees,
};
