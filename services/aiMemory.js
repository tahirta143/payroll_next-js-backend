const { User, Department, Attendance, LeaveRequest } = require('../models');

// Memory system for AI context
class AIMemorySystem {
  constructor() {
    this.cache = new Map();
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
  }

  // Get cached data or fetch fresh data
  async getCachedData(key, fetchFunction) {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data;
    }

    const data = await fetchFunction();
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
    return data;
  }

  // Get company overview
  async getCompanyOverview() {
    return this.getCachedData('company_overview', async () => {
      try {
        const totalEmployees = await User.count({ where: { is_active: true } });
        const totalDepartments = await Department.count();
        
        // Get employees by role
        const employeesByRole = await User.findAll({
          attributes: [
            'role',
            [require('sequelize').fn('COUNT', require('sequelize').col('id')), 'count']
          ],
          where: { is_active: true },
          group: ['role'],
          raw: true
        });

        // Get departments with employee counts
        const departments = await Department.findAll({
          include: [{
            model: User,
            as: 'employees', // Correct alias from models/index.js
            attributes: ['id'],
            where: { is_active: true },
            required: false // Use LEFT JOIN to include departments with no employees
          }],
          raw: false
        });

        return {
          totalEmployees,
          activeEmployees: totalEmployees,
          totalDepartments,
          employeesByRole: employeesByRole.reduce((acc, item) => {
            acc[item.role] = parseInt(item.count);
            return acc;
          }, {}),
          departments: departments.map(dept => ({
            name: dept.name,
            employeeCount: dept.employees ? dept.employees.length : 0
          }))
        };
      } catch (error) {
        console.error('Error fetching company overview:', error);
        return {
          totalEmployees: 0,
          activeEmployees: 0,
          totalDepartments: 0,
          employeesByRole: {},
          departments: []
        };
      }
    });
  }

  // Get current attendance status
  async getCurrentAttendance() {
    return this.getCachedData('current_attendance', async () => {
      try {
        const today = new Date().toISOString().split('T')[0];
        
        const attendanceSummary = await Attendance.findAll({
          attributes: [
            'status',
            [require('sequelize').fn('COUNT', require('sequelize').col('id')), 'count']
          ],
          where: {
            date: today
          },
          group: ['status'],
          raw: true
        });

        return attendanceSummary.reduce((acc, item) => {
          acc[item.status] = parseInt(item.count);
          return acc;
        }, {});
      } catch (error) {
        console.error('Error fetching attendance:', error);
        return {};
      }
    });
  }

  // Get recent leave requests
  async getRecentLeaveRequests() {
    return this.getCachedData('recent_leaves', async () => {
      try {
        console.log('=== Fetching Leave Requests ===');
        
        const recentLeaves = await LeaveRequest.findAll({
          include: [{
            model: User,
            as: 'user', // Specify the alias for the employee who requested leave
            attributes: ['name', 'email'],
            where: { is_active: true },
            required: false
          }],
          order: [['created_at', 'DESC']],
          limit: 20, // Increased limit to get more data
          raw: false
        });

        console.log('Raw leave requests from DB:', recentLeaves.length);

        const formattedLeaves = recentLeaves.map(leave => ({
          employeeName: leave.user ? leave.user.name : 'Unknown',
          type: leave.type,
          status: leave.status,
          startDate: leave.start_date,
          endDate: leave.end_date,
          reason: leave.reason,
          daysCount: leave.days_count,
          createdAt: leave.created_at
        }));

        console.log('Formatted leave requests:', formattedLeaves);
        return formattedLeaves;
      } catch (error) {
        console.error('Error fetching leave requests:', error);
        return [];
      }
    });
  }

  // Generate context for AI
  async getAIContext() {
    try {
      console.log('=== Fetching AI Context ===');
      
      const [overview, attendance, leaves] = await Promise.all([
        this.getCompanyOverview(),
        this.getCurrentAttendance(),
        this.getRecentLeaveRequests()
      ]);

      console.log('Company Overview:', overview);
      console.log('Attendance:', attendance);
      console.log('Leave Requests:', leaves);

      return {
        companyOverview: overview,
        currentAttendance: attendance,
        recentLeaves: leaves,
        lastUpdated: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error getting AI context:', error);
      return {
        companyOverview: { totalEmployees: 0, activeEmployees: 0, totalDepartments: 0 },
        currentAttendance: {},
        recentLeaves: [],
        lastUpdated: new Date().toISOString()
      };
    }
  }

  // Clear cache
  clearCache() {
    this.cache.clear();
  }
}

module.exports = new AIMemorySystem();
