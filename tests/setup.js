// Test setup file

// Mock database connection for tests
jest.mock('../config/db', () => ({
  sequelize: {
    authenticate: jest.fn().mockResolvedValue(),
    sync: jest.fn().mockResolvedValue(),
    close: jest.fn().mockResolvedValue()
  }
}));

// Mock JWT config
jest.mock('../config/jwt', () => ({
  secret: 'test-secret-key-for-testing'
}));

// Global test timeout
jest.setTimeout(10000);