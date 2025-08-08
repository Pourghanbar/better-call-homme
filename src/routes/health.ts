import { Router, Request, Response } from 'express';
import { database } from '../database/connection';

const router = Router();

// Basic health check
router.get('/', (req: Request, res: Response) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    service: 'Better Call Homme API'
  });
});

// Detailed health check with database
router.get('/detailed', async (req: Request, res: Response) => {
  try {
    // Test database connection
    await database.testConnection();
    
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'Better Call Homme API',
      database: 'connected',
      environment: process.env.NODE_ENV || 'development'
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      service: 'Better Call Homme API',
      database: 'disconnected',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router; 