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

describe('Task 3.2: Property Test - Admin user creation', () => {
  test('Property 5: Admin-only user creation', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          adminUser: fc.record({
            id: fc.integer({ min: 1, max: 100 }),
            role: fc.constant('admin')
          }),
          newUser: fc.record({
            name: fc.string({ minLength: 1, maxLength: 100 }),
            email: fc.emailAddress(),
            password: fc.string({ minLength: 6, maxLength: 50 }),
            role: fc.constantFrom('employee', 'manager')
          })
        }),
        async ({ adminUser, newUser }) => {
          const token = generateToken(adminUser);
          
          const response = await request(app)
            .post('/api/users')
            .set('Authorization', `Bearer ${token}`)
            .send(newUser);
          
          // Should return 201 Created for successful creation or 409 for duplicate email
          expect([201, 409]).toContain(response.status);
          
          if (response.status === 201) {
            expect(response.body.success).toBe(true);
            expect(response.body.data).toBeDefined();
            expect(response.body.data.email).toBe(newUser.email);
            expect(response.body.data.name).toBe(newUser.name);
            expect(response.body.data.role).toBe(newUser.role);
            // Password should not be returned
            expect(response.body.data.password_hash).toBeUndefined();
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});