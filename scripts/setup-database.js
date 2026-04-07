require("dotenv").config();
const mysql = require('mysql2/promise');

/**
 * Database Setup Script
 * 
 * This script creates the attendance_db database if it doesn't exist
 * and then runs the sync to create all tables.
 */

const setupDatabase = async () => {
  try {
    console.log("🔄  Starting database setup...");
    
    // Connect to MySQL without specifying a database
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 3306,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASS || ''
    });
    
    console.log("✅  Connected to MySQL server.");
    
    // Create database if it doesn't exist
    await connection.execute('CREATE DATABASE IF NOT EXISTS attendance_db');
    console.log("✅  Database 'attendance_db' created or already exists.");
    
    // Close the connection
    await connection.end();
    
    // Now run the sync to create tables
    const { sequelize } = require("../models");
    await sequelize.sync({ force: false });
    console.log("✅  Database tables created successfully.");
    
    console.log("🎉  Database setup completed successfully!");
    
  } catch (error) {
    console.error("❌  Database setup failed:", error.message);
    process.exit(1);
  } finally {
    process.exit(0);
  }
};

setupDatabase();
