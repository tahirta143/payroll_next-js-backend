const sequelize = require('../config/db');
const User = require('./User');
const Department = require('./Department');
const Attendance = require('./Attendance');
const LeaveRequest = require('./LeaveRequest');
const Shift = require('./Shift');
const Holiday = require('./Holiday');
const Notification = require('./Notification');

// User <-> Department
User.belongsTo(Department, { foreignKey: 'department_id', as: 'department' });
Department.hasMany(User, { foreignKey: 'department_id', as: 'employees' });
Department.belongsTo(User, { foreignKey: 'manager_id', as: 'manager' });

// User <-> Attendance
User.hasMany(Attendance, { foreignKey: 'user_id', as: 'attendances' });
Attendance.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

// User <-> LeaveRequest
User.hasMany(LeaveRequest, { foreignKey: 'user_id', as: 'leaveRequests' });
LeaveRequest.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
LeaveRequest.belongsTo(User, { foreignKey: 'reviewed_by', as: 'reviewer' });

// User <-> Notification
User.hasMany(Notification, { foreignKey: 'user_id', as: 'notifications' });
Notification.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

module.exports = { sequelize, User, Department, Attendance, LeaveRequest, Shift, Holiday, Notification };
