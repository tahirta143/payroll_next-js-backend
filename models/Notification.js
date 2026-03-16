const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Notification = sequelize.define('Notification', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  user_id: { type: DataTypes.INTEGER, allowNull: false },
  message: { type: DataTypes.TEXT, allowNull: false },
  type: { type: DataTypes.STRING(50), defaultValue: 'info' },
  is_read: { type: DataTypes.BOOLEAN, defaultValue: false },
}, { tableName: 'notifications' });

module.exports = Notification;
