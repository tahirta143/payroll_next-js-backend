const Groq = require('groq-sdk');
const aiMemory = require('./aiMemory');

// Initialize Groq client
const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

// Enhanced system prompt with project context
const getSystemPrompt = (context) => {
  let basePrompt = `You are an AI assistant for the AttendanceIQ Payroll Management System. You have access to real-time company data and must use it when answering questions.

CURRENT COMPANY DATA (use this data in your responses):
${context ? `
- Total Employees: ${context.companyOverview.totalEmployees}
- Active Employees: ${context.companyOverview.activeEmployees}
- Total Departments: ${context.companyOverview.totalDepartments}
- Employees by Role: ${JSON.stringify(context.companyOverview.employeesByRole, null, 2)}
- Departments: ${JSON.stringify(context.companyOverview.departments, null, 2)}
- Today's Attendance: ${JSON.stringify(context.currentAttendance, null, 2)}
- Recent Leave Requests: ${context.recentLeaves.length} requests found:
${context.recentLeaves.length > 0 ? context.recentLeaves.map(leave => 
  `- ${leave.employeeName}: ${leave.type} leave (${leave.status}) from ${leave.startDate} to ${leave.endDate} - ${leave.reason}`
).join('\n') : 'No recent leave requests found'}
- Data Last Updated: ${context.lastUpdated}
` : 'No current data available'}

RESPONSE GUIDELINES:
1. When users ask about leave requests, ALWAYS use the "Recent Leave Requests" data shown above
2. If there are leave requests listed, show them to the user
3. If there are no leave requests, say "I don't see any recent leave requests in the system"
4. Be conversational but always use the real data provided
5. For greetings like "hi", respond naturally and ask how you can help

EXAMPLES:
- User: "hi" -> "Hello! I'm your AI payroll assistant. How can I help you today?"
- User: "how many employees?" -> "We currently have ${context.companyOverview.totalEmployees} employees."
- User: "leaves today" -> "I found ${context.recentLeaves.length} recent leave requests: [list the requests from the data above]"
- User: "who's on leave" -> "Based on recent leave requests, these employees are on leave: [list from data above]"

CRITICAL: You MUST use the actual leave request data provided above. Do NOT say you don't see leave requests if they are listed in the data.`;

  return basePrompt;
};

// Chat completion function with memory
async function getAIResponse(userMessage) {
  try {
    // Check if API key is set
    if (!process.env.GROQ_API_KEY) {
      throw new Error('Groq API key is not configured. Please set GROQ_API_KEY in your environment variables.');
    }

    // Get current context from memory system
    const context = await aiMemory.getAIContext();

    // Try multiple models in order of preference
    const models = [
      "llama-3.1-70b-versatile",
      "llama-3.1-8b-instant", 
      "mixtral-8x7b-32768",
      "gemma2-9b-it"
    ];

    let lastError;
    let completion;

    for (const model of models) {
      try {
        completion = await groq.chat.completions.create({
          messages: [
            {
              role: "system",
              content: getSystemPrompt(context)
            },
            {
              role: "user",
              content: userMessage
            }
          ],
          model: model,
          temperature: 0.7,
          max_tokens: 1000,
        });
        
        // If successful, break out of the loop
        console.log(`Successfully used model: ${model}`);
        break;
      } catch (modelError) {
        console.log(`Model ${model} failed:`, modelError.message);
        lastError = modelError;
        
        // If this is the last model, throw the error
        if (model === models[models.length - 1]) {
          throw lastError;
        }
        
        // Otherwise, try the next model
        continue;
      }
    }

    return completion.choices[0]?.message?.content || "I apologize, but I couldn't process your request.";
  } catch (error) {
    console.error('Groq API Error:', error);
    
    // Provide specific error messages based on the error type
    if (error.message.includes('API key')) {
      throw new Error('AI service is not properly configured. Please contact your administrator.');
    } else if (error.message.includes('401') || error.message.includes('authentication')) {
      throw new Error('AI service authentication failed. Please check the API key configuration.');
    } else if (error.message.includes('429')) {
      throw new Error('AI service is currently rate limited. Please try again in a moment.');
    } else if (error.message.includes('timeout')) {
      throw new Error('AI service request timed out. Please try again.');
    } else if (error.message.includes('decommissioned') || error.message.includes('model')) {
      throw new Error('AI service is temporarily unavailable due to model updates. Please try again later.');
    } else {
      throw new Error('Failed to get AI response. Please try again later.');
    }
  }
}

