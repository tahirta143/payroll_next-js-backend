const request = require('supertest');
const fc = require('fast-check');
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

describe('Task 1.3: Property Test - Role-based attendance record access control', () => {
  test('Property 1: Role-based attendance record access control', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          user: fc.record({
            id: fc.integer({ min: 1, max: 1000 }),
            role: fc.constantFrom('admin', 'manager', 'employee')
          }),
          targetUserId: fc.integer({ min: 1, max: 1000 })
        }),
        async ({ user, targetUserId }) => {
          const token = generateToken(user);
          
          const response = await request(app)
            .get(`/api/attendance/user/${targetUserId}`)
            .set('Authorization', `Bearer ${token}`);
          
          if (user.role === 'admin' || user.role === 'manager') {
            // Admins and managers can access any user's records
            expect([200, 404]).toContain(response.status);
          } else if (user.role === 'employee' && user.id === targetUserId) {
            // Employees can access their own records
            expect([200, 404]).toContain(response.status);
          } else {
            // Employees cannot access other users' records
            expect(response.status).toBe(403);
            expect(response.body.success).toBe(false);
            expect(response.body.message).toBe('Access denied');
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});