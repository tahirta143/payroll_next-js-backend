/**
 * Test for Task 2.1: Add role guard to attendance update endpoint
 * 
 * **Validates: Requirements 2.3, 2.4**
 * 
 * Verifies that PUT /api/attendance/:id is restricted to admin users only
 */

const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');

// Mock the models
const mockUser = {
  findByPk: jest.fn()
};

const mockAttendance = {
  findByPk: jest.fn(),
  update: jest.fn()
};

jest.mock('../models', () => ({
  User: mockUser,
  Attendance: mockAttendance
}));

// Import after mocking
const authMiddleware = require('../middleware/authMiddleware');
const roleGuard = require('../middleware/roleGuard');
const { updateAttendance } = require('../controllers/attendanceController');

// Create test app
const app = express();
app.use(express.json());
app.use(authMiddleware);
app.put('/api/attendance/:id', roleGuard('admin'), updateAttendance);

// Helper to generate JWT tokens
function generateToken(user) {
  return jwt.sign({ id: user.id }, 'test-secret-key-for-testing', { expiresIn: '1h' });
}

describe('Task 2.1: Admin-only attendance update endpoint', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('Employee user should receive 403 when trying to update attendance', async () => {
    /**
     * **Validates: Requirements 2.4**
     * 
     * Given an authenticated employee user
     * When submitting PUT /api/attendance/:id
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
    
    // When: Employee tries to update attendance record
    const response = await request(app)
      .put('/api/attendance/123')
      .set('Authorization', `Bearer ${token}`)
      .send({
        status: 'present',
        note: 'Updated by employee'
      });
    
    // Then: The system returns 403 Forbidden
    expect(response.status).toBe(403);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toBe('Access denied. Insufficient permissions.');
  });

  test('Manager user should receive 403 when trying to update attendance', async () => {
    /**
     * **Validates: Requirements 2.4**
     * 
     * Given an authenticated manager user
     * When submitting PUT /api/attendance/:id
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
    
    // When: Manager tries to update attendance record
    const response = await request(app)
      .put('/api/attendance/123')
      .set('Authorization', `Bearer ${token}`)
      .send({
        status: 'late',
        note: 'Updated by manager'
      });
    
    // Then: The system returns 403 Forbidden
    expect(response.status).toBe(403);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toBe('Access denied. Insufficient permissions.');
  });

  test('Admin user should be able to update attendance successfully', async () => {
    /**
     * **Validates: Requirements 2.3**
     * 
     * Given an authenticated admin user
     * When submitting PUT /api/attendance/:id
     * Then the system processes the request and updates the record
     */
    
    // Given: An authenticated admin user
    const adminUser = { 
      id: 3, 
      role: 'admin',
      is_active: true 
    };
    
    // Mock User.findByPk to return the admin user
    mockUser.findByPk.mockResolvedValue(adminUser);
    
    // Mock existing attendance record
    const existingRecord = {
      id: 123,
      user_id: 1,
      date: '2024-01-15',
      status: 'absent',
      note: 'Original note',
      update: jest.fn().mockResolvedValue(true)
    };
    
    mockAttendance.findByPk.mockResolvedValue(existingRecord);
    
    const token = generateToken(adminUser);
    
    // When: Admin updates attendance record
    const response = await request(app)
      .put('/api/attendance/123')
      .set('Authorization', `Bearer ${token}`)
      .send({
        status: 'present',
        note: 'Updated by admin'
      });
    
    // Then: The system returns 200 OK and updates the record
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(mockAttendance.findByPk).toHaveBeenCalledWith('123');
    expect(existingRecord.update).toHaveBeenCalledWith({
      status: 'present',
      note: 'Updated by admin'
    });
  });

  test('Admin should receive 404 when trying to update non-existent attendance record', async () => {
    /**
     * Edge case: Admin trying to update non-existent record should get 404
     */
    
    // Given: An authenticated admin user
    const adminUser = { 
      id: 3, 
      role: 'admin',
      is_active: true 
    };
    
    // Mock User.findByPk to return the admin user
    mockUser.findByPk.mockResolvedValue(adminUser);
    
    // Mock attendance record not found
    mockAttendance.findByPk.mockResolvedValue(null);
    
    const token = generateToken(adminUser);
    
    // When: Admin tries to update non-existent record
    const response = await request(app)
      .put('/api/attendance/999')
      .set('Authorization', `Bearer ${token}`)
      .send({
        status: 'present',
        note: 'Updated by admin'
      });
    
    // Then: The system returns 404 Not Found
    expect(response.status).toBe(404);
    expect(response.body.success).toBe(false);
  });

  test('Unauthenticated request should return 401', async () => {
    /**
     * Edge case: Unauthenticated request should return 401
     */
    
    // When: Requesting without authentication token
    const response = await request(app)
      .put('/api/attendance/123')
      .send({
        status: 'present',
        note: 'Unauthorized update'
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
      .put('/api/attendance/123')
      .set('Authorization', 'Bearer invalid-token')
      .send({
        status: 'present',
        note: 'Invalid token update'
      });
    
    // Then: The system returns 401 Unauthorized
    expect(response.status).toBe(401);
  });
});