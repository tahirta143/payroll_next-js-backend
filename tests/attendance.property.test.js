/**
 * Property-Based Test for Task 1.3: Role-based attendance access control
 * 
 * **Validates: Requirements 1.1, 1.5, 1.6**
 * 
 * Property 1: Role-based attendance record access control
 * For any authenticated user and any user ID, when requesting attendance records 
 * via GET /api/attendance/user/:id, the system should return 200 OK if the user 
 * is an admin/manager OR if the user is an employee requesting their own records 
 * (user ID matches authenticated user ID), and should return 403 Forbidden if 
 * the user is an employee requesting another user's records.
 */

const request = require('supertest');
const express = require('express');
const fc = require('fast-check');
const jwt = require('jsonwebtoken');

// Mock the models
const mockUser = {
  findByPk: jest.fn(),
  findAll: jest.fn()
};

const mockAttendance = {
  findAndCountAll: jest.fn(),
  findByPk: jest.fn(),
  findAll: jest.fn(),
  bulkCreate: jest.fn()
};

jest.mock('../models', () => ({
  User: mockUser,
  Attendance: mockAttendance
}));

// Import after mocking
const authMiddleware = require('../middleware/authMiddleware');
const roleGuard = require('../middleware/roleGuard');
const { getUserAttendance } = require('../controllers/attendanceController');

// Create test app
const app = express();
app.use(express.json());
app.use(authMiddleware);
app.get('/api/attendance/user/:id', getUserAttendance);

// Helper to generate JWT tokens
function generateToken(user) {
  return jwt.sign({ id: user.id }, 'test-secret-key-for-testing', { expiresIn: '1h' });
}