// Generate payroll insights with real data
async function generatePayrollInsights(payrollData) {
  try {
    // Check if API key is set
    if (!process.env.GROQ_API_KEY) {
      throw new Error('Groq API key is not configured. Please set GROQ_API_KEY in your environment variables.');
    }

    // Get current context from memory system
    const context = await aiMemory.getAIContext();

    const insightsPrompt = `Analyze the following payroll data and provide insights:
    
    PROVIDED PAYROLL DATA:
    ${JSON.stringify(payrollData, null, 2)}
    
    CURRENT COMPANY CONTEXT:
    - Total Employees: ${context.companyOverview.totalEmployees}
    - Active Employees: ${context.companyOverview.activeEmployees}
    - Departments: ${JSON.stringify(context.companyOverview.departments, null, 2)}
    - Today's Attendance: ${JSON.stringify(context.currentAttendance, null, 2)}
    - Recent Leave Requests: ${context.recentLeaves.length} pending/recent requests
    
    Please provide:
    1. Key trends and patterns based on both provided data and current company context
    2. Potential issues or concerns with specific recommendations
    3. Optimization opportunities for this specific organization
    4. Compliance considerations relevant to the current setup
    5. Actionable insights using the real company data
    
    Keep your analysis specific to this organization's current state and provide actionable recommendations.`;

    // Try multiple models in order of preference
    const models = [
      "llama-3.1-70b-versatile",
      "llama-3.1-8b-instant",
      "mixtral-8x7b-32768",
      "gemma2-9b-it"
    ];

    let lastError;
    let completion;

    for (const model of models) {
      try {
        completion = await groq.chat.completions.create({
          messages: [
            {
              role: "system",
              content: "You are a payroll data analyst specializing in identifying trends, issues, and optimization opportunities in payroll data. Use the provided company context to give specific, actionable insights."
            },
            {
              role: "user",
              content: insightsPrompt
            }
          ],
          model: model,
          temperature: 0.3,
          max_tokens: 1500,
        });
        
        // If successful, break out of the loop
        console.log(`Successfully used model for insights: ${model}`);
        break;
      } catch (modelError) {
        console.log(`Model ${model} failed for insights:`, modelError.message);
        lastError = modelError;
        
        // If this is the last model, throw the error
        if (model === models[models.length - 1]) {
          throw lastError;
        }
        
        // Otherwise, try the next model
        continue;
      }
    }

    return completion.choices[0]?.message?.content || "Unable to generate insights at this time.";
  } catch (error) {
    console.error('Groq Insights Error:', error);
    
    // Provide specific error messages based on the error type
    if (error.message.includes('API key')) {
      throw new Error('AI service is not properly configured. Please contact your administrator.');
    } else if (error.message.includes('401') || error.message.includes('authentication')) {
      throw new Error('AI service authentication failed. Please check the API key configuration.');
    } else if (error.message.includes('429')) {
      throw new Error('AI service is currently rate limited. Please try again in a moment.');
    } else if (error.message.includes('timeout')) {
      throw new Error('AI service request timed out. Please try again.');
    } else if (error.message.includes('decommissioned') || error.message.includes('model')) {
      throw new Error('AI service is temporarily unavailable due to model updates. Please try again later.');
    } else {
      throw new Error('Failed to generate payroll insights. Please try again later.');
    }
  }
}

module.exports = {
  getAIResponse,
  generatePayrollInsights
};
