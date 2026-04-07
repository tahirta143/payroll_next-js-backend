const express = require('express');
const aiMemory = require('../services/aiMemory');
const authMiddleware = require('../middleware/authMiddleware');
const router = express.Router();

// Debug endpoint to test memory system
router.get('/debug', authMiddleware, async (req, res) => {
  try {
    const context = await aiMemory.getAIContext();
    
    res.json({
      success: true,
      data: context,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Debug endpoint error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get debug data',
      error: error.message
    });
  }
});

// Clear cache endpoint
router.post('/clear-cache', authMiddleware, async (req, res) => {
  try {
    aiMemory.clearCache();
    
    res.json({
      success: true,
      message: 'Cache cleared successfully'
    });
  } catch (error) {
    console.error('Clear cache error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to clear cache'
    });
  }
});

module.exports = router;
