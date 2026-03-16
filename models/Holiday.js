const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Holiday = sequelize.define('Holiday', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  name: { type: DataTypes.STRING(150), allowNull: false },
  date: { type: DataTypes.DATEONLY, allowNull: false, unique: true },
  type: { type: DataTypes.ENUM('national', 'company'), defaultValue: 'national' },
}, { tableName: 'holidays' });

module.exports = Holiday;
