import { database } from './connection';
import { logger } from '../utils/logger';

const createTables = async () => {
  try {
    // Create appointments table
    await database.query(`
      CREATE TABLE IF NOT EXISTS appointments (
        id VARCHAR(255) PRIMARY KEY,
        call_sid VARCHAR(255) NOT NULL,
        customer_name VARCHAR(255),
        customer_phone VARCHAR(50),
        problem TEXT NOT NULL,
        scheduled_date DATE NOT NULL,
        scheduled_time VARCHAR(50) NOT NULL,
        technician_name VARCHAR(255) NOT NULL,
        technician_id VARCHAR(255) NOT NULL,
        status VARCHAR(50) DEFAULT 'scheduled',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create conversations table
    await database.query(`
      CREATE TABLE IF NOT EXISTS conversations (
        id SERIAL PRIMARY KEY,
        call_sid VARCHAR(255) NOT NULL,
        role VARCHAR(50) NOT NULL CHECK (role IN ('user', 'assistant')),
        content TEXT NOT NULL,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create indexes for better performance
    await database.query(`
      CREATE INDEX IF NOT EXISTS idx_appointments_call_sid ON appointments(call_sid)
    `);

    await database.query(`
      CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments(status)
    `);

    await database.query(`
      CREATE INDEX IF NOT EXISTS idx_appointments_scheduled_date ON appointments(scheduled_date)
    `);

    await database.query(`
      CREATE INDEX IF NOT EXISTS idx_conversations_call_sid ON conversations(call_sid)
    `);

    await database.query(`
      CREATE INDEX IF NOT EXISTS idx_conversations_timestamp ON conversations(timestamp)
    `);

    logger.info('Database tables created successfully');
  } catch (error) {
    logger.error('Error creating database tables:', error);
    throw error;
  }
};

const insertSampleData = async () => {
  try {
    // Insert sample technicians (if needed)
    // Note: In a real application, technicians would be in a separate table
    
    // Insert sample appointment
    await database.query(`
      INSERT INTO appointments (
        id, call_sid, customer_name, customer_phone, problem, scheduled_date, scheduled_time,
        technician_name, technician_id, status
      ) VALUES (
        'sample-001',
        'CA1234567890',
        'John Smith',
        '+1234567890',
        'Dishwasher is not working properly',
        '2024-01-15',
        '10:00 AM',
        'John Doe',
        'tech-001',
        'scheduled'
      ) ON CONFLICT (id) DO NOTHING
    `);

    // Insert sample conversations
    await database.query(`
      INSERT INTO conversations (call_sid, role, content) VALUES
      ('CA1234567890', 'user', 'My dishwasher has recently broken'),
      ('CA1234567890', 'assistant', 'I understand you have a dishwasher issue. What specific problem are you experiencing?'),
      ('CA1234567890', 'user', 'It\'s not draining properly and making strange noises'),
      ('CA1234567890', 'assistant', 'That sounds like a drainage issue. I can schedule a technician for tomorrow morning at 10 AM. Would that work for you?'),
      ('CA1234567890', 'user', 'Yes, that would be perfect'),
      ('CA1234567890', 'assistant', 'Perfect! I\'ve scheduled your appointment for tomorrow at 10 AM with technician John Doe. You\'ll receive a confirmation message shortly.')
    `);

    logger.info('Sample data inserted successfully');
  } catch (error) {
    logger.error('Error inserting sample data:', error);
    // Don't throw error for sample data insertion
  }
};

const runMigrations = async () => {
  try {
    await createTables();
    await insertSampleData();
    logger.info('Database migration completed successfully');
  } catch (error) {
    logger.error('Database migration failed:', error);
    process.exit(1);
  } finally {
    await database.close();
  }
};

// Run migrations if this file is executed directly
if (require.main === module) {
  runMigrations();
} 