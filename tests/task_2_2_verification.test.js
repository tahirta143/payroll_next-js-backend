/**
 * Test for Task 2.2: Add role guard to mark-absent endpoint
 * 
 * **Validates: Requirements 2.1, 2.2**
 * 
 * Verifies that POST /api/attendance/mark-absent is restricted to admin users only
 */

const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');

// Mock the models
const mockUser = {
  findByPk: jest.fn(),
  findAll: jest.fn()
};

const mockAttendance = {
  findAll: jest.fn(),
  bulkCreate: jest.fn()
};

jest.mock('../models', () => ({
  User: mockUser,
  Attendance: mockAttendance
}));

// Import after mocking
const authMiddleware = require('../middleware/authMiddleware');
const roleGuard = require('../middleware/roleGuard');
const { markAbsent } = require('../controllers/attendanceController');

// Create test app
const app = express();
app.use(express.json());
app.use(authMiddleware);
app.post('/api/attendance/mark-absent', roleGuard('admin'), markAbsent);

// Helper to generate JWT tokens
function generateToken(user) {
  return jwt.sign({ id: user.id }, 'test-secret-key-for-testing', { expiresIn: '1h' });
}

describe('Task 2.2: Admin-only mark-absent endpoint', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('Employee user should receive 403 when trying to mark absent', async () => {
    /**
     * **Validates: Requirements 2.2**
     * 
     * Given an authenticated employee user
     * When submitting POST /api/attendance/mark-absent
     * Then the system returns 403 Forbidden
     */
    
    // Given: An authenticated employee user
    const employeeUser = { 
      id: 1, 
      role: 'employee',
      is_active: true 
    };
    
    // Mock User.findByPk to return the employee user
    mockUser.findByPk.mockResolvedValue(employeeUser);
    
    const token = generateToken(employeeUser);
    
    // When: Employee tries to mark employees absent
    const response = await request(app)
      .post('/api/attendance/mark-absent')
      .set('Authorization', `Bearer ${token}`)
      .send({
        date: '2024-01-15'
      });
    
    // Then: The system returns 403 Forbidden
    expect(response.status).toBe(403);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toBe('Access denied. Insufficient permissions.');
  });

  test('Manager user should receive 403 when trying to mark absent', async () => {
    /**
     * **Validates: Requirements 2.2**
     * 
     * Given an authenticated manager user
     * When submitting POST /api/attendance/mark-absent
     * Then the system returns 403 Forbidden
     */
    
    // Given: An authenticated manager user
    const managerUser = { 
      id: 2, 
      role: 'manager',
      is_active: true 
    };
    
    // Mock User.findByPk to return the manager user
    mockUser.findByPk.mockResolvedValue(managerUser);
    
    const token = generateToken(managerUser);
    
    // When: Manager tries to mark employees absent
    const response = await request(app)
      .post('/api/attendance/mark-absent')
      .set('Authorization', `Bearer ${token}`)
      .send({
        date: '2024-01-15'
      });
    
    // Then: The system returns 403 Forbidden
    expect(response.status).toBe(403);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toBe('Access denied. Insufficient permissions.');
  });

  test('Admin user should be able to mark absent successfully', async () => {
    /**
     * **Validates: Requirements 2.1**
     * 
     * Given an authenticated admin user
     * When submitting POST /api/attendance/mark-absent
     * Then the system processes the request and marks employees absent
     */
    
    // Given: An authenticated admin user
    const adminUser = { 
      id: 3, 
      role: 'admin',
      is_active: true 
    };
    
    // Mock User.findByPk to return the admin user
    mockUser.findByPk.mockResolvedValue(adminUser);
    
    // Mock User.findAll to return active employees
    mockUser.findAll.mockResolvedValue([
      { id: 1 },
      { id: 2 }
    ]);
    
    // Mock existing attendance records (empty - no one checked in)
    mockAttendance.findAll.mockResolvedValue([]);
    
    // Mock bulk create for absent records
    mockAttendance.bulkCreate.mockResolvedValue([
      { id: 1, user_id: 1, date: '2024-01-15', status: 'absent' },
      { id: 2, user_id: 2, date: '2024-01-15', status: 'absent' }
    ]);
    
    const token = generateToken(adminUser);
    
    // When: Admin marks employees absent for a date
    const response = await request(app)
      .post('/api/attendance/mark-absent')
      .set('Authorization', `Bearer ${token}`)
      .send({
        date: '2024-01-15'
      });
    
    // Then: The system returns 200 OK and processes the request
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(mockUser.findAll).toHaveBeenCalled();
    expect(mockAttendance.findAll).toHaveBeenCalled();
  });

  test('Unauthenticated request should return 401', async () => {
    /**
     * Edge case: Unauthenticated request should return 401
     */
    
    // When: Requesting without authentication token
    const response = await request(app)
      .post('/api/attendance/mark-absent')
      .send({
        date: '2024-01-15'
      });
    
    // Then: The system returns 401 Unauthorized
    expect(response.status).toBe(401);
  });

  test('Invalid token should return 401', async () => {
    /**
     * Edge case: Invalid token should return 401
     */
    
    // When: Requesting with invalid token
    const response = await request(app)
      .post('/api/attendance/mark-absent')
      .set('Authorization', 'Bearer invalid-token')
      .send({
        date: '2024-01-15'
      });
    
    // Then: The system returns 401 Unauthorized
    expect(response.status).toBe(401);
  });

  test('Admin should process request successfully even without date (uses default)', async () => {
    /**
     * Edge case: Admin should get default behavior when date is not provided
     */
    
    // Given: An authenticated admin user
    const adminUser = { 
      id: 3, 
      role: 'admin',
      is_active: true 
    };
    
    // Mock User.findByPk to return the admin user
    mockUser.findByPk.mockResolvedValue(adminUser);
    
    // Mock User.findAll to return active employees
    mockUser.findAll.mockResolvedValue([
      { id: 1 },
      { id: 2 }
    ]);
    
    // Mock existing attendance records (empty - no one checked in)
    mockAttendance.findAll.mockResolvedValue([]);
    
    // Mock bulk create for absent records
    mockAttendance.bulkCreate.mockResolvedValue([]);
    
    const token = generateToken(adminUser);
    
    // When: Admin submits request without date (should use yesterday as default)
    const response = await request(app)
      .post('/api/attendance/mark-absent')
      .set('Authorization', `Bearer ${token}`)
      .send({});
    
    // Then: The system returns 200 OK and uses default date
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
  });
});