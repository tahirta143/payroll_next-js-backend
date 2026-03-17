/**
 * Example Test for Task 1.4: Employee /all endpoint access denial
 * 
 * **Validates: Requirements 1.2**
 * 
 * Example 1: Employee /all endpoint access denial
 * Test that employee receives 403 when requesting /all endpoint
 */

const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');

// Mock the models
const mockUser = {
  findByPk: jest.fn()
};

const mockAttendance = {
  findAndCountAll: jest.fn()
};

jest.mock('../models', () => ({
  User: mockUser,
  Attendance: mockAttendance
}));

// Import after mocking
const authMiddleware = require('../middleware/authMiddleware');
const roleGuard = require('../middleware/roleGuard');
const { getAllAttendance } = require('../controllers/attendanceController');

// Create test app
const app = express();
app.use(express.json());
app.use(authMiddleware);
app.get('/api/attendance/all', roleGuard('admin', 'manager'), getAllAttendance);

// Helper to generate JWT tokens
function generateToken(user) {
  return jwt.sign({ id: user.id }, 'test-secret-key-for-testing', { expiresIn: '1h' });
}

describe('Example Test: Employee /all endpoint access denial', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('Example 1: Employee /all endpoint access denial', async () => {
    /**
     * **Validates: Requirements 1.2**
     * 
     * Given an authenticated employee user
     * When requesting GET /api/attendance/all
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
    
    // When: Requesting GET /api/attendance/all
    const response = await request(app)
      .get('/api/attendance/all')
      .set('Authorization', `Bearer ${token}`);
    
    // Then: The system returns 403 Forbidden
    expect(response.status).toBe(403);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toBe('Access denied. Insufficient permissions.');
  });

  test('Verify admin can access /all endpoint (positive test case)', async () => {
    /**
     * Positive test case to ensure the endpoint works for authorized users
     */
    
    // Given: An authenticated admin user
    const adminUser = { 
      id: 2, 
      role: 'admin',
      is_active: true 
    };
    
    // Mock User.findByPk to return the admin user
    mockUser.findByPk.mockResolvedValue(adminUser);
    
    // Mock successful attendance query
    mockAttendance.findAndCountAll.mockResolvedValue({
      count: 3,
      rows: [
        { id: 1, user_id: 1, date: '2024-01-01', status: 'present' },
        { id: 2, user_id: 2, date: '2024-01-01', status: 'late' },
        { id: 3, user_id: 3, date: '2024-01-01', status: 'absent' }
      ]
    });
    
    const token = generateToken(adminUser);
    
    // When: Admin requests GET /api/attendance/all
    const response = await request(app)
      .get('/api/attendance/all')
      .set('Authorization', `Bearer ${token}`);
    
    // Then: The system returns 200 OK
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toBeDefined();
  });

  test('Verify manager can access /all endpoint (positive test case)', async () => {
    /**
     * Positive test case to ensure the endpoint works for managers
     */
    
    // Given: An authenticated manager user
    const managerUser = { 
      id: 3, 
      role: 'manager',
      is_active: true 
    };
    
    // Mock User.findByPk to return the manager user
    mockUser.findByPk.mockResolvedValue(managerUser);
    
    // Mock successful attendance query
    mockAttendance.findAndCountAll.mockResolvedValue({
      count: 2,
      rows: [
        { id: 1, user_id: 1, date: '2024-01-01', status: 'present' },
        { id: 2, user_id: 2, date: '2024-01-01', status: 'late' }
      ]
    });
    
    const token = generateToken(managerUser);
    
    // When: Manager requests GET /api/attendance/all
    const response = await request(app)
      .get('/api/attendance/all')
      .set('Authorization', `Bearer ${token}`);
    
    // Then: The system returns 200 OK
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toBeDefined();
  });

  test('Verify unauthenticated request returns 401', async () => {
    /**
     * Edge case: Unauthenticated request should return 401
     */
    
    // When: Requesting without authentication token
    const response = await request(app)
      .get('/api/attendance/all');
    
    // Then: The system returns 401 Unauthorized
    expect(response.status).toBe(401);
  });

  test('Verify invalid token returns 401', async () => {
    /**
     * Edge case: Invalid token should return 401
     */
    
    // When: Requesting with invalid token
    const response = await request(app)
      .get('/api/attendance/all')
      .set('Authorization', 'Bearer invalid-token');
    
    // Then: The system returns 401 Unauthorized
    expect(response.status).toBe(401);
  });
});