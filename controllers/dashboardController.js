const { User, Attendance, LeaveRequest, Department, Notification } = require('../models');
const { Op, fn, col, literal } = require('sequelize');
const dayjs = require('dayjs');

/**
 * GET /api/dashboard/stats
 * Returns KPI summary: total employees, present today, absent, on leave, late arrivals
 */
const getStats = async (req, res, next) => {
  try {
    const today = dayjs().format('YYYY-MM-DD');

    // Total active employees (non-admin)
    const totalEmployees = await User.count({
      where: { is_active: true, role: { [Op.in]: ['employee', 'manager'] } },
    });

    // Today's attendance records
    const todayRecords = await Attendance.findAll({
      where: { date: today },
      attributes: ['user_id', 'status'],
    });

    const presentCount = todayRecords.filter((r) => r.status === 'present').length;
    const lateCount = todayRecords.filter((r) => r.status === 'late').length;
    const halfDayCount = todayRecords.filter((r) => r.status === 'half_day').length;
    const onLeaveCount = todayRecords.filter((r) => r.status === 'leave').length;

    // Absent = employees who have no record today and no approved leave
    const checkedInIds = todayRecords.map((r) => r.user_id);

    const approvedLeaveToday = await LeaveRequest.findAll({
      where: {
        status: 'approved',
        start_date: { [Op.lte]: today },
        end_date: { [Op.gte]: today },
      },
      attributes: ['user_id'],
    });
    const onLeaveIds = approvedLeaveToday.map((l) => l.user_id);

    const accountedIds = [...new Set([...checkedInIds, ...onLeaveIds])];

    const absentCount =
      totalEmployees - accountedIds.filter((id) => id).length > 0
        ? totalEmployees - accountedIds.filter((id) => id).length
        : 0;

    // Pending leave requests
    const pendingLeaves = await LeaveRequest.count({ where: { status: 'pending' } });

    // Unread notifications for current user
    const unreadNotifications = await Notification.count({
      where: { user_id: req.user.id, is_read: false },
    });

    res.json({
      success: true,
      data: {
        totalEmployees,
        presentToday: presentCount,
        lateToday: lateCount,
        halfDayToday: halfDayCount,
        onLeaveToday: onLeaveToday(todayRecords, onLeaveIds),
        absentToday: absentCount,
        pendingLeaves,
        unreadNotifications,
        date: today,
      },
    });
  } catch (err) {
    next(err);
  }
};

// Helper: count users on approved leave today
function onLeaveToday(todayRecords, onLeaveIds) {
  const leaveFromRecord = todayRecords.filter((r) => r.status === 'leave').length;
  return leaveFromRecord + onLeaveIds.length;
}

/**
 * GET /api/dashboard/recent-activity
 * Returns the latest check-ins and leave requests
 */
