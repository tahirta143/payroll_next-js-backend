require("dotenv").config();
const { sequelize } = require("../models");

/**
 * Database Reset Script
 * 
 * This script drops all tables and recreates them to fix the "too many keys" issue.
 * Use this when MySQL complains about exceeding the 64 key limit.
 */

const resetDatabase = async () => {
  try {
    console.log("🔄  Starting database reset...");
    
    // Test connection
    await sequelize.authenticate();
    console.log("✅  Database connection established.");
    
    // Drop all tables
    console.log("🗑️   Dropping all tables...");
    await sequelize.drop();
    console.log("✅  All tables dropped.");
    
    // Recreate tables
    console.log("🏗️   Creating fresh tables...");
    await sequelize.sync({ force: false });
    console.log("✅  Tables created successfully.");
    
    // Seed default admin
    console.log("🌱  Seeding default admin...");
    const { User } = require("../models");
    const bcrypt = require("bcryptjs");
    
    const password_hash = await bcrypt.hash("Admin@1234", 12);
    await User.create({
      name: "System Administrator",
      email: "admin@attendance.com",
      password_hash,
      role: "admin",
      is_active: true,
    });
    
    console.log("✅  Default admin created: admin@attendance.com / Admin@1234");
    console.log("🎉  Database reset completed successfully!");
    
  } catch (error) {
    console.error("❌  Database reset failed:", error.message);
    process.exit(1);
  } finally {
    await sequelize.close();
    process.exit(0);
  }
};

resetDatabase();