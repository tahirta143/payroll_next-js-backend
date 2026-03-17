const { LeaveRequest, User, Notification } = require('../models');
const { Op } = require('sequelize');
const dayjs = require('dayjs');
const { paginate, paginatedResponse } = require('../utils/paginationHelper');
const { sendLeaveStatusEmail } = require('../utils/emailService');
const { getWorkingDays } = require('../utils/dateHelpers');

/**
 * Calculate how many days of each leave type a user has used this year
 */
const getLeaveUsage = async (userId) => {
  const year = dayjs().year();
  const start = `${year}-01-01`;
  const end = `${year}-12-31`;

  const approved = await LeaveRequest.findAll({
    where: {
      user_id: userId,
      status: 'approved',
      start_date: { [Op.between]: [start, end] },
    },
  });

  const usage = { sick: 0, casual: 0, annual: 0, unpaid: 0 };
  for (const req of approved) {
    usage[req.type] = (usage[req.type] || 0) + (req.days_count || 0);
  }
  return usage;
};

// Annual leave entitlements per type
const LEAVE_ENTITLEMENTS = {
  sick: 10,
  casual: 7,
  annual: 15,
  unpaid: 30,
};

/**
 * POST /api/leaves
 * Employee submits a new leave request
 */
const submitLeave = async (req, res, next) => {
  try {
    const { type, start_date, end_date, reason } = req.body;

    if (!type || !start_date || !end_date || !reason) {
      return res.status(400).json({
        success: false,
        message: 'Type, start date, end date and reason are required',
      });
    }

    const validTypes = ['sick', 'casual', 'annual', 'unpaid'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({ success: false, message: 'Invalid leave type' });
    }

    if (dayjs(start_date).isAfter(dayjs(end_date))) {
      return res.status(400).json({
        success: false,
        message: 'Start date must be before or equal to end date',
      });
    }

    const days_count = getWorkingDays(start_date, end_date);

    // Check for overlapping pending/approved requests
    const overlap = await LeaveRequest.findOne({
      where: {
        user_id: req.user.id,
        status: { [Op.in]: ['pending', 'approved'] },
        [Op.or]: [
          { start_date: { [Op.between]: [start_date, end_date] } },
          { end_date: { [Op.between]: [start_date, end_date] } },
          {
            start_date: { [Op.lte]: start_date },
            end_date: { [Op.gte]: end_date },
          },
        ],
      },
    });

    if (overlap) {
      return res.status(409).json({
        success: false,
        message: 'You already have a leave request overlapping these dates',
      });
    }

    // Check leave balance (skip for unpaid)
    if (type !== 'unpaid') {
      const usage = await getLeaveUsage(req.user.id);
      const remaining = LEAVE_ENTITLEMENTS[type] - (usage[type] || 0);
      if (days_count > remaining) {
        return res.status(400).json({
          success: false,
          message: `Insufficient ${type} leave balance. Remaining: ${remaining} day(s)`,
        });
      }
    }

    const leave = await LeaveRequest.create({
      user_id: req.user.id,
      type,
      start_date,
      end_date,
      days_count,
      reason,
      status: 'pending',
    });

    res.status(201).json({
      success: true,
      message: 'Leave request submitted successfully',
      data: leave,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/leaves/my
 * Employee views their own leave requests
 */
const getMyLeaves = async (req, res, next) => {
  try {
    const { page, limit, offset } = paginate(req.query);
    const { status, year } = req.query;

    const where = { user_id: req.user.id };
    if (status) where.status = status;
    if (year) {
      where.start_date = {
        [Op.between]: [`${year}-01-01`, `${year}-12-31`],
      };
    }

    const { count, rows } = await LeaveRequest.findAndCountAll({
      where,
      limit,
      offset,
      include: [
        {
          association: 'reviewer',
          attributes: ['id', 'name'],
        },
      ],
      order: [['created_at', 'DESC']],
    });

    res.json({ success: true, ...paginatedResponse(rows, count, page, limit) });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/leaves/all
 * Admin/Manager — view all leave requests
 */
const getAllLeaves = async (req, res, next) => {
  try {
    const { page, limit, offset } = paginate(req.query);
    const { status, department, search, month, year } = req.query;

    const where = {};
    if (status) where.status = status;

    if (month && year) {
      where.start_date = {
        [Op.between]: [
          `${year}-${String(month).padStart(2, '0')}-01`,
          dayjs(`${year}-${String(month).padStart(2, '0')}-01`)
            .endOf('month')
            .format('YYYY-MM-DD'),
        ],
      };
    } else if (year) {
      where.start_date = { [Op.between]: [`${year}-01-01`, `${year}-12-31`] };
    }

    const userWhere = { is_active: true };
    if (department) userWhere.department_id = department;
    if (search) {
      userWhere[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { email: { [Op.like]: `%${search}%` } },
      ];
    }

    const { count, rows } = await LeaveRequest.findAndCountAll({
      where,
      limit,
      offset,
      include: [
        {
          association: 'user',
          where: userWhere,
          attributes: ['id', 'name', 'email', 'avatar_url', 'department_id'],
          include: [{ association: 'department', attributes: ['id', 'name'] }],
        },
        {
          association: 'reviewer',
          attributes: ['id', 'name'],
        },
      ],
      order: [['created_at', 'DESC']],
    });

    res.json({ success: true, ...paginatedResponse(rows, count, page, limit) });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/leaves/:id
 * Get a single leave request by ID
 */
const getLeaveById = async (req, res, next) => {
  try {
    const leave = await LeaveRequest.findByPk(req.params.id, {
      include: [
        {
          association: 'user',
          attributes: ['id', 'name', 'email', 'avatar_url'],
          include: [{ association: 'department', attributes: ['id', 'name'] }],
        },
        { association: 'reviewer', attributes: ['id', 'name'] },
      ],
    });

    if (!leave) {
      return res.status(404).json({ success: false, message: 'Leave request not found' });
    }

    // Employees can only view their own
    if (req.user.role === 'employee' && leave.user_id !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    res.json({ success: true, data: leave });
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /api/leaves/:id/approve
 * Admin/Manager — approve a leave request
 */
const approveLeave = async (req, res, next) => {
  try {
    const leave = await LeaveRequest.findByPk(req.params.id, {
      include: [{ association: 'user', attributes: ['id', 'name', 'email'] }],
    });

    if (!leave) {
      return res.status(404).json({ success: false, message: 'Leave request not found' });
    }

    if (leave.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: `Leave request is already ${leave.status}`,
      });
    }

    const { review_note } = req.body;

    await leave.update({
      status: 'approved',
      reviewed_by: req.user.id,
      review_note: review_note || null,
    });

    // Create in-app notification
    await Notification.create({
      user_id: leave.user_id,
      message: `Your ${leave.type} leave request (${leave.start_date} to ${leave.end_date}) has been approved.`,
      type: 'leave_approved',
    });

    // Send email notification (non-blocking)
    if (leave.user) {
      sendLeaveStatusEmail(
        leave.user.email,
        leave.user.name,
        'approved',
        leave.type,
        leave.start_date,
        leave.end_date
      );
    }

    res.json({ success: true, message: 'Leave request approved', data: leave });
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /api/leaves/:id/reject
 * Admin/Manager — reject a leave request
 */
const rejectLeave = async (req, res, next) => {
  try {
    const leave = await LeaveRequest.findByPk(req.params.id, {
      include: [{ association: 'user', attributes: ['id', 'name', 'email'] }],
    });

    if (!leave) {
      return res.status(404).json({ success: false, message: 'Leave request not found' });
    }

    if (leave.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: `Leave request is already ${leave.status}`,
      });
    }

    const { review_note } = req.body;

    await leave.update({
      status: 'rejected',
      reviewed_by: req.user.id,
      review_note: review_note || null,
    });

    // Create in-app notification
    await Notification.create({
      user_id: leave.user_id,
      message: `Your ${leave.type} leave request (${leave.start_date} to ${leave.end_date}) has been rejected.`,
      type: 'leave_rejected',
    });

    // Send email notification (non-blocking)
    if (leave.user) {
      sendLeaveStatusEmail(
        leave.user.email,
        leave.user.name,
        'rejected',
        leave.type,
        leave.start_date,
        leave.end_date
      );
    }

    res.json({ success: true, message: 'Leave request rejected', data: leave });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/leaves/balance/:userId
 * Get leave balance (entitlement vs used) for a user
 */
const getLeaveBalance = async (req, res, next) => {
  try {
    const userId = req.params.userId;

    // Employees can only view their own balance
    if (req.user.role === 'employee' && req.user.id !== parseInt(userId)) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const usage = await getLeaveUsage(userId);

    const balance = Object.keys(LEAVE_ENTITLEMENTS).map((type) => ({
      type,
      entitlement: LEAVE_ENTITLEMENTS[type],
      used: usage[type] || 0,
      remaining: LEAVE_ENTITLEMENTS[type] - (usage[type] || 0),
    }));

    res.json({ success: true, data: balance });
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /api/leaves/:id
 * Employee cancels their own pending leave request
 */
const cancelLeave = async (req, res, next) => {
  try {
    const leave = await LeaveRequest.findByPk(req.params.id);

    if (!leave) {
      return res.status(404).json({ success: false, message: 'Leave request not found' });
    }

    if (leave.user_id !== req.user.id && req.user.role === 'employee') {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    if (leave.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: `Cannot cancel a leave request that is already ${leave.status}`,
      });
    }

    await leave.destroy();

    res.json({ success: true, message: 'Leave request cancelled successfully' });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/leaves/admin-create
 * Admin only — create leave request for any employee
 */
const adminCreateLeave = async (req, res, next) => {
  try {
    const { user_id, type, start_date, end_date, reason, status } = req.body;

    if (!user_id || !type || !start_date || !end_date || !reason) {
      return res.status(400).json({
        success: false,
        message: 'User ID, type, start date, end date and reason are required',
      });
    }

    const validTypes = ['sick', 'casual', 'annual', 'unpaid'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({ success: false, message: 'Invalid leave type' });
    }

    const validStatuses = ['pending', 'approved', 'rejected'];
    const leaveStatus = status && validStatuses.includes(status) ? status : 'approved';

    if (dayjs(start_date).isAfter(dayjs(end_date))) {
      return res.status(400).json({
        success: false,
        message: 'Start date must be before or equal to end date',
      });
    }

    // Check if employee exists
    const employee = await User.findByPk(user_id);
    if (!employee || !employee.is_active) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found or inactive',
      });
    }

    const days_count = getWorkingDays(start_date, end_date);

    // Check for overlapping pending/approved requests
    const overlap = await LeaveRequest.findOne({
      where: {
        user_id,
        status: { [Op.in]: ['pending', 'approved'] },
        [Op.or]: [
          { start_date: { [Op.between]: [start_date, end_date] } },
          { end_date: { [Op.between]: [start_date, end_date] } },
          {
            start_date: { [Op.lte]: start_date },
            end_date: { [Op.gte]: end_date },
          },
        ],
      },
    });

    if (overlap) {
      return res.status(409).json({
        success: false,
        message: 'Employee already has a leave request overlapping these dates',
      });
    }

    const leave = await LeaveRequest.create({
      user_id,
      type,
      start_date,
      end_date,
      days_count,
      reason,
      status: leaveStatus,
      reviewed_by: leaveStatus !== 'pending' ? req.user.id : null,
      review_note: leaveStatus !== 'pending' ? `Created by admin: ${req.user.name}` : null,
    });

    // Create notification for the employee
    await Notification.create({
      user_id,
      message: `A ${type} leave request has been created for you (${start_date} to ${end_date}) - Status: ${leaveStatus}`,
      type: 'leave_created',
    });

    // Fetch the created leave with user info
    const createdLeave = await LeaveRequest.findByPk(leave.id, {
      include: [
        {
          association: 'user',
          attributes: ['id', 'name', 'email'],
        },
      ],
    });

    res.status(201).json({
      success: true,
      message: 'Leave request created successfully',
      data: createdLeave,
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  submitLeave,
  getMyLeaves,
  getAllLeaves,
  getLeaveById,
  approveLeave,
  rejectLeave,
  getLeaveBalance,
  cancelLeave,
  adminCreateLeave,
};
