import { Router, Request, Response } from 'express';
import { VoiceService } from '../services/VoiceService';
import { AppointmentService } from '../services/AppointmentService';
import { logger } from '../utils/logger';

const router = Router();
const voiceService = new VoiceService();
const appointmentService = new AppointmentService();

// Twilio webhook for incoming calls
router.post('/incoming', async (req: Request, res: Response) => {
  try {
    const { CallSid, From, To } = req.body;
    
    logger.info('Incoming call received', {
      callSid: CallSid,
      from: From,
      to: To
    });

    // Generate TwiML for initial greeting
    const twiml = voiceService.generateInitialGreeting();
    
    res.type('text/xml');
    res.send(twiml);
  } catch (error) {
    logger.error('Error handling incoming call:', error);
    res.status(500).send('Error processing call');
  }
});

// Handle user speech input
router.post('/speech', async (req: Request, res: Response) => {
  try {
    const { CallSid, SpeechResult, Confidence } = req.body;
    
    logger.info('Speech received', {
      callSid: CallSid,
      speech: SpeechResult,
      confidence: Confidence
    });

    // Process speech with AI and get response
    const aiResponse = await voiceService.processSpeech(SpeechResult, CallSid);
    
    // Generate TwiML response
    const twiml = voiceService.generateSpeechResponse(aiResponse);
    
    res.type('text/xml');
    res.send(twiml);
  } catch (error) {
    logger.error('Error processing speech:', error);
    res.status(500).send('Error processing speech');
  }
});

// Handle call completion
router.post('/complete', async (req: Request, res: Response) => {
  try {
    const { CallSid } = req.body;
    
    logger.info('Call completed', { callSid: CallSid });
    
    // Process any final actions (send SMS confirmation, etc.)
    await voiceService.handleCallCompletion(CallSid);
    
    res.status(200).send('Call completed');
  } catch (error) {
    logger.error('Error handling call completion:', error);
    res.status(500).send('Error completing call');
  }
});

// Handle appointment scheduling
router.post('/schedule', async (req: Request, res: Response) => {
  try {
    const { CallSid, problem, preferredDate, preferredTime } = req.body;
    
    logger.info('Scheduling appointment', {
      callSid: CallSid,
      problem,
      preferredDate,
      preferredTime
    });

    // Schedule appointment
    const appointment = await appointmentService.scheduleAppointment({
      callSid: CallSid,
      problem,
      preferredDate,
      preferredTime
    });

    // Send confirmation SMS
    await voiceService.sendConfirmationSMS(appointment);
    
    res.json({ success: true, appointment });
  } catch (error) {
    logger.error('Error scheduling appointment:', error);
    res.status(500).json({ error: 'Failed to schedule appointment' });
  }
});

export default router; 