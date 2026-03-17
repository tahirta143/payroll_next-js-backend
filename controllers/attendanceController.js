const { Attendance, User, Department } = require('../models');
const { Op } = require('sequelize');
const dayjs = require('dayjs');
const { paginate, paginatedResponse } = require('../utils/paginationHelper');
const { calcWorkHours } = require('../utils/dateHelpers');

/**
 * POST /api/attendance/check-in
 * Employee checks in for the day
 */
const checkIn = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const today = dayjs().format('YYYY-MM-DD');

    const existing = await Attendance.findOne({ where: { user_id: userId, date: today } });
    if (existing) {
      return res.status(409).json({ success: false, message: 'You have already checked in today' });
    }

    const checkInTime = dayjs().format('HH:mm:ss');

    // Late threshold: 09:00 + 15 min grace = 09:15
    const shiftStart = `${today} 09:00:00`;
    const gracePeriodEnd = dayjs(shiftStart).add(15, 'minute').format('HH:mm:ss');
    const status = checkInTime > gracePeriodEnd ? 'late' : 'present';

    const { note, latitude, longitude } = req.body;
    const location =
      latitude && longitude ? `${latitude},${longitude}` : null;

    const attendance = await Attendance.create({
      user_id: userId,
      date: today,
      check_in_time: checkInTime,
      status,
      note: note || null,
      location,
      latitude: latitude || null,
      longitude: longitude || null,
    });

    res.status(201).json({
      success: true,
      message: `Checked in successfully${status === 'late' ? ' (marked as late)' : ''}`,
      data: attendance,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/attendance/check-out
 * Employee checks out for the day
 */
const checkOut = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const today = dayjs().format('YYYY-MM-DD');

    const attendance = await Attendance.findOne({ where: { user_id: userId, date: today } });
    if (!attendance) {
      return res.status(404).json({ success: false, message: 'No check-in record found for today' });
    }
    if (attendance.check_out_time) {
      return res.status(409).json({ success: false, message: 'You have already checked out today' });
    }

    const checkOutTime = dayjs().format('HH:mm:ss');
    const workHours = calcWorkHours(attendance.check_in_time, checkOutTime);

    // Mark as half_day if worked less than 4 hours
    let status = attendance.status;
    if (workHours < 4 && status === 'present') {
      status = 'half_day';
    }

    await attendance.update({
      check_out_time: checkOutTime,
      work_hours: workHours,
      status,
    });

    res.json({
      success: true,
      message: 'Checked out successfully',
      data: attendance,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/attendance/today
 * Get today's attendance status for the logged-in user
 */
const getTodayAttendance = async (req, res, next) => {
  try {
    const today = dayjs().format('YYYY-MM-DD');
    const record = await Attendance.findOne({
      where: { user_id: req.user.id, date: today },
    });

    res.json({
      success: true,
      data: record || null,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/attendance/user/:id?startDate=&endDate=
 * Get attendance records for a specific user within a date range
 */
const getUserAttendance = async (req, res, next) => {
  try {
    const { page, limit, offset } = paginate(req.query);
    const { startDate, endDate, status } = req.query;
    const userId = req.params.id;

    // Employees can only view their own records
    if (req.user.role === 'employee' && req.user.id !== parseInt(userId)) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const where = { user_id: userId };

    if (startDate && endDate) {
      where.date = { [Op.between]: [startDate, endDate] };
    } else if (startDate) {
      where.date = { [Op.gte]: startDate };
    } else if (endDate) {
      where.date = { [Op.lte]: endDate };
    }

    if (status) where.status = status;

    const { count, rows } = await Attendance.findAndCountAll({
      where,
      limit,
      offset,
      include: [{ association: 'user', attributes: ['id', 'name', 'email', 'avatar_url'] }],
      order: [['date', 'DESC']],
    });

    res.json({ success: true, ...paginatedResponse(rows, count, page, limit) });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/attendance/all?date=&department=&status=
 * Admin/Manager — get all attendance records with filters
 */
const getAllAttendance = async (req, res, next) => {
  try {
    const { page, limit, offset } = paginate(req.query);
    const { date, department, status, search } = req.query;

    const where = {};
    if (date) where.date = date;
    if (status) where.status = status;

    const userWhere = { is_active: true };
    if (search) {
      userWhere[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { email: { [Op.like]: `%${search}%` } },
      ];
    }
    if (department) userWhere.department_id = department;

    const { count, rows } = await Attendance.findAndCountAll({
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
      ],
      order: [['date', 'DESC'], ['check_in_time', 'DESC']],
    });

    res.json({ success: true, ...paginatedResponse(rows, count, page, limit) });
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /api/attendance/:id
 * Admin only — correct an attendance record
 */
const updateAttendance = async (req, res, next) => {
  try {
    const record = await Attendance.findByPk(req.params.id);
    if (!record) {
      return res.status(404).json({ success: false, message: 'Attendance record not found' });
    }

    const { check_in_time, check_out_time, status, note } = req.body;

    // Recalculate work hours if times are being updated
    let work_hours = record.work_hours;
    const newIn = check_in_time || record.check_in_time;
    const newOut = check_out_time || record.check_out_time;
    if (newIn && newOut) {
      work_hours = calcWorkHours(newIn, newOut);
    }

    await record.update({
      check_in_time: check_in_time !== undefined ? check_in_time : record.check_in_time,
      check_out_time: check_out_time !== undefined ? check_out_time : record.check_out_time,
      status: status !== undefined ? status : record.status,
      note: note !== undefined ? note : record.note,
      work_hours,
    });

    res.json({ success: true, message: 'Attendance record updated', data: record });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/attendance/mark-absent
 * Admin utility — mark absent for users who didn't check in on a given date
 */
const markAbsent = async (req, res, next) => {
  try {
    const { date } = req.body;
    const targetDate = date || dayjs().subtract(1, 'day').format('YYYY-MM-DD');

    // Get all active employees
    const employees = await User.findAll({
      where: { is_active: true, role: ['employee', 'manager'] },
      attributes: ['id'],
    });

    // Find who already has a record for that date
    const existing = await Attendance.findAll({
      where: { date: targetDate },
      attributes: ['user_id'],
    });
    const presentIds = new Set(existing.map((a) => a.user_id));

    // Create absent records for those missing
    const toMark = employees
      .filter((e) => !presentIds.has(e.id))
      .map((e) => ({
        user_id: e.id,
        date: targetDate,
        status: 'absent',
        note: 'Auto-marked absent',
      }));

    if (toMark.length > 0) {
      await Attendance.bulkCreate(toMark);
    }

    res.json({
      success: true,
      message: `Marked ${toMark.length} employee(s) as absent for ${targetDate}`,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/attendance/mark-employee
 * Admin only — manually mark attendance for any employee
 */
const markEmployeeAttendance = async (req, res, next) => {
  try {
    const { user_id, date, status, check_in_time, check_out_time, note } = req.body;

    if (!user_id || !date || !status) {
      return res.status(400).json({
        success: false,
        message: 'User ID, date, and status are required',
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

    // Check if attendance already exists for this date
    const existing = await Attendance.findOne({
      where: { user_id, date },
    });

    if (existing) {
      return res.status(409).json({
        success: false,
        message: 'Attendance record already exists for this date',
      });
    }

    // Calculate work hours if both times provided
    let work_hours = null;
    if (check_in_time && check_out_time) {
      work_hours = calcWorkHours(check_in_time, check_out_time);
    }

    const attendance = await Attendance.create({
      user_id,
      date,
      status,
      check_in_time: check_in_time || null,
      check_out_time: check_out_time || null,
      work_hours,
      note: note || `Marked by admin: ${req.user.name}`,
    });

    // Fetch the created record with user info
    const createdRecord = await Attendance.findByPk(attendance.id, {
      include: [
        {
          association: 'user',
          attributes: ['id', 'name', 'email'],
        },
      ],
    });

    res.status(201).json({
      success: true,
      message: 'Employee attendance marked successfully',
      data: createdRecord,
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  checkIn,
  checkOut,
  getTodayAttendance,
  getUserAttendance,
  getAllAttendance,
  updateAttendance,
  markAbsent,
  markEmployeeAttendance,
};
