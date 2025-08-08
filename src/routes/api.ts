import { Router, Request, Response } from 'express';
import { AppointmentService } from '../services/AppointmentService';
import { ConversationService } from '../services/ConversationService';
import { logger } from '../utils/logger';

const router = Router();
const appointmentService = new AppointmentService();
const conversationService = new ConversationService();

// Get all appointments (for Retool dashboard)
router.get('/appointments', async (req: Request, res: Response) => {
  try {
    const { page = 1, limit = 50, status, date } = req.query;
    
    const appointments = await appointmentService.getAppointments({
      page: Number(page),
      limit: Number(limit),
      status: status as string,
      date: date as string
    });
    
    res.json(appointments);
  } catch (error) {
    logger.error('Error fetching appointments:', error);
    res.status(500).json({ error: 'Failed to fetch appointments' });
  }
});

// Get appointment by ID
router.get('/appointments/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const appointment = await appointmentService.getAppointmentById(id);
    
    if (!appointment) {
      return res.status(404).json({ error: 'Appointment not found' });
    }
    
    return res.json(appointment);
  } catch (error) {
    logger.error('Error fetching appointment:', error);
    return res.status(500).json({ error: 'Failed to fetch appointment' });
  }
});

// Update appointment status
router.patch('/appointments/:id/status', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    const appointment = await appointmentService.updateAppointmentStatus(id, status);
    res.json(appointment);
  } catch (error) {
    logger.error('Error updating appointment status:', error);
    res.status(500).json({ error: 'Failed to update appointment status' });
  }
});

// Get all conversations (for Retool dashboard)
router.get('/conversations', async (req: Request, res: Response) => {
  try {
    const { page = 1, limit = 50, callSid } = req.query;
    
    const conversations = await conversationService.getConversations({
      page: Number(page),
      limit: Number(limit),
      callSid: callSid as string
    });
    
    res.json(conversations);
  } catch (error) {
    logger.error('Error fetching conversations:', error);
    res.status(500).json({ error: 'Failed to fetch conversations' });
  }
});

// Get conversation by call SID
router.get('/conversations/:callSid', async (req: Request, res: Response) => {
  try {
    const { callSid } = req.params;
    const conversation = await conversationService.getConversationByCallSid(callSid);
    
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }
    
    return res.json(conversation);
  } catch (error) {
    logger.error('Error fetching conversation:', error);
    return res.status(500).json({ error: 'Failed to fetch conversation' });
  }
});

// Get analytics data
router.get('/analytics', async (req: Request, res: Response) => {
  try {
    const { startDate, endDate } = req.query;
    
    const analytics = await appointmentService.getAnalytics({
      startDate: startDate as string,
      endDate: endDate as string
    });
    
    res.json(analytics);
  } catch (error) {
    logger.error('Error fetching analytics:', error);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

// Get available technicians
router.get('/technicians', async (req: Request, res: Response) => {
  try {
    const technicians = await appointmentService.getAvailableTechnicians();
    res.json(technicians);
  } catch (error) {
    logger.error('Error fetching technicians:', error);
    res.status(500).json({ error: 'Failed to fetch technicians' });
  }
});

export default router; 