const express = require('express');
const { getAIResponse, generatePayrollInsights } = require('../services/groqService');
const authMiddleware = require('../middleware/authMiddleware');
const router = express.Router();

// Chat endpoint for AI assistant
router.post('/chat', authMiddleware, async (req, res) => {
  try {
    const { message } = req.body;
    
    if (!message) {
      return res.status(400).json({ 
        success: false, 
        message: 'Message is required' 
      });
    }

    const aiResponse = await getAIResponse(message);
    
    res.json({
      success: true,
      response: aiResponse
    });
  } catch (error) {
    console.error('AI Chat Error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to get AI response' 
    });
  }
});

// Payroll insights endpoint
router.post('/insights', authMiddleware, async (req, res) => {
  try {
    const { payrollData } = req.body;
    
    if (!payrollData) {
      return res.status(400).json({ 
        success: false, 
        message: 'Payroll data is required' 
      });
    }

    const insights = await generatePayrollInsights(payrollData);
    
    res.json({
      success: true,
      insights: insights
    });
  } catch (error) {
    console.error('AI Insights Error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to generate payroll insights' 
    });
  }
});

module.exports = router;
