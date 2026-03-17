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

describe('Task 3.3: Property Test - Non-admin user creation denial', () => {
  test('Property 6: Non-admin user creation denial', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          user: fc.record({
            id: fc.integer({ min: 1, max: 100 }),
            role: fc.constantFrom('employee', 'manager')
          }),
          newUser: fc.record({
            name: fc.string({ minLength: 1, maxLength: 100 }),
            email: fc.emailAddress(),
            password: fc.string({ minLength: 6, maxLength: 50 }),
            role: fc.constantFrom('employee', 'manager')
          })
        }),
        async ({ user, newUser }) => {
          const token = generateToken(user);
          
          const response = await request(app)
            .post('/api/users')
            .set('Authorization', `Bearer ${token}`)
            .send(newUser);
          
          // Should return 403 Forbidden for non-admin users
          expect(response.status).toBe(403);
          expect(response.body.success).toBe(false);
          expect(response.body.message).toBe('Access denied. Insufficient permissions.');
        }
      ),
      { numRuns: 100 }
    );
  });
});