const { User, Attendance, LeaveRequest, Department } = require('../models');
const { Op, fn, col, literal, sequelize: sq } = require('sequelize');
const dayjs = require('dayjs');
const { getMonthRange, getWorkingDays } = require('../utils/dateHelpers');
const { paginate, paginatedResponse } = require('../utils/paginationHelper');

/**
 * Build per-employee attendance summary for a date range
 */
const buildEmployeeSummary = async (startDate, endDate, departmentId = null) => {
  const userWhere = { is_active: true, role: { [Op.in]: ['employee', 'manager'] } };
  if (departmentId) userWhere.department_id = departmentId;

  const users = await User.findAll({
    where: userWhere,
    attributes: ['id', 'name', 'email', 'avatar_url', 'department_id'],
    include: [{ association: 'department', attributes: ['id', 'name'] }],
    order: [['name', 'ASC']],
  });

  const workingDays = getWorkingDays(startDate, endDate);

  const attendanceRecords = await Attendance.findAll({
    where: {
      date: { [Op.between]: [startDate, endDate] },
    },
    attributes: ['user_id', 'date', 'status', 'check_in_time', 'check_out_time', 'work_hours'],
    raw: true,
  });

  const leaveRecords = await LeaveRequest.findAll({
    where: {
      status: 'approved',
      start_date: { [Op.lte]: endDate },
      end_date: { [Op.gte]: startDate },
    },
    attributes: ['user_id', 'type', 'start_date', 'end_date', 'days_count'],
    raw: true,
  });

  // Index attendance by user_id
  const attByUser = {};
  for (const rec of attendanceRecords) {
    if (!attByUser[rec.user_id]) attByUser[rec.user_id] = [];
    attByUser[rec.user_id].push(rec);
  }

  // Index leaves by user_id
  const leaveByUser = {};
  for (const rec of leaveRecords) {
    if (!leaveByUser[rec.user_id]) leaveByUser[rec.user_id] = [];
    leaveByUser[rec.user_id].push(rec);
  }

  const summary = users.map((user) => {
    const records = attByUser[user.id] || [];
    const leaves = leaveByUser[user.id] || [];

    const present = records.filter((r) => r.status === 'present').length;
    const late = records.filter((r) => r.status === 'late').length;
    const halfDay = records.filter((r) => r.status === 'half_day').length;
    const leaveCount = records.filter((r) => r.status === 'leave').length;
    const absent = records.filter((r) => r.status === 'absent').length;

    const totalLeaveDays = leaves.reduce((sum, l) => {
      const s = dayjs(l.start_date).isBefore(dayjs(startDate)) ? startDate : l.start_date;
      const e = dayjs(l.end_date).isAfter(dayjs(endDate)) ? endDate : l.end_date;
      return sum + getWorkingDays(s, e);
    }, 0);

    const totalWorkHours = records.reduce((sum, r) => sum + (parseFloat(r.work_hours) || 0), 0);
    const avgWorkHours =
      records.length > 0
        ? parseFloat((totalWorkHours / (present + late + halfDay || 1)).toFixed(2))
        : 0;

    const attendanceRate =
      workingDays > 0
        ? parseFloat((((present + late + halfDay * 0.5) / workingDays) * 100).toFixed(1))
        : 0;

    return {
      user_id: user.id,
      name: user.name,
      email: user.email,
      avatar_url: user.avatar_url,
      department: user.department ? user.department.name : 'N/A',
      department_id: user.department_id,
      workingDays,
      present,
      late,
      halfDay,
      absent,
      leaveCount: leaveCount + totalLeaveDays,
      totalWorkHours: parseFloat(totalWorkHours.toFixed(2)),
      avgWorkHours,
      attendanceRate,
    };
  });

  return summary;
};

/**
 * GET /api/reports/summary?month=&year=
 * Monthly attendance summary for all employees
 */
