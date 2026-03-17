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

describe('Task 2.3: Property Test - Admin attendance management operations', () => {
  test('Property 3: Admin-only attendance management operations', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          adminUser: fc.record({
            id: fc.integer({ min: 1, max: 100 }),
            role: fc.constant('admin')
          }),
          attendanceId: fc.integer({ min: 1, max: 1000 }),
          updateData: fc.record({
            status: fc.constantFrom('present', 'absent', 'late', 'half_day', 'leave'),
            note: fc.string()
          })
        }),
        async ({ adminUser, attendanceId, updateData }) => {
          const token = generateToken(adminUser);
          
          // Test attendance update
          const updateResponse = await request(app)
            .put(`/api/attendance/${attendanceId}`)
            .set('Authorization', `Bearer ${token}`)
            .send(updateData);
          
          // Should return 200 if exists, 404 if not found
          expect([200, 404]).toContain(updateResponse.status);
          if (updateResponse.status === 200) {
            expect(updateResponse.body.success).toBe(true);
          }
          
          // Test mark absent functionality
          const markAbsentResponse = await request(app)
            .post('/api/attendance/mark-absent')
            .set('Authorization', `Bearer ${token}`)
            .send({ date: '2024-01-01' });
          
          // Should successfully process mark absent request
          expect(markAbsentResponse.status).toBe(200);
          expect(markAbsentResponse.body.success).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });
});