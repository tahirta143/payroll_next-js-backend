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

describe('Task 2.4: Property Test - Non-admin attendance management denial', () => {
  test('Property 4: Non-admin attendance management denial', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          user: fc.record({
            id: fc.integer({ min: 1, max: 100 }),
            role: fc.constantFrom('employee', 'manager')
          }),
          attendanceId: fc.integer({ min: 1, max: 1000 })
        }),
        async ({ user, attendanceId }) => {
          const token = generateToken(user);
          
          // Test attendance update - should be denied
          const updateResponse = await request(app)
            .put(`/api/attendance/${attendanceId}`)
            .set('Authorization', `Bearer ${token}`)
            .send({ status: 'present' });
          
          expect(updateResponse.status).toBe(403);
          expect(updateResponse.body.success).toBe(false);
          expect(updateResponse.body.message).toBe('Access denied. Insufficient permissions.');
          
          // Test mark absent - should be denied
          const markAbsentResponse = await request(app)
            .post('/api/attendance/mark-absent')
            .set('Authorization', `Bearer ${token}`)
            .send({ date: '2024-01-01' });
          
          expect(markAbsentResponse.status).toBe(403);
          expect(markAbsentResponse.body.success).toBe(false);
          expect(markAbsentResponse.body.message).toBe('Access denied. Insufficient permissions.');
        }
      ),
      { numRuns: 100 }
    );
  });
});