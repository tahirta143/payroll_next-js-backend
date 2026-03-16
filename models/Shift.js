const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Shift = sequelize.define('Shift', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  name: { type: DataTypes.STRING(100), allowNull: false },
  start_time: { type: DataTypes.TIME, allowNull: false },
  end_time: { type: DataTypes.TIME, allowNull: false },
  grace_period_minutes: { type: DataTypes.INTEGER, defaultValue: 15 },
}, { tableName: 'shifts' });

module.exports = Shift;
