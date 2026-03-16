require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const path = require("path");

const { sequelize } = require("./models");
const errorHandler = require("./middleware/errorHandler");

// Route imports
const authRoutes = require("./routes/auth");
const userRoutes = require("./routes/users");
const attendanceRoutes = require("./routes/attendance");
const leaveRoutes = require("./routes/leaves");
const reportRoutes = require("./routes/reports");
const dashboardRoutes = require("./routes/dashboard");
const departmentRoutes = require("./routes/departments");
const shiftRoutes = require("./routes/shifts");

const app = express();
const PORT = process.env.PORT || 5000;

// ─────────────────────────────────────────────
//  Security & Core Middleware
// ─────────────────────────────────────────────

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
  }),
);

app.use(
  cors({
    origin: process.env.CLIENT_URL || "https://payroll-front-next-js.vercel.app/auth/login",
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

if (process.env.NODE_ENV === "development") {
  app.use(morgan("dev"));
} else {
  app.use(morgan("combined"));
}

// ─────────────────────────────────────────────
//  Static Files (uploaded avatars)
// ─────────────────────────────────────────────

app.use(
  "/uploads",
  express.static(path.join(__dirname, "uploads"), {
    maxAge: "1d",
    etag: false,
  }),
);

// ─────────────────────────────────────────────
//  Health Check
// ─────────────────────────────────────────────

app.get("/health", (req, res) => {
  res.json({
    success: true,
    message: "Attendance Management System API is running",
    environment: process.env.NODE_ENV,
    timestamp: new Date().toISOString(),
  });
});

// ─────────────────────────────────────────────
//  API Routes
// ─────────────────────────────────────────────

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/attendance", attendanceRoutes);
app.use("/api/leaves", leaveRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/departments", departmentRoutes);
app.use("/api", shiftRoutes); // mounts /api/shifts/* and /api/holidays/*

// ─────────────────────────────────────────────
//  404 Handler
// ─────────────────────────────────────────────

app.use("*", (req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.originalUrl} not found`,
  });
});

// ─────────────────────────────────────────────
//  Global Error Handler
// ─────────────────────────────────────────────

app.use(errorHandler);

// ─────────────────────────────────────────────
//  Database Sync & Server Start
// ─────────────────────────────────────────────

const startServer = async () => {
  try {
    // Test DB connection
    await sequelize.authenticate();
    console.log("✅  Database connection established successfully.");

    // Sync models — alter:true updates schema without dropping data
    // Use force:true ONLY in development when you want a clean slate
    await sequelize.sync({ alter: process.env.NODE_ENV === "development" });
    console.log("✅  Database models synchronized.");

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
