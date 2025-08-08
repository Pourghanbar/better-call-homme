import twilio from 'twilio';
import OpenAI from 'openai';
import { database } from '../database/connection';
import { logger } from '../utils/logger';
import { AppointmentService } from './AppointmentService';

// Simple in-memory database
const conversationDB = {
  states: new Map<string, ConversationState>(),
  conversations: new Map<string, any[]>(),
  appointments: [] as any[]
};

interface ConversationState {
  callSid: string;
  step: 'greeting' | 'name' | 'name_confirmation' | 'name_spelling' | 'problem' | 'scheduling' | 'confirmation' | 'final';
  customerName?: string;
  customerPhone?: string;
  problem?: string;
  preferredDate?: string;
  preferredTime?: string;
  confirmed?: boolean;
}

export class VoiceService {
  private twilioClient: twilio.Twilio;
  private openai: OpenAI;
  private appointmentService: AppointmentService;

  constructor() {
    // Only initialize Twilio if credentials are valid
    if (process.env.TWILIO_ACCOUNT_SID && 
        process.env.TWILIO_ACCOUNT_SID.startsWith('AC') && 
        process.env.TWILIO_AUTH_TOKEN) {
      this.twilioClient = twilio(
        process.env.TWILIO_ACCOUNT_SID,
        process.env.TWILIO_AUTH_TOKEN
      );
    } else {
      logger.warn('Twilio credentials not configured, voice features will be limited');
      // Create a mock twilio client for basic functionality
      this.twilioClient = {} as twilio.Twilio;
    }
    
    // Only initialize OpenAI if API key is valid
    if (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'test') {
      this.openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY
      });
    } else {
      logger.warn('OpenAI API key not configured, AI features will be limited');
      // Create a mock OpenAI client
      this.openai = {} as OpenAI;
    }
    
    this.appointmentService = new AppointmentService();
  }

  generateInitialGreeting(): string {
    const twiml = new twilio.twiml.VoiceResponse();
    
    twiml.say({
      voice: 'alice',
      language: 'en-US'
    }, 'Hello! Welcome to Better Call Homme, your trusted home service company. I\'m here to help you schedule a home service appointment. First, could you please tell me your name?');
    
    twiml.gather({
      input: ['speech'],
      action: '/voice/speech',
      method: 'POST',
      speechTimeout: 'auto',
      language: 'en-US'
    });
    
    return twiml.toString();
  }

  async processSpeech(speech: string, callSid: string, callerPhone?: string): Promise<string> {
    try {
      // Get or create conversation state
      let state = conversationDB.states.get(callSid);
      if (!state) {
        state = { callSid, step: 'greeting' };
        conversationDB.states.set(callSid, state);
      }

      // Store caller phone number in state
      if (callerPhone && !state.customerPhone) {
        state.customerPhone = callerPhone;
      }

      // Store conversation in database
      await this.storeConversation(callSid, 'user', speech);

      // Process with OpenAI
      const aiResponse = await this.getAIResponse(speech, state);
      
      // Store AI response
      await this.storeConversation(callSid, 'assistant', aiResponse);

      // Update conversation state based on AI response
      this.updateConversationState(callSid, speech, aiResponse);

      // Log the current state for debugging
      logger.info('Conversation state updated', { 
        callSid, 
        step: state.step, 
        customerName: state.customerName,
        customerPhone: state.customerPhone,
        problem: state.problem,
        confirmed: state.confirmed 
      });

      return aiResponse;
    } catch (error) {
      logger.error('Error processing speech:', error);
      return 'I apologize, but I\'m having trouble processing your request. Please try again or call back later.';
    }
  }

  private async getAIResponse(userInput: string, state: ConversationState): Promise<string> {
    // If OpenAI is not configured, return a simple response
    if (!this.openai || !process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === 'test') {
      return this.getSimpleResponse(userInput, state);
    }

    const systemPrompt = `You are an AI assistant for Better Call Homme, a home service company. 
    Your role is to help customers schedule appointments for home repairs and maintenance.
    
    Current conversation state: ${state.step}
    Customer name: ${state.customerName || 'Not provided'}
    Problem: ${state.problem || 'Not specified'}
    Preferred date: ${state.preferredDate || 'Not specified'}
    Preferred time: ${state.preferredTime || 'Not specified'}
    
    Follow this conversation flow:
    1. If step is 'greeting': Ask for their name
    2. If step is 'name': Extract name and confirm it with the customer
    3. If step is 'name_confirmation': If they say "yes" or "correct", proceed to ask about their problem. If they say "no" or "incorrect", ask them to spell their name
    4. If step is 'name_spelling': Extract the spelled name and ask about their problem
    5. If step is 'problem': Extract problem and suggest tomorrow at 10 AM
    6. If step is 'scheduling': Ask if the time works (Yes/No)
    7. If step is 'confirmation': Handle Yes/No response
    8. If step is 'final': Provide final confirmation
    
    Be friendly, professional, and helpful. Keep responses concise for voice interaction.
    Always suggest tomorrow at 10 AM as the only available time.
    Use the caller's phone number automatically - don't ask for it.`;

    try {
      const response = await this.openai.chat.completions.create({
        model: process.env.OPENAI_MODEL || 'gpt-4',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userInput }
        ],
        max_tokens: 150,
        temperature: 0.7
      });

      return response.choices[0]?.message?.content || 'I apologize, but I didn\'t understand that. Could you please repeat?';
    } catch (error) {
      logger.error('OpenAI API error:', error);
      return 'I apologize, but I\'m having trouble processing your request. Please try again.';
    }
  }

  private getSimpleResponse(userInput: string, state: ConversationState): string {
    // Simple response logic when OpenAI is not available
    const lowerInput = userInput.toLowerCase();
    
    if (state.step === 'greeting') {
      // Extract name from input
      state.customerName = userInput.trim();
      state.step = 'name_confirmation';
      return `I heard ${state.customerName}. Is that correct? Please say Yes or No.`;
    }
    
    if (state.step === 'name_confirmation') {
      if (lowerInput.includes('yes') || lowerInput.includes('correct') || lowerInput.includes('right')) {
        state.step = 'problem';
        return `Great! Now, what problem are you experiencing with your home that needs service?`;
      } else if (lowerInput.includes('no') || lowerInput.includes('incorrect') || lowerInput.includes('wrong')) {
        state.step = 'name_spelling';
        return `I apologize. Could you please spell your name for me?`;
      }
      return `Please say Yes or No. Is ${state.customerName} correct?`;
    }
    
    if (state.step === 'name_spelling') {
      // Extract spelled name
      state.customerName = userInput.trim();
      state.step = 'problem';
      return `Thank you ${state.customerName}. Now, what problem are you experiencing with your home that needs service?`;
    }
    
    if (state.step === 'problem') {
      // Extract problem
      state.problem = userInput;
      state.step = 'scheduling';
      state.preferredDate = 'tomorrow';
      state.preferredTime = '10:00 AM';
      return `I understand you have a problem with ${userInput}. I can schedule a technician for tomorrow morning at 10 AM. Does this time work for you? Please respond with Yes or No.`;
    }
    
    if (state.step === 'scheduling') {
      if (lowerInput.includes('yes') || lowerInput.includes('okay') || lowerInput.includes('sure')) {
        state.step = 'confirmation';
        state.confirmed = true;
        
        // Create appointment immediately
        const appointment = {
          id: `app-${Date.now()}`,
          callSid: state.callSid,
          customerName: state.customerName,
          customerPhone: state.customerPhone || 'unknown',
          problem: state.problem,
          scheduledDate: state.preferredDate || 'tomorrow',
          scheduledTime: state.preferredTime || '10:00 AM',
          technicianName: 'John Doe',
          technicianId: 'tech-001',
          status: 'scheduled',
          createdAt: new Date(),
          updatedAt: new Date()
        };
        
        // Store appointment in memory
        conversationDB.appointments.push(appointment);
        
        // Log the appointment creation
        logger.info('Appointment created during conversation', { 
          appointmentId: appointment.id, 
          customerName: appointment.customerName,
          problem: appointment.problem 
        });
        
        // Send SMS confirmation immediately
        this.sendConfirmationSMS(appointment).catch(error => {
          logger.error('Error sending SMS confirmation:', error);
        });
        
        return `Perfect! I've scheduled your appointment for tomorrow morning at 10 AM. You'll receive a confirmation text shortly. Thank you for choosing Better Call Homme!`;
      } else if (lowerInput.includes('no')) {
        state.step = 'final';
        state.confirmed = false;
        return `I understand. Unfortunately, tomorrow at 10 AM is the only available time we have. Thank you for calling Better Call Homme. Have a great day!`;
      }
      return `Please respond with Yes or No. Does tomorrow at 10 AM work for you?`;
    }
    
    if (state.step === 'confirmation') {
      state.step = 'final';
      return `Your appointment has been confirmed for tomorrow morning at 10 AM. You'll receive a confirmation text shortly. Thank you for choosing Better Call Homme!`;
    }
    
    return 'Thank you for calling Better Call Homme. Have a great day!';
  }

  private updateConversationState(callSid: string, userInput: string, aiResponse: string): void {
    const state = conversationDB.states.get(callSid);
    if (!state) return;

    // The state is already updated in getSimpleResponse method
    // This method is mainly for OpenAI responses
    const input = userInput.toLowerCase();
    
    if (state.step === 'greeting') {
      // Extract name from input
      state.customerName = userInput.trim();
      state.step = 'name_confirmation';
    } else if (state.step === 'name_confirmation') {
      if (input.includes('yes') || input.includes('correct') || input.includes('right')) {
        state.step = 'problem';
      } else if (input.includes('no') || input.includes('incorrect') || input.includes('wrong')) {
        state.step = 'name_spelling';
      }
    } else if (state.step === 'name_spelling') {
      // Extract spelled name
      state.customerName = userInput.trim();
      state.step = 'problem';
    } else if (state.step === 'problem') {
      // Extract problem
      state.problem = userInput;
      state.step = 'scheduling';
      state.preferredDate = 'tomorrow';
      state.preferredTime = '10:00 AM';
    } else if (state.step === 'scheduling') {
      if (input.includes('yes') || input.includes('okay') || input.includes('sure')) {
        state.step = 'confirmation';
        state.confirmed = true;
      } else if (input.includes('no')) {
        state.step = 'final';
        state.confirmed = false;
      }
    } else if (state.step === 'confirmation') {
      state.step = 'final';
    }
  }

  generateSpeechResponse(aiResponse: string): string {
    const twiml = new twilio.twiml.VoiceResponse();
    
    twiml.say({
      voice: 'alice',
      language: 'en-US'
    }, aiResponse);
    
    // If this is a final step or confirmation, end the call
    if (aiResponse.toLowerCase().includes('confirmation') || 
        aiResponse.toLowerCase().includes('thank you') ||
        aiResponse.toLowerCase().includes('have a great day') ||
        aiResponse.toLowerCase().includes('goodbye')) {
      twiml.say('Thank you for choosing Better Call Homme. Goodbye!');
      twiml.hangup();
    } else {
      // Continue gathering input
      twiml.gather({
        input: ['speech'],
        action: '/voice/speech',
        method: 'POST',
        speechTimeout: 'auto',
        language: 'en-US'
      });
    }
    
    return twiml.toString();
  }

  private async storeConversation(callSid: string, role: 'user' | 'assistant', content: string): Promise<void> {
    try {
      // Store in memory for now
      if (!conversationDB.conversations.has(callSid)) {
        conversationDB.conversations.set(callSid, []);
      }
      
      conversationDB.conversations.get(callSid)!.push({
        id: Date.now(),
        callSid,
        role,
        content,
        timestamp: new Date()
      });
      
      // Try to store in database if available
      try {
        await database.query(
          'INSERT INTO conversations (call_sid, role, content, timestamp) VALUES ($1, $2, $3, NOW())',
          [callSid, role, content]
        );
      } catch (dbError) {
        logger.warn('Database not available, storing in memory only:', dbError);
      }
    } catch (error) {
      logger.error('Error storing conversation:', error);
    }
  }

  async handleCallCompletion(callSid: string, callerPhone?: string): Promise<void> {
    try {
      const state = conversationDB.states.get(callSid);
      if (state && state.confirmed && state.customerName && state.problem) {
        // Use caller's phone number if available, otherwise use stored phone
        const phoneNumber = callerPhone || state.customerPhone || 'unknown';
        
        // Create appointment in memory
        const appointment = {
          id: `app-${Date.now()}`,
          callSid,
          customerName: state.customerName,
          customerPhone: phoneNumber,
          problem: state.problem,
          scheduledDate: state.preferredDate || 'tomorrow',
          scheduledTime: state.preferredTime || '10:00 AM',
          technicianName: 'John Doe',
          technicianId: 'tech-001',
          status: 'scheduled',
          createdAt: new Date(),
          updatedAt: new Date()
        };
        
        // Store appointment in memory
        conversationDB.appointments.push(appointment);
        
        // Try to store in database if available
        try {
          await database.query(
            `INSERT INTO appointments (
              id, call_sid, customer_name, customer_phone, problem, scheduled_date, scheduled_time, 
              technician_name, technician_id, status, created_at, updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
            [
              appointment.id,
              appointment.callSid,
              appointment.customerName,
              appointment.customerPhone,
              appointment.problem,
              appointment.scheduledDate,
              appointment.scheduledTime,
              appointment.technicianName,
              appointment.technicianId,
              appointment.status,
              appointment.createdAt,
              appointment.updatedAt
            ]
          );
        } catch (dbError) {
          logger.warn('Database not available, storing appointment in memory only:', dbError);
        }

        // Send confirmation SMS
        await this.sendConfirmationSMS(appointment);
        
        // Store final conversation entry
        await this.storeConversation(callSid, 'assistant', `Appointment scheduled: ${appointment.id}`);
        
        logger.info('Call completed and appointment scheduled', { callSid, appointmentId: appointment.id });
      } else {
        logger.info('Call completed without appointment', { callSid });
      }

      // Clean up conversation state
      conversationDB.states.delete(callSid);
    } catch (error) {
      logger.error('Error handling call completion:', error);
    }
  }

    async sendConfirmationSMS(appointment: any): Promise<void> {
    // Skip SMS if Twilio is not configured
    if (!this.twilioClient || !process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_ACCOUNT_SID.startsWith('AC')) {
      logger.warn('Twilio not configured, skipping SMS confirmation');
      return;
    }
    
    try {
      const messageBody = `Hi ${appointment.customerName}! Your Better Call Homme appointment has been confirmed for ${appointment.scheduledDate} at ${appointment.scheduledTime}. Technician: ${appointment.technicianName}. Reference: ${appointment.id}. Thank you for choosing Better Call Homme!`;
      
      await this.twilioClient.messages.create({
        body: messageBody,
        from: process.env.TWILIO_PHONE_NUMBER,
        to: appointment.customerPhone
      });
      
      logger.info('Confirmation SMS sent', { appointmentId: appointment.id, customerName: appointment.customerName });
    } catch (error) {
      logger.error('Error sending confirmation SMS:', error);
    }
  }

  // Get appointments from memory
  getAppointments(): any[] {
    return conversationDB.appointments;
  }

  // Get conversations from memory
  getConversations(): any[] {
    const allConversations: any[] = [];
    conversationDB.conversations.forEach((conversation: any[], callSid: string) => {
      allConversations.push(...conversation);
    });
    return allConversations;
  }
} 