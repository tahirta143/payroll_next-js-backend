/**
 * Test for Task 3.1: Add role guard to user creation endpoint
 * 
 * **Validates: Requirements 3.1, 3.2**
 * 
 * Verifies that POST /api/users is restricted to admin users only
 */

const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

// Mock the models
const mockUser = {
  findByPk: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn()
};

jest.mock('../models', () => ({
  User: mockUser
}));

// Mock bcrypt
jest.mock('bcryptjs', () => ({
  hash: jest.fn().mockResolvedValue('hashed-password')
}));

// Import after mocking
const authMiddleware = require('../middleware/authMiddleware');
const roleGuard = require('../middleware/roleGuard');
const { createUser } = require('../controllers/userController');

// Create test app
const app = express();
app.use(express.json());
app.use(authMiddleware);
app.post('/api/users', roleGuard('admin'), createUser);

// Helper to generate JWT tokens
function generateToken(user) {
  return jwt.sign({ id: user.id }, 'test-secret-key-for-testing', { expiresIn: '1h' });
}

describe('Task 3.1: Admin-only user creation endpoint', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('Employee user should receive 403 when trying to create user', async () => {
    /**
     * **Validates: Requirements 3.2**
     * 
     * Given an authenticated employee user
     * When submitting POST /api/users
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
    
    // When: Employee tries to create a new user
    const response = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'New Employee',
        email: 'newemployee@example.com',
        password: 'password123',
        role: 'employee'
      });
    
    // Then: The system returns 403 Forbidden
    expect(response.status).toBe(403);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toBe('Access denied. Insufficient permissions.');
  });

  test('Manager user should receive 403 when trying to create user', async () => {
    /**
     * **Validates: Requirements 3.2**
     * 
     * Given an authenticated manager user
     * When submitting POST /api/users
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
    
    // When: Manager tries to create a new user
    const response = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'New Manager',
        email: 'newmanager@example.com',
        password: 'password123',
        role: 'manager'
      });
    
    // Then: The system returns 403 Forbidden
    expect(response.status).toBe(403);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toBe('Access denied. Insufficient permissions.');
  });

  test('Admin user should be able to create user successfully', async () => {
    /**
     * **Validates: Requirements 3.1**
     * 
     * Given an authenticated admin user
     * When submitting POST /api/users with valid data
     * Then the system creates the user and returns 201 Created
     */
    
    // Given: An authenticated admin user
    const adminUser = { 
      id: 3, 
      role: 'admin',
      is_active: true 
    };
    
    // Mock User.findByPk to return the admin user
    mockUser.findByPk.mockResolvedValue(adminUser);
    
    // Mock email uniqueness check (no existing user)
    mockUser.findOne.mockResolvedValue(null);
    
    // Mock user creation
    const createdUser = {
      id: 4,
      name: 'New Employee',
      email: 'newemployee@example.com',
      role: 'employee'
    };
    
    mockUser.create.mockResolvedValue({
      id: 4,
      name: 'New Employee',
      email: 'newemployee@example.com',
      role: 'employee'
    });
    
    const token = generateToken(adminUser);
    
    // When: Admin creates a new user
    const response = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'New Employee',
        email: 'newemployee@example.com',
        password: 'password123',
        role: 'employee'
      });
    
    // Then: The system returns 201 Created
    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.message).toBe('User created successfully');
    expect(response.body.data).toEqual(createdUser);
    expect(mockUser.findOne).toHaveBeenCalledWith({ 
      where: { email: 'newemployee@example.com' } 
    });
    expect(mockUser.create).toHaveBeenCalledWith({
      name: 'New Employee',
      email: 'newemployee@example.com',
      password_hash: 'hashed-password',
      role: 'employee',
      department_id: null,
      phone: null
    });
  });

  test('Admin should receive 409 when trying to create user with existing email', async () => {
    /**
     * Edge case: Admin trying to create user with existing email should get 409
     */
    
    // Given: An authenticated admin user
    const adminUser = { 
      id: 3, 
      role: 'admin',
      is_active: true 
    };
    
    // Mock User.findByPk to return the admin user
    mockUser.findByPk.mockResolvedValue(adminUser);
    
    // Mock existing user with same email
    mockUser.findOne.mockResolvedValue({ 
      id: 5, 
      email: 'existing@example.com' 
    });
    
    const token = generateToken(adminUser);
    
    // When: Admin tries to create user with existing email
    const response = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Duplicate User',
        email: 'existing@example.com',
        password: 'password123',
        role: 'employee'
      });
    
    // Then: The system returns 409 Conflict
    expect(response.status).toBe(409);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toBe('Email already exists');
  });

  test('Admin should receive 400 for missing required fields', async () => {
    /**
     * Edge case: Admin providing incomplete data should get 400
     */
    
    // Given: An authenticated admin user
    const adminUser = { 
      id: 3, 
      role: 'admin',
      is_active: true 
    };
    
    // Mock User.findByPk to return the admin user
    mockUser.findByPk.mockResolvedValue(adminUser);
    
    const token = generateToken(adminUser);
    
    // When: Admin tries to create user without required fields
    const response = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Incomplete User'
        // Missing email and password
      });
    
    // Then: The system returns 400 Bad Request
    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });

  test('Unauthenticated request should return 401', async () => {
    /**
     * Edge case: Unauthenticated request should return 401
     */
    
    // When: Requesting without authentication token
    const response = await request(app)
      .post('/api/users')
      .send({
        name: 'Unauthorized User',
        email: 'unauthorized@example.com',
        password: 'password123'
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
      .post('/api/users')
      .set('Authorization', 'Bearer invalid-token')
      .send({
        name: 'Invalid Token User',
        email: 'invalid@example.com',
        password: 'password123'
      });
    
    // Then: The system returns 401 Unauthorized
    expect(response.status).toBe(401);
  });
});