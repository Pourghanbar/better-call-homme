import { VoiceService } from '../services/VoiceService';

// Mock dependencies
jest.mock('../services/AppointmentService');
jest.mock('../database/connection');
jest.mock('../utils/logger');

describe('VoiceService', () => {
  let voiceService: VoiceService;

  beforeEach(() => {
    voiceService = new VoiceService();
  });

  describe('generateInitialGreeting', () => {
    it('should generate TwiML with greeting and gather', () => {
      const twiml = voiceService.generateInitialGreeting();
      
      expect(twiml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
      expect(twiml).toContain('<Response>');
      expect(twiml).toContain('<Say');
      expect(twiml).toContain('<Gather');
      expect(twiml).toContain('Better Call Homme');
    });
  });

  describe('generateSpeechResponse', () => {
    it('should generate TwiML with AI response', () => {
      const aiResponse = 'I understand your dishwasher issue. When would you like to schedule?';
      const twiml = voiceService.generateSpeechResponse(aiResponse);
      
      expect(twiml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
      expect(twiml).toContain('<Response>');
      expect(twiml).toContain('<Say');
      expect(twiml).toContain(aiResponse);
    });

    it('should end call when response contains confirmation', () => {
      const aiResponse = 'Perfect! Your appointment is confirmed for tomorrow at 10 AM. Thank you!';
      const twiml = voiceService.generateSpeechResponse(aiResponse);
      
      expect(twiml).toContain('<Hangup/>');
    });
  });
}); 