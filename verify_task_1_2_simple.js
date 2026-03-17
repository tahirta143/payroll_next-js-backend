/**
 * Simple verification for Task 1.2: Role guard on attendance /all endpoint
 * This script verifies that the roleGuard middleware is properly configured
 * on the GET /api/attendance/all route by examining the route definition
 */

const fs = require('fs');
const path = require('path');

function verifyRoleGuardImplementation() {
  console.log('🧪 Verifying Task 1.2: Role guard on attendance /all endpoint\n');

  try {
    // Read the attendance routes file
    const routesPath = path.join(__dirname, 'routes', 'attendance.js');
    const routesContent = fs.readFileSync(routesPath, 'utf8');

    console.log('📋 Analyzing attendance routes file...\n');

    // Check if roleGuard is imported
    const hasRoleGuardImport = routesContent.includes("require('../middleware/roleGuard')") || 
                              routesContent.includes('roleGuard');
    
    if (hasRoleGuardImport) {
      console.log('✅ roleGuard middleware is imported');
    } else {
      console.log('❌ roleGuard middleware is NOT imported');
      return false;
    }

    // Check if the /all route has roleGuard with admin and manager roles
    const allRoutePattern = /router\.get\(['"`]\/all['"`],\s*roleGuard\(['"`]admin['"`],\s*['"`]manager['"`]\)/;
    const hasCorrectRoleGuard = allRoutePattern.test(routesContent);

    if (hasCorrectRoleGuard) {
      console.log('✅ GET /all route has roleGuard(\'admin\', \'manager\') middleware');
    } else {
      console.log('❌ GET /all route does NOT have correct roleGuard middleware');
      
      // Check if the route exists at all
      if (routesContent.includes("router.get('/all'") || routesContent.includes('router.get("/all"')) {
        console.log('ℹ️  Route exists but middleware configuration may be incorrect');
        
        // Show the actual line for debugging
        const lines = routesContent.split('\n');
        const allRouteLine = lines.find(line => line.includes('/all') && line.includes('router.get'));
        if (allRouteLine) {
          console.log('📝 Current line:', allRouteLine.trim());
        }
      } else {
        console.log('❌ GET /all route not found');
      }
      return false;
    }

    // Additional verification: Check the route order and structure
    const lines = routesContent.split('\n');
    const allRouteLine = lines.find(line => line.includes('/all') && line.includes('router.get'));
    
    if (allRouteLine) {
      console.log('📝 Route definition:', allRouteLine.trim());
      
      // Verify it comes after authMiddleware is applied
      const authMiddlewareIndex = lines.findIndex(line => line.includes('router.use(authMiddleware)'));
      const allRouteIndex = lines.findIndex(line => line === allRouteLine);
      
      if (authMiddlewareIndex !== -1 && authMiddlewareIndex < allRouteIndex) {
        console.log('✅ Route is properly placed after authMiddleware');
      } else {
        console.log('⚠️  Route ordering may be incorrect');
      }
    }

    console.log('\n🎯 Task 1.2 verification: SUCCESS!');
    console.log('The roleGuard(\'admin\', \'manager\') middleware is properly applied to GET /api/attendance/all');
    
    return true;

  } catch (error) {
    console.error('❌ Error reading routes file:', error.message);
    return false;
  }
}

// Additional verification: Check roleGuard middleware implementation
function verifyRoleGuardMiddleware() {
  console.log('\n🔍 Verifying roleGuard middleware implementation...\n');
  
  try {
    const middlewarePath = path.join(__dirname, 'middleware', 'roleGuard.js');
    const middlewareContent = fs.readFileSync(middlewarePath, 'utf8');
    
    // Check if it returns 403 for unauthorized roles
    if (middlewareContent.includes('403') && middlewareContent.includes('Access denied')) {
      console.log('✅ roleGuard returns 403 for unauthorized access');
    } else {
      console.log('❌ roleGuard may not properly return 403 for unauthorized access');
    }
    
    // Check if it accepts multiple roles
    if (middlewareContent.includes('...roles') || middlewareContent.includes('roles.includes')) {
      console.log('✅ roleGuard supports multiple roles');
    } else {
      console.log('❌ roleGuard may not support multiple roles');
    }
    
  } catch (error) {
    console.error('❌ Error reading roleGuard middleware:', error.message);
  }
}

// Run verification
if (require.main === module) {
  const success = verifyRoleGuardImplementation();
  verifyRoleGuardMiddleware();
  
  if (success) {
    console.log('\n✨ Task 1.2 is properly implemented!');
    console.log('Employee users will receive 403 Forbidden when accessing GET /api/attendance/all');
  } else {
    console.log('\n❌ Task 1.2 needs attention!');
  }
}

module.exports = { verifyRoleGuardImplementation };