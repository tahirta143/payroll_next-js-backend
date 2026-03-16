const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const LeaveRequest = sequelize.define('LeaveRequest', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  user_id: { type: DataTypes.INTEGER, allowNull: false },
  type: { type: DataTypes.ENUM('sick', 'casual', 'annual', 'unpaid'), allowNull: false },
  start_date: { type: DataTypes.DATEONLY, allowNull: false },
  end_date: { type: DataTypes.DATEONLY, allowNull: false },
  days_count: { type: DataTypes.INTEGER, allowNull: true },
  reason: { type: DataTypes.TEXT, allowNull: false },
  status: { type: DataTypes.ENUM('pending', 'approved', 'rejected'), defaultValue: 'pending' },
  reviewed_by: { type: DataTypes.INTEGER, allowNull: true },
  review_note: { type: DataTypes.TEXT, allowNull: true },
}, { tableName: 'leave_requests' });

module.exports = LeaveRequest;
