const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Attendance = sequelize.define('Attendance', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  user_id: { type: DataTypes.INTEGER, allowNull: false },
  date: { type: DataTypes.DATEONLY, allowNull: false },
  check_in_time: { type: DataTypes.TIME, allowNull: true },
  check_out_time: { type: DataTypes.TIME, allowNull: true },
  status: {
    type: DataTypes.ENUM('present', 'absent', 'late', 'half_day', 'leave'),
    defaultValue: 'present',
  },
  note: { type: DataTypes.TEXT, allowNull: true },
  location: { type: DataTypes.STRING(255), allowNull: true },
  latitude: { type: DataTypes.DECIMAL(10, 8), allowNull: true },
  longitude: { type: DataTypes.DECIMAL(11, 8), allowNull: true },
  work_hours: { type: DataTypes.DECIMAL(4, 2), allowNull: true },
}, { 
  tableName: 'attendance',
  indexes: [
    {
      unique: true,
      fields: ['user_id', 'date']
    },
    {
      fields: ['user_id']
    },
    {
      fields: ['date']
    },
    {
      fields: ['status']
    }
  ]
});

module.exports = Attendance;
