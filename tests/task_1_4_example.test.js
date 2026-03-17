const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../app');

// Helper to generate JWT token for testing
const generateToken = (user) => {
  return jwt.sign(
    { id: user.id, email: `user${user.id}@test.com`, role: user.role },
    process.env.JWT_SECRET || 'test-secret',
    { expiresIn: '1h' }
  );
};

describe('Task 1.4: Example Test - Employee /all endpoint access denial', () => {
  test('Example 1: Employee /all endpoint access denial', async () => {
    // Given an authenticated employee user
    const employeeUser = {
      id: 123,
      role: 'employee'
    };
    const token = generateToken(employeeUser);

    // When requesting GET /api/attendance/all
    const response = await request(app)
      .get('/api/attendance/all')
      .set('Authorization', `Bearer ${token}`);

    // Then the system returns 403 Forbidden
    expect(response.status).toBe(403);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toBe('Access denied. Insufficient permissions.');
  });
});