const getMonthlySummary = async (req, res, next) => {
  try {
    const month = parseInt(req.query.month) || dayjs().month() + 1;
    const year = parseInt(req.query.year) || dayjs().year();
    const { page, limit, offset } = paginate(req.query);
    const { department } = req.query;

    const { start, end } = getMonthRange(month, year);

    let summary = await buildEmployeeSummary(start, end, department || null);

    const total = summary.length;
    const paginated = summary.slice(offset, offset + limit);

    res.json({
      success: true,
      meta: { month, year, startDate: start, endDate: end },
      ...paginatedResponse(paginated, total, page, limit),
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/reports/department?departmentId=&month=&year=
 * Department-level attendance breakdown
 */
const getDepartmentReport = async (req, res, next) => {
  try {
    const month = parseInt(req.query.month) || dayjs().month() + 1;
    const year = parseInt(req.query.year) || dayjs().year();
    const { departmentId } = req.query;

    const { start, end } = getMonthRange(month, year);

    const departments = departmentId
      ? await Department.findAll({ where: { id: departmentId } })
      : await Department.findAll();

    const report = await Promise.all(
      departments.map(async (dept) => {
        const summary = await buildEmployeeSummary(start, end, dept.id);
        const totalEmployees = summary.length;
        const totalPresent = summary.reduce((s, r) => s + r.present, 0);
        const totalLate = summary.reduce((s, r) => s + r.late, 0);
        const totalAbsent = summary.reduce((s, r) => s + r.absent, 0);
        const totalLeave = summary.reduce((s, r) => s + r.leaveCount, 0);
        const avgAttendanceRate =
          summary.length > 0
            ? parseFloat(
                (summary.reduce((s, r) => s + r.attendanceRate, 0) / summary.length).toFixed(1)
              )
            : 0;

        return {
          department_id: dept.id,
          department_name: dept.name,
          totalEmployees,
          totalPresent,
          totalLate,
          totalAbsent,
          totalLeave,
          avgAttendanceRate,
          employees: summary,
        };
      })
    );

    res.json({
      success: true,
      meta: { month, year, startDate: start, endDate: end },
      data: report,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/reports/late-arrivals?month=&year=&limit=
 * Top late arrivals report
 */
const getLateArrivals = async (req, res, next) => {
  try {
    const month = parseInt(req.query.month) || dayjs().month() + 1;
    const year = parseInt(req.query.year) || dayjs().year();
    const { start, end } = getMonthRange(month, year);
    const { page, limit, offset } = paginate(req.query);

    const records = await Attendance.findAll({
      where: {
        date: { [Op.between]: [start, end] },
        status: 'late',
      },
      include: [
        {
          association: 'user',
          where: { is_active: true },
          attributes: ['id', 'name', 'email', 'avatar_url', 'department_id'],
          include: [{ association: 'department', attributes: ['id', 'name'] }],
        },
      ],
      order: [['date', 'DESC']],
    });

    // Group by user
    const userMap = {};
    for (const r of records) {
      if (!r.user) continue;
      const uid = r.user.id;
      if (!userMap[uid]) {
        userMap[uid] = {
          user_id: uid,
          name: r.user.name,
          email: r.user.email,
          avatar_url: r.user.avatar_url,
          department: r.user.department ? r.user.department.name : 'N/A',
          lateCount: 0,
          records: [],
        };
      }
      userMap[uid].lateCount++;
      userMap[uid].records.push({
        date: r.date,
        check_in_time: r.check_in_time,
      });
    }

    const sorted = Object.values(userMap).sort((a, b) => b.lateCount - a.lateCount);
    const total = sorted.length;
    const paginated = sorted.slice(offset, offset + limit);

    res.json({
      success: true,
      meta: { month, year },
      ...paginatedResponse(paginated, total, page, limit),
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/reports/absentees?month=&year=
 * Employees with highest absence count
 */
const getAbsentees = async (req, res, next) => {
  try {
    const month = parseInt(req.query.month) || dayjs().month() + 1;
    const year = parseInt(req.query.year) || dayjs().year();
    const { start, end } = getMonthRange(month, year);
    const { page, limit, offset } = paginate(req.query);

    const records = await Attendance.findAll({
      where: {
        date: { [Op.between]: [start, end] },
        status: 'absent',
      },
      include: [
        {
          association: 'user',
          where: { is_active: true },
          attributes: ['id', 'name', 'email', 'avatar_url', 'department_id'],
          include: [{ association: 'department', attributes: ['id', 'name'] }],
        },
      ],
    });

    const userMap = {};
    for (const r of records) {
      if (!r.user) continue;
      const uid = r.user.id;
      if (!userMap[uid]) {
        userMap[uid] = {
          user_id: uid,
          name: r.user.name,
          email: r.user.email,
          avatar_url: r.user.avatar_url,
          department: r.user.department ? r.user.department.name : 'N/A',
          absentCount: 0,
        };
      }
      userMap[uid].absentCount++;
    }

    const sorted = Object.values(userMap).sort((a, b) => b.absentCount - a.absentCount);
    const total = sorted.length;
    const paginated = sorted.slice(offset, offset + limit);

    res.json({
      success: true,
      meta: { month, year },
      ...paginatedResponse(paginated, total, page, limit),
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/reports/export?format=csv&month=&year=&department=
 * Export monthly report as CSV
 */
const exportReport = async (req, res, next) => {
  try {
    const month = parseInt(req.query.month) || dayjs().month() + 1;
    const year = parseInt(req.query.year) || dayjs().year();
    const { department, format = 'csv' } = req.query;

    const { start, end } = getMonthRange(month, year);
    const summary = await buildEmployeeSummary(start, end, department || null);

    if (format === 'csv') {
      const headers = [
        'Name',
        'Email',
        'Department',
        'Working Days',
        'Present',
        'Late',
        'Half Day',
        'Absent',
        'Leave',
        'Total Work Hours',
        'Avg Work Hours',
        'Attendance Rate (%)',
      ];

      const rows = summary.map((r) => [
        r.name,
        r.email,
        r.department,
        r.workingDays,
        r.present,
        r.late,
        r.halfDay,
        r.absent,
        r.leaveCount,
        r.totalWorkHours,
        r.avgWorkHours,
        r.attendanceRate,
      ]);

      const csvContent = [headers, ...rows]
        .map((row) =>
          row
            .map((cell) => {
              const str = String(cell ?? '');
              return str.includes(',') || str.includes('"') || str.includes('\n')
                ? `"${str.replace(/"/g, '""')}"`
                : str;
            })
            .join(',')
        )
        .join('\r\n');

      const filename = `attendance_report_${year}_${String(month).padStart(2, '0')}.csv`;

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      return res.send(csvContent);
    }

    // JSON fallback
    res.json({
      success: true,
      meta: { month, year, startDate: start, endDate: end },
      data: summary,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/reports/overview?year=
 * 12-month overview (monthly totals) for charts
 */
const getYearOverview = async (req, res, next) => {
  try {
    const year = parseInt(req.query.year) || dayjs().year();

    const records = await Attendance.findAll({
      where: {
        date: { [Op.between]: [`${year}-01-01`, `${year}-12-31`] },
      },
      attributes: ['date', 'status'],
      raw: true,
    });

    // Group by month
    const months = Array.from({ length: 12 }, (_, i) => ({
      month: i + 1,
      label: dayjs(`${year}-${String(i + 1).padStart(2, '0')}-01`).format('MMM'),
      present: 0,
      late: 0,
      absent: 0,
      leave: 0,
      half_day: 0,
    }));

    for (const r of records) {
      const m = dayjs(r.date).month(); // 0-indexed
      if (months[m]) {
        const s = r.status;
        if (months[m][s] !== undefined) months[m][s]++;
      }
    }

    res.json({ success: true, data: months });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getMonthlySummary,
  getDepartmentReport,
  getLateArrivals,
  getAbsentees,
  exportReport,
  getYearOverview,
};