const getRecentActivity = async (req, res, next) => {
  try {
    // Recent check-ins (last 10)
    const recentCheckIns = await Attendance.findAll({
      limit: 10,
      order: [['created_at', 'DESC']],
      include: [
        {
          association: 'user',
          attributes: ['id', 'name', 'avatar_url', 'department_id'],
          include: [{ association: 'department', attributes: ['id', 'name'] }],
        },
      ],
    });

    // Recent leave requests (last 10)
    const recentLeaves = await LeaveRequest.findAll({
      limit: 10,
      order: [['created_at', 'DESC']],
      include: [
        {
          association: 'user',
          attributes: ['id', 'name', 'avatar_url'],
          include: [{ association: 'department', attributes: ['id', 'name'] }],
        },
      ],
    });

    // Merge and sort by date
    const activities = [
      ...recentCheckIns.map((r) => ({
        id: `att_${r.id}`,
        type: 'check_in',
        user: r.user,
        message: `${r.user ? r.user.name : 'Unknown'} checked in`,
        status: r.status,
        time: r.created_at,
        meta: {
          check_in_time: r.check_in_time,
          check_out_time: r.check_out_time,
          date: r.date,
        },
      })),
      ...recentLeaves.map((l) => ({
        id: `leave_${l.id}`,
        type: 'leave_request',
        user: l.user,
        message: `${l.user ? l.user.name : 'Unknown'} requested ${l.type} leave`,
        status: l.status,
        time: l.created_at,
        meta: {
          leave_type: l.type,
          start_date: l.start_date,
          end_date: l.end_date,
          days_count: l.days_count,
        },
      })),
    ]
      .sort((a, b) => new Date(b.time) - new Date(a.time))
      .slice(0, 15);

    res.json({ success: true, data: activities });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/dashboard/attendance-trend
 * Returns daily attendance counts for the last 30 days (for line chart)
 */
const getAttendanceTrend = async (req, res, next) => {
  try {
    const days = parseInt(req.query.days) || 30;
    const endDate = dayjs().format('YYYY-MM-DD');
    const startDate = dayjs().subtract(days - 1, 'day').format('YYYY-MM-DD');

    const records = await Attendance.findAll({
      where: {
        date: { [Op.between]: [startDate, endDate] },
      },
      attributes: ['date', 'status'],
      raw: true,
    });

    // Build a map of date -> status counts
    const trendMap = {};
    let cursor = dayjs(startDate);
    while (!cursor.isAfter(dayjs(endDate))) {
      const dateStr = cursor.format('YYYY-MM-DD');
      trendMap[dateStr] = { date: dateStr, present: 0, late: 0, absent: 0, leave: 0, half_day: 0 };
      cursor = cursor.add(1, 'day');
    }

    for (const r of records) {
      const d = r.date;
      if (trendMap[d]) {
        const s = r.status;
        if (trendMap[d][s] !== undefined) trendMap[d][s]++;
      }
    }

    const trend = Object.values(trendMap);

    res.json({ success: true, data: trend });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/dashboard/department-stats
 * Returns attendance breakdown per department for today
 */
const getDepartmentStats = async (req, res, next) => {
  try {
    const today = dayjs().format('YYYY-MM-DD');

    const departments = await Department.findAll({
      include: [
        {
          association: 'employees',
          where: { is_active: true },
          attributes: ['id'],
          required: false,
          include: [
            {
              association: 'attendances',
              where: { date: today },
              attributes: ['status'],
              required: false,
            },
          ],
        },
      ],
    });

    const stats = departments.map((dept) => {
      const employees = dept.employees || [];
      const totalEmployees = employees.length;

      const present = employees.filter((e) =>
        e.attendances && e.attendances.some((a) => a.status === 'present')
      ).length;

      const late = employees.filter((e) =>
        e.attendances && e.attendances.some((a) => a.status === 'late')
      ).length;

      const onLeave = employees.filter((e) =>
        e.attendances && e.attendances.some((a) => a.status === 'leave')
      ).length;

      const absent = totalEmployees - present - late - onLeave;

      return {
        department_id: dept.id,
        department_name: dept.name,
        total: totalEmployees,
        present,
        late,
        onLeave,
        absent: absent > 0 ? absent : 0,
        attendanceRate:
          totalEmployees > 0
            ? parseFloat((((present + late) / totalEmployees) * 100).toFixed(1))
            : 0,
      };
    });

    res.json({ success: true, data: stats });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/dashboard/notifications
 * Get notifications for the logged-in user
 */
const getNotifications = async (req, res, next) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 20, 50);

    const notifications = await Notification.findAll({
      where: { user_id: req.user.id },
      order: [['created_at', 'DESC']],
      limit,
    });

    res.json({ success: true, data: notifications });
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /api/dashboard/notifications/read
 * Mark all notifications as read for logged-in user
 */
const markNotificationsRead = async (req, res, next) => {
  try {
    await Notification.update(
      { is_read: true },
      { where: { user_id: req.user.id, is_read: false } }
    );

    res.json({ success: true, message: 'All notifications marked as read' });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getStats,
  getRecentActivity,
  getAttendanceTrend,
  getDepartmentStats,
  getNotifications,
  markNotificationsRead,
};
