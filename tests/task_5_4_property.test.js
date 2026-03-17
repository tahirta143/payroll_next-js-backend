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

describe('Task 5.4: Property Test - Employee attendance data isolation in client', () => {
  test('Property 2: Employee attendance data isolation in client', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          employee: fc.record({
            id: fc.integer({ min: 1, max: 1000 }),
            role: fc.constant('employee')
          }),
          dateRange: fc.record({
            startDate: fc.date({ min: new Date('2024-01-01'), max: new Date('2024-12-31') }),
            endDate: fc.date({ min: new Date('2024-01-01'), max: new Date('2024-12-31') })
          })
        }),
        async ({ employee, dateRange }) => {
          const token = generateToken(employee);
          
          // Format dates for API
          const startDate = dateRange.startDate.toISOString().split('T')[0];
          const endDate = dateRange.endDate.toISOString().split('T')[0];
          
          // Employee requests their own attendance records
          const response = await request(app)
            .get(`/api/attendance/user/${employee.id}`)
            .query({ startDate, endDate })
            .set('Authorization', `Bearer ${token}`);
          
          // Should return 200 OK for employee accessing own records
          expect([200, 404]).toContain(response.status);
          
          if (response.status === 200 && response.body.success) {
            const records = response.body.data || [];
            
            // Property: All displayed records should belong to the authenticated employee
            records.forEach(record => {
              expect(record.user_id).toBe(employee.id);
            });
            
            // Additional validation: No records from other users should be present
            const uniqueUserIds = [...new Set(records.map(r => r.user_id))];
            expect(uniqueUserIds.length).toBeLessThanOrEqual(1);
            if (uniqueUserIds.length === 1) {
              expect(uniqueUserIds[0]).toBe(employee.id);
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  test('Property 2b: Employee cannot access other users data via direct API calls', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          employee: fc.record({
            id: fc.integer({ min: 1, max: 500 }),
            role: fc.constant('employee')
          }),
          otherUserId: fc.integer({ min: 501, max: 1000 }) // Ensure different from employee.id
        }),
        async ({ employee, otherUserId }) => {
          const token = generateToken(employee);
          
          // Employee attempts to access another user's records
          const response = await request(app)
            .get(`/api/attendance/user/${otherUserId}`)
            .set('Authorization', `Bearer ${token}`);
          
          // Should return 403 Forbidden when employee tries to access other user's data
          expect(response.status).toBe(403);
          expect(response.body.success).toBe(false);
          expect(response.body.message).toBe('Access denied');
        }
      ),
      { numRuns: 100 }
    );
  });

  test('Property 2c: Employee data isolation through /all endpoint denial', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          employee: fc.record({
            id: fc.integer({ min: 1, max: 1000 }),
            role: fc.constant('employee')
          })
        }),
        async ({ employee }) => {
          const token = generateToken(employee);
          
          // Employee attempts to access the /all endpoint (which would show all users' data)
          const response = await request(app)
            .get('/api/attendance/all')
            .set('Authorization', `Bearer ${token}`);
          
          // Should return 403 Forbidden - employees cannot access aggregated data
          expect(response.status).toBe(403);
          expect(response.body.success).toBe(false);
          expect(response.body.message).toBe('Access denied. Insufficient permissions.');
        }
      ),
      { numRuns: 100 }
    );
  });
});