describe('Property-Based Test: Role-based attendance access control', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock User.findByPk to return user based on the generated test data
    mockUser.findByPk.mockImplementation(async (id) => {
      // Return a user with the ID and role that matches what the test is expecting
      // This will be set dynamically in each test
      return mockUser._testUser || { id, role: 'employee', is_active: true };
    });

    // Mock Attendance.findAndCountAll to return sample data
    mockAttendance.findAndCountAll.mockResolvedValue({
      count: 5,
      rows: [
        { id: 1, user_id: 3, date: '2024-01-01', status: 'present' },
        { id: 2, user_id: 3, date: '2024-01-02', status: 'late' },
        { id: 3, user_id: 4, date: '2024-01-01', status: 'present' },
        { id: 4, user_id: 4, date: '2024-01-02', status: 'absent' },
        { id: 5, user_id: 5, date: '2024-01-01', status: 'present' }
      ]
    });

    // Mock Attendance.findByPk for update operations
    mockAttendance.findByPk = jest.fn().mockImplementation(async (id) => {
      const mockRecord = {
        id: parseInt(id),
        user_id: 3,
        date: '2024-01-01',
        check_in_time: '09:00:00',
        check_out_time: '17:00:00',
        status: 'present',
        note: null,
        work_hours: 8.0,
        update: jest.fn().mockResolvedValue(true)
      };
      return mockRecord;
    });

    // Mock User.findAll for mark-absent operations
    mockUser.findAll = jest.fn().mockResolvedValue([
      { id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }, { id: 5 }
    ]);

    // Mock Attendance.bulkCreate for mark-absent operations
    mockAttendance.bulkCreate = jest.fn().mockResolvedValue([]);
  });

  test('Property 1: Role-based attendance record access control', async () => {
    /**
     * **Validates: Requirements 1.1, 1.5, 1.6**
     */
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          user: fc.record({
            id: fc.integer({ min: 1, max: 5 }),
            role: fc.constantFrom('admin', 'manager', 'employee')
          }),
          targetUserId: fc.integer({ min: 1, max: 5 })
        }),
        async ({ user, targetUserId }) => {
          // Set the mock user data for this test iteration
          mockUser._testUser = { id: user.id, role: user.role, is_active: true };
          
          const token = generateToken(user);
          
          const response = await request(app)
            .get(`/api/attendance/user/${targetUserId}`)
            .set('Authorization', `Bearer ${token}`);
          
          // Define expected behavior based on role and target user
          if (user.role === 'admin' || user.role === 'manager') {
            // Admins and managers can access any user's records
            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
          } else if (user.role === 'employee' && user.id === targetUserId) {
            // Employees can access their own records
            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
          } else if (user.role === 'employee' && user.id !== targetUserId) {
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

  test('Property 1 - Specific test cases for edge scenarios', async () => {
    // Test admin accessing any user's records
    mockUser._testUser = { id: 1, role: 'admin', is_active: true };
    const adminToken = generateToken({ id: 1, role: 'admin' });
    
    for (let targetId = 1; targetId <= 5; targetId++) {
      const response = await request(app)
        .get(`/api/attendance/user/${targetId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    }

    // Test manager accessing any user's records
    mockUser._testUser = { id: 2, role: 'manager', is_active: true };
    const managerToken = generateToken({ id: 2, role: 'manager' });
    
    for (let targetId = 1; targetId <= 5; targetId++) {
      const response = await request(app)
        .get(`/api/attendance/user/${targetId}`)
        .set('Authorization', `Bearer ${managerToken}`);
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    }

    // Test employee accessing own records
    mockUser._testUser = { id: 3, role: 'employee', is_active: true };
    const employeeToken = generateToken({ id: 3, role: 'employee' });
    
    const ownResponse = await request(app)
      .get('/api/attendance/user/3')
      .set('Authorization', `Bearer ${employeeToken}`);
    
    expect(ownResponse.status).toBe(200);
    expect(ownResponse.body.success).toBe(true);

    // Test employee accessing other's records (should fail)
    const otherResponse = await request(app)
      .get('/api/attendance/user/4')
      .set('Authorization', `Bearer ${employeeToken}`);
    
    expect(otherResponse.status).toBe(403);
    expect(otherResponse.body.success).toBe(false);
    expect(otherResponse.body.message).toBe('Access denied');
  });

  test('Property 1 - Verify database query filtering for employees', async () => {
    mockUser._testUser = { id: 3, role: 'employee', is_active: true };
    const employeeToken = generateToken({ id: 3, role: 'employee' });
    
    await request(app)
      .get('/api/attendance/user/3')
      .set('Authorization', `Bearer ${employeeToken}`);
    
    // Verify that the database query was called with the correct user_id filter
    expect(mockAttendance.findAndCountAll).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          user_id: '3' // Note: URL params are strings
        })
      })
    );
  });
});

/**
 * Property-Based Test for Task 2.3: Admin-only attendance management operations
 * 
 * **Validates: Requirements 2.1, 2.3**
 * 
 * Property 3: Admin-only attendance management operations
 * For any authenticated admin user and any valid attendance record or bulk absent request, 
 * the system should successfully process POST /api/attendance/mark-absent and 
 * PUT /api/attendance/:id requests and return success responses.
 */

// Import additional controllers for admin operations
const { updateAttendance, markAbsent } = require('../controllers/attendanceController');

// Create additional test apps for admin operations
const updateApp = express();
updateApp.use(express.json());
updateApp.use(authMiddleware);
updateApp.put('/api/attendance/:id', roleGuard('admin'), updateAttendance);

const markAbsentApp = express();
markAbsentApp.use(express.json());
markAbsentApp.use(authMiddleware);
markAbsentApp.post('/api/attendance/mark-absent', roleGuard('admin'), markAbsent);

describe('Property-Based Test: Admin-only attendance management operations', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock User.findByPk to return user based on the generated test data
    mockUser.findByPk.mockImplementation(async (id) => {
      return mockUser._testUser || { id, role: 'admin', is_active: true };
    });

    // Mock Attendance.findByPk for update operations
    mockAttendance.findByPk = jest.fn().mockImplementation(async (id) => {
      const mockRecord = {
        id: parseInt(id),
        user_id: 3,
        date: '2024-01-01',
        check_in_time: '09:00:00',
        check_out_time: '17:00:00',
        status: 'present',
        note: null,
        work_hours: 8.0,
        update: jest.fn().mockResolvedValue(true)
      };
      return mockRecord;
    });

    // Mock User.findAll for mark-absent operations
    mockUser.findAll = jest.fn().mockResolvedValue([
      { id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }, { id: 5 }
    ]);

    // Mock Attendance.findAll for existing records check
    mockAttendance.findAll = jest.fn().mockResolvedValue([
      { user_id: 1 }, { user_id: 2 } // Some users already have records
    ]);

    // Mock Attendance.bulkCreate for mark-absent operations
    mockAttendance.bulkCreate = jest.fn().mockResolvedValue([]);
  });

  test('Property 3: Admin-only attendance management operations', async () => {
    /**
     * **Validates: Requirements 2.1, 2.3**
     */
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
            note: fc.option(fc.string({ maxLength: 100 }), { nil: null }),
            check_in_time: fc.option(fc.constantFrom('08:00:00', '09:00:00', '09:30:00'), { nil: null }),
            check_out_time: fc.option(fc.constantFrom('17:00:00', '18:00:00', '16:30:00'), { nil: null })
          }),
          markAbsentDate: fc.date({ min: new Date('2024-01-01'), max: new Date('2024-12-31') })
        }),
        async ({ adminUser, attendanceId, updateData, markAbsentDate }) => {
          // Set the mock user data for this test iteration
          mockUser._testUser = { id: adminUser.id, role: adminUser.role, is_active: true };
          
          const token = generateToken(adminUser);
          
          // Test 1: Admin can update attendance records
          const updateResponse = await request(updateApp)
            .put(`/api/attendance/${attendanceId}`)
            .set('Authorization', `Bearer ${token}`)
            .send(updateData);
          
          // Admin should be able to update attendance (200 OK)
          expect(updateResponse.status).toBe(200);
          expect(updateResponse.body.success).toBe(true);
          expect(updateResponse.body.message).toBe('Attendance record updated');
          
          // Test 2: Admin can mark employees absent
          const dateString = markAbsentDate.toISOString().split('T')[0]; // Format as YYYY-MM-DD
          const markAbsentResponse = await request(markAbsentApp)
            .post('/api/attendance/mark-absent')
            .set('Authorization', `Bearer ${token}`)
            .send({ date: dateString });
          
          // Admin should be able to mark absent (200 OK)
          expect(markAbsentResponse.status).toBe(200);
          expect(markAbsentResponse.body.success).toBe(true);
          expect(markAbsentResponse.body.message).toContain('Marked');
          expect(markAbsentResponse.body.message).toContain('absent');
        }
      ),
      { numRuns: 100 }
    );
  });

  test('Property 3 - Specific test cases for admin operations', async () => {
    // Test admin updating attendance with various data combinations
    mockUser._testUser = { id: 1, role: 'admin', is_active: true };
    const adminToken = generateToken({ id: 1, role: 'admin' });
    
    // Test updating status only
    const statusResponse = await request(updateApp)
      .put('/api/attendance/1')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'late' });
    
    expect(statusResponse.status).toBe(200);
    expect(statusResponse.body.success).toBe(true);

    // Test updating with note
    const noteResponse = await request(updateApp)
      .put('/api/attendance/2')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'present', note: 'Corrected by admin' });
    
    expect(noteResponse.status).toBe(200);
    expect(noteResponse.body.success).toBe(true);

    // Test updating times
    const timeResponse = await request(updateApp)
      .put('/api/attendance/3')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ 
        check_in_time: '08:30:00',
        check_out_time: '17:30:00',
        status: 'present'
      });
    
    expect(timeResponse.status).toBe(200);
    expect(timeResponse.body.success).toBe(true);

    // Test mark absent operation
    const markAbsentResponse = await request(markAbsentApp)
      .post('/api/attendance/mark-absent')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ date: '2024-01-15' });
    
    expect(markAbsentResponse.status).toBe(200);
    expect(markAbsentResponse.body.success).toBe(true);
    expect(markAbsentResponse.body.message).toContain('Marked');
  });

  test('Property 3 - Verify database operations for admin actions', async () => {
    mockUser._testUser = { id: 1, role: 'admin', is_active: true };
    const adminToken = generateToken({ id: 1, role: 'admin' });
    
    // Test update operation calls correct database methods
    await request(updateApp)
      .put('/api/attendance/1')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'late', note: 'Admin correction' });
    
    // Verify attendance record was found and updated
    expect(mockAttendance.findByPk).toHaveBeenCalledWith('1');
    
    // Test mark absent operation calls correct database methods
    await request(markAbsentApp)
      .post('/api/attendance/mark-absent')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ date: '2024-01-15' });
    
    // Verify users were fetched and bulk create was called
    expect(mockUser.findAll).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          is_active: true,
          role: ['employee', 'manager']
        })
      })
    );
    expect(mockAttendance.findAll).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          date: '2024-01-15'
        })
      })
    );
  });
});

/**
 * Property-Based Test for Task 2.4: Non-admin attendance management denial
 * 
 * **Validates: Requirements 2.2, 2.4**
 * 
 * Property 4: Non-admin attendance management denial
 * For any authenticated non-admin user (employee or manager), when submitting 
 * POST /api/attendance/mark-absent or PUT /api/attendance/:id, the system 
 * should return 403 Forbidden.
 */

describe('Property-Based Test: Non-admin attendance management denial', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock User.findByPk to return user based on the generated test data
    mockUser.findByPk.mockImplementation(async (id) => {
      return mockUser._testUser || { id, role: 'employee', is_active: true };
    });

    // Mock Attendance.findByPk for update operations
    mockAttendance.findByPk = jest.fn().mockImplementation(async (id) => {
      const mockRecord = {
        id: parseInt(id),
        user_id: 3,
        date: '2024-01-01',
        check_in_time: '09:00:00',
        check_out_time: '17:00:00',
        status: 'present',
        note: null,
        work_hours: 8.0,
        update: jest.fn().mockResolvedValue(true)
      };
      return mockRecord;
    });
  });

  test('Property 4: Non-admin attendance management denial', async () => {
    /**
     * **Validates: Requirements 2.2, 2.4**
     */
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          user: fc.record({
            id: fc.integer({ min: 1, max: 100 }),
            role: fc.constantFrom('employee', 'manager')
          }),
          attendanceId: fc.integer({ min: 1, max: 1000 }),
          updateData: fc.record({
            status: fc.constantFrom('present', 'absent', 'late', 'half_day', 'leave'),
            note: fc.option(fc.string({ maxLength: 100 }), { nil: null }),
            check_in_time: fc.option(fc.constantFrom('08:00:00', '09:00:00', '09:30:00'), { nil: null }),
            check_out_time: fc.option(fc.constantFrom('17:00:00', '18:00:00', '16:30:00'), { nil: null })
          }),
          markAbsentDate: fc.date({ min: new Date('2024-01-01'), max: new Date('2024-12-31') })
        }),
        async ({ user, attendanceId, updateData, markAbsentDate }) => {
          // Set the mock user data for this test iteration
          mockUser._testUser = { id: user.id, role: user.role, is_active: true };
          
          const token = generateToken(user);
          
          // Test 1: Non-admin cannot update attendance records
          const updateResponse = await request(updateApp)
            .put(`/api/attendance/${attendanceId}`)
            .set('Authorization', `Bearer ${token}`)
            .send(updateData);
          
          // Non-admin should get 403 Forbidden
          expect(updateResponse.status).toBe(403);
          expect(updateResponse.body.success).toBe(false);
          
          // Test 2: Non-admin cannot mark employees absent
          const dateString = markAbsentDate.toISOString().split('T')[0]; // Format as YYYY-MM-DD
          const markAbsentResponse = await request(markAbsentApp)
            .post('/api/attendance/mark-absent')
            .set('Authorization', `Bearer ${token}`)
            .send({ date: dateString });
          
          // Non-admin should get 403 Forbidden
          expect(markAbsentResponse.status).toBe(403);
          expect(markAbsentResponse.body.success).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('Property 4 - Specific test cases for non-admin denial', async () => {
    // Test employee attempting to update attendance
    mockUser._testUser = { id: 2, role: 'employee', is_active: true };
    const employeeToken = generateToken({ id: 2, role: 'employee' });
    
    const employeeUpdateResponse = await request(updateApp)
      .put('/api/attendance/1')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({ status: 'late' });
    
    expect(employeeUpdateResponse.status).toBe(403);
    expect(employeeUpdateResponse.body.success).toBe(false);

    // Test employee attempting to mark absent
    const employeeMarkAbsentResponse = await request(markAbsentApp)
      .post('/api/attendance/mark-absent')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({ date: '2024-01-15' });
    
    expect(employeeMarkAbsentResponse.status).toBe(403);
    expect(employeeMarkAbsentResponse.body.success).toBe(false);

    // Test manager attempting to update attendance
    mockUser._testUser = { id: 3, role: 'manager', is_active: true };
    const managerToken = generateToken({ id: 3, role: 'manager' });
    
    const managerUpdateResponse = await request(updateApp)
      .put('/api/attendance/2')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ status: 'present', note: 'Manager correction attempt' });
    
    expect(managerUpdateResponse.status).toBe(403);
    expect(managerUpdateResponse.body.success).toBe(false);

    // Test manager attempting to mark absent
    const managerMarkAbsentResponse = await request(markAbsentApp)
      .post('/api/attendance/mark-absent')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ date: '2024-01-16' });
    
    expect(managerMarkAbsentResponse.status).toBe(403);
    expect(managerMarkAbsentResponse.body.success).toBe(false);
  });

  test('Property 4 - Verify roleGuard middleware blocks non-admin access', async () => {
    // Test that the middleware prevents database operations from being called
    mockUser._testUser = { id: 4, role: 'employee', is_active: true };
    const employeeToken = generateToken({ id: 4, role: 'employee' });
    
    // Attempt update - should be blocked by roleGuard before reaching controller
    await request(updateApp)
      .put('/api/attendance/1')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({ status: 'late' });
    
    // Verify that findByPk was NOT called (blocked by middleware)
    expect(mockAttendance.findByPk).not.toHaveBeenCalled();
    
    // Reset mocks
    jest.clearAllMocks();
    
    // Attempt mark absent - should be blocked by roleGuard before reaching controller
    await request(markAbsentApp)
      .post('/api/attendance/mark-absent')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({ date: '2024-01-15' });
    
    // Verify that findAll was NOT called (blocked by middleware)
    expect(mockUser.findAll).not.toHaveBeenCalled();
    expect(mockAttendance.findAll).not.toHaveBeenCalled();
    expect(mockAttendance.bulkCreate).not.toHaveBeenCalled();
  });

  test('Property 4 - Edge cases with different user roles and data combinations', async () => {
    const testCases = [
      { role: 'employee', id: 10 },
      { role: 'manager', id: 20 },
      { role: 'employee', id: 99 },
      { role: 'manager', id: 1 }
    ];

    for (const testUser of testCases) {
      mockUser._testUser = { id: testUser.id, role: testUser.role, is_active: true };
      const token = generateToken(testUser);

      // Test various update data combinations
      const updateDataCombinations = [
        { status: 'absent' },
        { status: 'late', note: 'Traffic delay' },
        { check_in_time: '09:15:00', status: 'late' },
        { check_out_time: '16:00:00', status: 'half_day' },
        { status: 'present', note: 'Corrected', check_in_time: '08:45:00' }
      ];

      for (const updateData of updateDataCombinations) {
        const response = await request(updateApp)
          .put('/api/attendance/5')
          .set('Authorization', `Bearer ${token}`)
          .send(updateData);
        
        expect(response.status).toBe(403);
        expect(response.body.success).toBe(false);
      }

      // Test mark absent with different dates
      const dates = ['2024-01-01', '2024-06-15', '2024-12-31'];
      for (const date of dates) {
        const response = await request(markAbsentApp)
          .post('/api/attendance/mark-absent')
          .set('Authorization', `Bearer ${token}`)
          .send({ date });
        
        expect(response.status).toBe(403);
        expect(response.body.success).toBe(false);
      }
    }
  });
});