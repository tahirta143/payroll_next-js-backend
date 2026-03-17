require("dotenv").config();
const app = require('./app');
const { sequelize } = require("./models");

const PORT = process.env.PORT || 5000;

// ─────────────────────────────────────────────
//  Database Sync & Server Start
// ─────────────────────────────────────────────

const startServer = async () => {
  try {
    // Test DB connection
    await sequelize.authenticate();
    console.log("✅  Database connection established successfully.");

    // Check if we need to reset the database due to too many keys
    try {
      // Try a simple sync first
      await sequelize.sync({ alter: false });
      console.log("✅  Database models synchronized.");
    } catch (syncError) {
      if (syncError.message.includes('Too many keys specified') || syncError.message.includes('max 64 keys')) {
        console.log("⚠️   Too many keys detected. Resetting database...");
        
        // Drop all tables and recreate them
        await sequelize.drop();
        console.log("🗑️   Dropped existing tables.");
        
        // Create fresh tables
        await sequelize.sync({ force: false });
        console.log("✅  Database recreated successfully.");
      } else {
        throw syncError;
      }
    }

    // Seed a default admin if none exists
    await seedAdmin();

    app.listen(PORT, () => {
      console.log(`\n🚀  Server running on http://localhost:${PORT}`);
      console.log(`📋  Environment : ${process.env.NODE_ENV}`);
      console.log(`🔗  Client URL  : ${process.env.CLIENT_URL}`);
      console.log(`📁  Uploads at  : /uploads\n`);
    });
  } catch (error) {
    console.error("❌  Failed to start server:", error.message);
    process.exit(1);
  }
};

// ─────────────────────────────────────────────
//  Seed default admin account on first run
// ─────────────────────────────────────────────

const seedAdmin = async () => {
  try {
    const { User } = require("./models");
    const bcrypt = require("bcryptjs");

    const adminExists = await User.findOne({ where: { role: "admin" } });
    if (!adminExists) {
      const password_hash = await bcrypt.hash("Admin@1234", 12);
      await User.create({
        name: "System Administrator",
        email: "admin@attendance.com",
        password_hash,
        role: "admin",
        is_active: true,
      });
      console.log(
        "🌱  Default admin seeded: admin@attendance.com / Admin@1234",
      );
      console.log(
        "    ⚠️   Please change the default password after first login!\n",
      );
    }
  } catch (err) {
    console.error("Seed error:", err.message);
  }
};

// ─────────────────────────────────────────────
//  Graceful Shutdown
// ─────────────────────────────────────────────

process.on("SIGTERM", async () => {
  console.log("SIGTERM received. Closing database connection...");
  await sequelize.close();
  process.exit(0);
});

process.on("SIGINT", async () => {
  console.log("\nSIGINT received. Closing database connection...");
  await sequelize.close();
  process.exit(0);
});

startServer();
