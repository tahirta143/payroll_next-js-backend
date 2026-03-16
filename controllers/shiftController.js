const { Shift, Holiday } = require('../models');
const { Op } = require('sequelize');
const { paginate, paginatedResponse } = require('../utils/paginationHelper');

// ─────────────────────────────────────────────
//  SHIFT CONTROLLERS
// ─────────────────────────────────────────────

/**
 * GET /api/shifts
 * Get all shifts (paginated)
 */
const getShifts = async (req, res, next) => {
  try {
    const { page, limit, offset } = paginate(req.query);
    const { search } = req.query;

    const where = {};
    if (search) {
      where.name = { [Op.like]: `%${search}%` };
    }

    const { count, rows } = await Shift.findAndCountAll({
      where,
      limit,
      offset,
      order: [['name', 'ASC']],
    });

    res.json({ success: true, ...paginatedResponse(rows, count, page, limit) });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/shifts/:id
 * Get a single shift by ID
 */
const getShiftById = async (req, res, next) => {
  try {
    const shift = await Shift.findByPk(req.params.id);
    if (!shift) {
      return res.status(404).json({ success: false, message: 'Shift not found' });
    }
    res.json({ success: true, data: shift });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/shifts
 * Admin only — create a new shift
 */
const createShift = async (req, res, next) => {
  try {
    const { name, start_time, end_time, grace_period_minutes } = req.body;

    if (!name || !start_time || !end_time) {
      return res.status(400).json({
        success: false,
        message: 'Name, start time and end time are required',
      });
    }

    // Validate time format HH:mm or HH:mm:ss
    const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)(:[0-5]\d)?$/;
    if (!timeRegex.test(start_time) || !timeRegex.test(end_time)) {
      return res.status(400).json({
        success: false,
        message: 'Times must be in HH:mm or HH:mm:ss format',
      });
    }

    const existing = await Shift.findOne({ where: { name: name.trim() } });
    if (existing) {
      return res.status(409).json({
        success: false,
        message: 'A shift with this name already exists',
      });
    }

    const shift = await Shift.create({
      name: name.trim(),
      start_time,
      end_time,
      grace_period_minutes:
        grace_period_minutes !== undefined ? parseInt(grace_period_minutes) : 15,
    });

    res.status(201).json({
      success: true,
      message: 'Shift created successfully',
      data: shift,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /api/shifts/:id
 * Admin only — update a shift
 */
const updateShift = async (req, res, next) => {
  try {
    const shift = await Shift.findByPk(req.params.id);
    if (!shift) {
      return res.status(404).json({ success: false, message: 'Shift not found' });
    }

    const { name, start_time, end_time, grace_period_minutes } = req.body;

    // Validate time format if provided
    const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)(:[0-5]\d)?$/;
    if (start_time && !timeRegex.test(start_time)) {
      return res.status(400).json({ success: false, message: 'Invalid start_time format' });
    }
    if (end_time && !timeRegex.test(end_time)) {
      return res.status(400).json({ success: false, message: 'Invalid end_time format' });
    }

    // Check name uniqueness if name is changing
    if (name && name.trim() !== shift.name) {
      const existing = await Shift.findOne({
        where: { name: name.trim(), id: { [Op.ne]: shift.id } },
      });
      if (existing) {
        return res.status(409).json({
          success: false,
          message: 'A shift with this name already exists',
        });
      }
    }

    await shift.update({
      name: name !== undefined ? name.trim() : shift.name,
      start_time: start_time !== undefined ? start_time : shift.start_time,
      end_time: end_time !== undefined ? end_time : shift.end_time,
      grace_period_minutes:
        grace_period_minutes !== undefined
          ? parseInt(grace_period_minutes)
          : shift.grace_period_minutes,
    });

    res.json({
      success: true,
      message: 'Shift updated successfully',
      data: shift,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /api/shifts/:id
 * Admin only — delete a shift
 */
const deleteShift = async (req, res, next) => {
  try {
    const shift = await Shift.findByPk(req.params.id);
    if (!shift) {
      return res.status(404).json({ success: false, message: 'Shift not found' });
    }

    await shift.destroy();
    res.json({ success: true, message: 'Shift deleted successfully' });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────
//  HOLIDAY CONTROLLERS
// ─────────────────────────────────────────────

/**
 * GET /api/holidays
 * Get all holidays — filterable by year/type
 */
const getHolidays = async (req, res, next) => {
  try {
    const { page, limit, offset } = paginate(req.query);
    const { year, type } = req.query;

    const where = {};

    if (year) {
      where.date = {
        [Op.between]: [`${year}-01-01`, `${year}-12-31`],
      };
    }

    if (type) {
      const validTypes = ['national', 'company'];
      if (!validTypes.includes(type)) {
        return res.status(400).json({ success: false, message: 'Type must be national or company' });
      }
      where.type = type;
    }

    const { count, rows } = await Holiday.findAndCountAll({
      where,
      limit,
      offset,
      order: [['date', 'ASC']],
    });

    res.json({ success: true, ...paginatedResponse(rows, count, page, limit) });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/holidays/:id
 * Get a single holiday by ID
 */
const getHolidayById = async (req, res, next) => {
  try {
    const holiday = await Holiday.findByPk(req.params.id);
    if (!holiday) {
      return res.status(404).json({ success: false, message: 'Holiday not found' });
    }
    res.json({ success: true, data: holiday });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/holidays
 * Admin only — add a new holiday
 */
const createHoliday = async (req, res, next) => {
  try {
    const { name, date, type } = req.body;

    if (!name || !date) {
      return res.status(400).json({ success: false, message: 'Name and date are required' });
    }

    // Validate date format YYYY-MM-DD
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date)) {
      return res.status(400).json({ success: false, message: 'Date must be in YYYY-MM-DD format' });
    }

    const validTypes = ['national', 'company'];
    if (type && !validTypes.includes(type)) {
      return res.status(400).json({ success: false, message: 'Type must be national or company' });
    }

    const existing = await Holiday.findOne({ where: { date } });
    if (existing) {
      return res.status(409).json({
        success: false,
        message: `A holiday already exists on ${date}: "${existing.name}"`,
      });
    }

    const holiday = await Holiday.create({
      name: name.trim(),
      date,
      type: type || 'national',
    });

    res.status(201).json({
      success: true,
      message: 'Holiday created successfully',
      data: holiday,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /api/holidays/:id
 * Admin only — update a holiday
 */
const updateHoliday = async (req, res, next) => {
  try {
    const holiday = await Holiday.findByPk(req.params.id);
    if (!holiday) {
      return res.status(404).json({ success: false, message: 'Holiday not found' });
    }

    const { name, date, type } = req.body;

    // Validate date format if provided
    if (date) {
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(date)) {
        return res.status(400).json({ success: false, message: 'Date must be in YYYY-MM-DD format' });
      }

      // Check date uniqueness if date is changing
      if (date !== holiday.date) {
        const existing = await Holiday.findOne({
          where: { date, id: { [Op.ne]: holiday.id } },
        });
        if (existing) {
          return res.status(409).json({
            success: false,
            message: `A holiday already exists on ${date}: "${existing.name}"`,
          });
        }
      }
    }

    if (type) {
      const validTypes = ['national', 'company'];
      if (!validTypes.includes(type)) {
        return res.status(400).json({ success: false, message: 'Type must be national or company' });
      }
    }

    await holiday.update({
      name: name !== undefined ? name.trim() : holiday.name,
      date: date !== undefined ? date : holiday.date,
      type: type !== undefined ? type : holiday.type,
    });

    res.json({
      success: true,
      message: 'Holiday updated successfully',
      data: holiday,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /api/holidays/:id
 * Admin only — remove a holiday
 */
const deleteHoliday = async (req, res, next) => {
  try {
    const holiday = await Holiday.findByPk(req.params.id);
    if (!holiday) {
      return res.status(404).json({ success: false, message: 'Holiday not found' });
    }

    await holiday.destroy();
    res.json({ success: true, message: 'Holiday deleted successfully' });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/holidays/upcoming
 * Get the next N upcoming holidays from today
 */
const getUpcomingHolidays = async (req, res, next) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 5, 20);
    const today = new Date().toISOString().split('T')[0];

    const holidays = await Holiday.findAll({
      where: { date: { [Op.gte]: today } },
      order: [['date', 'ASC']],
      limit,
    });

    res.json({ success: true, data: holidays });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  // Shift exports
  getShifts,
  getShiftById,
  createShift,
  updateShift,
  deleteShift,
  // Holiday exports
  getHolidays,
  getHolidayById,
  createHoliday,
  updateHoliday,
  deleteHoliday,
  getUpcomingHolidays,
};
