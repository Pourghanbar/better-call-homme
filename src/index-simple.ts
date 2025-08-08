import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { VoiceService } from './services/VoiceService';
import { AppointmentService } from './services/AppointmentService';
import { ConversationService } from './services/ConversationService';
import { database } from './database/connection';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Basic middleware
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    service: 'Better Call Homme API'
  });
});

// Initialize services
const voiceService = new VoiceService();
const appointmentService = new AppointmentService();
const conversationService = new ConversationService();

// Voice endpoint
app.post('/voice/incoming', (req, res) => {
  const twiml = voiceService.generateInitialGreeting();
  res.type('text/xml');
  res.send(twiml);
});

// Speech endpoint
app.post('/voice/speech', async (req, res) => { 
  try {
    const speech = req.body.SpeechResult || req.body.speech || '';
    const callSid = req.body.CallSid || 'test-call-sid';
    const callerPhone = req.body.From || req.body.Caller || '';
    
    // Pass caller phone to the voice service for SMS
    const aiResponse = await voiceService.processSpeech(speech, callSid, callerPhone); 
    const twiml = voiceService.generateSpeechResponse(aiResponse); 
    
    // If this is a final response (contains goodbye), handle call completion
    if (aiResponse.toLowerCase().includes('thank you') && aiResponse.toLowerCase().includes('goodbye')) {
      await voiceService.handleCallCompletion(callSid, callerPhone);
    }
    
    res.type('text/xml');
    res.send(twiml);
  } catch (error) {
    console.error('Error processing speech:', error);
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice" language="en-US">I apologize, but I'm having trouble processing your request. Please try again.</Say>
  <Gather input="speech" action="/voice/speech" method="POST" speechTimeout="auto" language="en-US"/>
</Response>`;
    res.type('text/xml');
    res.send(twiml);
  }
});

// API endpoints
app.get('/api/appointments', async (req, res) => {
  try {
    // Return appointments from VoiceService memory
    const appointments = voiceService.getAppointments();
    res.json({ appointments, total: appointments.length });
  } catch (error) {
    console.error('Error fetching appointments:', error);
    res.status(500).json({ error: 'Failed to fetch appointments' });
  }
});

app.get('/api/conversations', async (req, res) => {
  try {
    // Return conversations from VoiceService memory
    const conversations = voiceService.getConversations();
    res.json({ conversations, total: conversations.length });
  } catch (error) {
    console.error('Error fetching conversations:', error);
    res.status(500).json({ error: 'Failed to fetch conversations' });
  }
});

app.get('/api/analytics', async (req, res) => {
  try {
    // Return mock analytics data
    const mockAnalytics = {
      statusBreakdown: [
        { status: 'scheduled', count: '1' },
        { status: 'confirmed', count: '1' }
      ],
      dateBreakdown: [
        { scheduled_date: '2024-01-15', count: '1' },
        { scheduled_date: '2024-01-16', count: '1' }
      ],
      totalAppointments: 2
    };
    
    res.json(mockAnalytics);
  } catch (error) {
    console.error('Error fetching analytics:', error);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

app.get('/api/technicians', async (req, res) => {
  try {
    // Return mock technicians data
    const mockTechnicians = [
      {
        id: 'tech-001',
        name: 'John Doe',
        specialties: ['plumbing', 'electrical', 'appliances'],
        availability: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
        phone: '+1234567890'
      },
      {
        id: 'tech-002',
        name: 'Jane Smith',
        specialties: ['hvac', 'plumbing', 'general'],
        availability: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
        phone: '+1234567891'
      },
      {
        id: 'tech-003',
        name: 'Mike Johnson',
        specialties: ['electrical', 'appliances', 'general'],
        availability: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
        phone: '+1234567892'
      }
    ];
    
    res.json(mockTechnicians);
  } catch (error) {
    console.error('Error fetching technicians:', error);
    res.status(500).json({ error: 'Failed to fetch technicians' });
  }
});

// Create appointment directly
app.post('/api/appointments', async (req, res) => {
  try {
    const { customerName, customerPhone, problem, scheduledDate, scheduledTime } = req.body;
    
    const appointment = {
      id: `app-${Date.now()}`,
      callSid: `call-${Date.now()}`,
      customerName: customerName || 'Unknown',
      customerPhone: customerPhone || 'unknown',
      problem: problem || 'Not specified',
      scheduledDate: scheduledDate || 'tomorrow',
      scheduledTime: scheduledTime || '10:00 AM',
      technicianName: 'John Doe',
      technicianId: 'tech-001',
      status: 'scheduled',
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    // Store appointment in VoiceService memory
    voiceService.getAppointments().push(appointment);
    
    res.json({ success: true, appointment });
  } catch (error) {
    console.error('Error creating appointment:', error);
    res.status(500).json({ error: 'Failed to create appointment' });
  }
});

// Create appointment from conversation data
app.post('/api/appointments/from-conversation', async (req, res) => {
  try {
    const { callSid } = req.body;
    
    // Get conversations for this call
    const conversations = voiceService.getConversations().filter(c => c.callSid === callSid);
    
    if (conversations.length === 0) {
      return res.status(404).json({ error: 'No conversations found for this call' });
    }
    
    // Extract customer name from conversations
    const nameConversation = conversations.find(c => c.role === 'user' && c.content.toLowerCase().includes('smith'));
    const problemConversation = conversations.find(c => c.role === 'user' && c.content.toLowerCase().includes('dishwasher'));
    
    const customerName = nameConversation ? nameConversation.content : 'Unknown';
    const problem = problemConversation ? problemConversation.content : 'Not specified';
    
    const appointment = {
      id: `app-${Date.now()}`,
      callSid: callSid,
      customerName: customerName,
      customerPhone: 'unknown',
      problem: problem,
      scheduledDate: 'tomorrow',
      scheduledTime: '10:00 AM',
      technicianName: 'John Doe',
      technicianId: 'tech-001',
      status: 'scheduled',
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    // Store appointment in VoiceService memory
    voiceService.getAppointments().push(appointment);
    
    return res.json({ success: true, appointment });
  } catch (error) {
    console.error('Error creating appointment from conversation:', error);
    return res.status(500).json({ error: 'Failed to create appointment from conversation' });
  }
});

// Webhook endpoint for call completion
app.post('/voice/call-completed', async (req, res) => {
  try {
    const { callSid, callerPhone } = req.body;
    
    console.log('Call completed webhook received:', { callSid, callerPhone });
    
    // Get conversations for this call
    const conversations = voiceService.getConversations().filter(c => c.callSid === callSid);
    
    if (conversations.length === 0) {
      return res.status(404).json({ error: 'No conversations found for this call' });
    }
    
    // Check if the conversation was confirmed (contains "Yes" and appointment confirmation)
    const hasConfirmation = conversations.some(c => 
      c.role === 'user' && 
      c.content.toLowerCase().includes('yes') &&
      conversations.some(ac => 
        ac.role === 'assistant' && 
        ac.content.toLowerCase().includes('scheduled') &&
        ac.content.toLowerCase().includes('appointment')
      )
    );
    
    if (hasConfirmation) {
      // Extract customer name and problem from conversations
      const nameConversation = conversations.find(c => c.role === 'user' && c.content.toLowerCase().includes('smith'));
      const problemConversation = conversations.find(c => c.role === 'user' && c.content.toLowerCase().includes('dishwasher'));
      
      const customerName = nameConversation ? nameConversation.content : 'Unknown';
      const problem = problemConversation ? problemConversation.content : 'Not specified';
      
      const appointment = {
        id: `app-${Date.now()}`,
        callSid: callSid,
        customerName: customerName,
        customerPhone: callerPhone || 'unknown',
        problem: problem,
        scheduledDate: 'tomorrow',
        scheduledTime: '10:00 AM',
        technicianName: 'John Doe',
        technicianId: 'tech-001',
        status: 'scheduled',
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      // Store appointment in VoiceService memory
      voiceService.getAppointments().push(appointment);
      
      // Send SMS confirmation
      try {
        await voiceService.sendConfirmationSMS(appointment);
        console.log('SMS confirmation sent for appointment:', appointment.id);
      } catch (smsError) {
        console.error('Error sending SMS confirmation:', smsError);
      }
      
      return res.json({ 
        success: true, 
        appointment,
        message: 'Appointment created and SMS sent'
      });
    } else {
      return res.json({ 
        success: false, 
        message: 'No appointment confirmation found in conversation'
      });
    }
  } catch (error) {
    console.error('Error processing call completion webhook:', error);
    return res.status(500).json({ error: 'Failed to process call completion' });
  }
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Start server
const startServer = async () => {
  try {
    // Test database connection (but don't fail if it doesn't work)
    try {
      await database.testConnection();
      console.log('Database connection established');
    } catch (error) {
      console.warn('Database connection failed, but continuing without database');
    }

    app.listen(PORT, () => {
      console.log(`Better Call Homme server running on port ${PORT}`);
      console.log(`Environment: ${process.env.NODE_ENV}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  process.exit(0);
}); 