import { database } from './connection';
import { logger } from '../utils/logger';

const createTables = async () => {
  try {
    // Create technicians table
    await database.query(`
      CREATE TABLE IF NOT EXISTS technicians (
        id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        phone VARCHAR(50),
        email VARCHAR(255),
        specialties TEXT[],
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create call_sessions table to track call metadata
    await database.query(`
      CREATE TABLE IF NOT EXISTS call_sessions (
        id VARCHAR(255) PRIMARY KEY,
        call_sid VARCHAR(255) UNIQUE NOT NULL,
        customer_name VARCHAR(255),
        customer_phone VARCHAR(50),
        status VARCHAR(50) DEFAULT 'active',
        duration_seconds INTEGER,
        started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        ended_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create appointments table with enhanced structure
    await database.query(`
      CREATE TABLE IF NOT EXISTS appointments (
        id VARCHAR(255) PRIMARY KEY,
        call_sid VARCHAR(255) NOT NULL,
        customer_name VARCHAR(255) NOT NULL,
        customer_phone VARCHAR(50) NOT NULL,
        customer_email VARCHAR(255),
        problem_description TEXT NOT NULL,
        scheduled_date DATE NOT NULL,
        scheduled_time TIME NOT NULL,
        estimated_duration_minutes INTEGER DEFAULT 60,
        technician_id VARCHAR(255) REFERENCES technicians(id),
        technician_name VARCHAR(255) NOT NULL,
        status VARCHAR(50) DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show')),
        priority VARCHAR(20) DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create conversations table with enhanced structure
    await database.query(`
      CREATE TABLE IF NOT EXISTS conversations (
        id SERIAL PRIMARY KEY,
        call_sid VARCHAR(255) NOT NULL,
        session_id VARCHAR(255) REFERENCES call_sessions(id),
        role VARCHAR(50) NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
        content TEXT NOT NULL,
        message_type VARCHAR(50) DEFAULT 'text' CHECK (message_type IN ('text', 'audio', 'system')),
        confidence_score DECIMAL(3,2),
        intent_detected VARCHAR(255),
        entities_extracted JSONB,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create appointment_updates table for tracking status changes
    await database.query(`
      CREATE TABLE IF NOT EXISTS appointment_updates (
        id SERIAL PRIMARY KEY,
        appointment_id VARCHAR(255) REFERENCES appointments(id),
        old_status VARCHAR(50),
        new_status VARCHAR(50) NOT NULL,
        updated_by VARCHAR(255),
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create customer_feedback table
    await database.query(`
      CREATE TABLE IF NOT EXISTS customer_feedback (
        id SERIAL PRIMARY KEY,
        appointment_id VARCHAR(255) REFERENCES appointments(id),
        call_sid VARCHAR(255),
        rating INTEGER CHECK (rating >= 1 AND rating <= 5),
        feedback_text TEXT,
        feedback_type VARCHAR(50) DEFAULT 'general',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    logger.info('Database tables created successfully');
  } catch (error) {
    logger.error('Error creating database tables:', error);
    throw error;
  }
};

const createIndexes = async () => {
  try {
    // Indexes for appointments
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
      CREATE INDEX IF NOT EXISTS idx_appointments_technician_id ON appointments(technician_id)
    `);
    await database.query(`
      CREATE INDEX IF NOT EXISTS idx_appointments_customer_phone ON appointments(customer_phone)
    `);

    // Indexes for conversations
    await database.query(`
      CREATE INDEX IF NOT EXISTS idx_conversations_call_sid ON conversations(call_sid)
    `);
    await database.query(`
      CREATE INDEX IF NOT EXISTS idx_conversations_session_id ON conversations(session_id)
    `);
    await database.query(`
      CREATE INDEX IF NOT EXISTS idx_conversations_timestamp ON conversations(timestamp)
    `);
    await database.query(`
      CREATE INDEX IF NOT EXISTS idx_conversations_role ON conversations(role)
    `);

    // Indexes for call_sessions
    await database.query(`
      CREATE INDEX IF NOT EXISTS idx_call_sessions_call_sid ON call_sessions(call_sid)
    `);
    await database.query(`
      CREATE INDEX IF NOT EXISTS idx_call_sessions_status ON call_sessions(status)
    `);
    await database.query(`
      CREATE INDEX IF NOT EXISTS idx_call_sessions_started_at ON call_sessions(started_at)
    `);

    // Indexes for technicians
    await database.query(`
      CREATE INDEX IF NOT EXISTS idx_technicians_is_active ON technicians(is_active)
    `);

    // Indexes for appointment_updates
    await database.query(`
      CREATE INDEX IF NOT EXISTS idx_appointment_updates_appointment_id ON appointment_updates(appointment_id)
    `);
    await database.query(`
      CREATE INDEX IF NOT EXISTS idx_appointment_updates_created_at ON appointment_updates(created_at)
    `);

    // Indexes for customer_feedback
    await database.query(`
      CREATE INDEX IF NOT EXISTS idx_customer_feedback_appointment_id ON customer_feedback(appointment_id)
    `);
    await database.query(`
      CREATE INDEX IF NOT EXISTS idx_customer_feedback_rating ON customer_feedback(rating)
    `);

    logger.info('Database indexes created successfully');
  } catch (error) {
    logger.error('Error creating database indexes:', error);
    throw error;
  }
};

const insertSampleData = async () => {
  try {
    // Insert sample technicians
    await database.query(`
      INSERT INTO technicians (id, name, phone, email, specialties) VALUES
      ('tech-001', 'John Doe', '+1234567890', 'john.doe@bettercallhomme.com', ARRAY['appliances', 'plumbing']),
      ('tech-002', 'Jane Smith', '+1234567891', 'jane.smith@bettercallhomme.com', ARRAY['electrical', 'hvac']),
      ('tech-003', 'Mike Johnson', '+1234567892', 'mike.johnson@bettercallhomme.com', ARRAY['appliances', 'electrical'])
      ON CONFLICT (id) DO NOTHING
    `);

    // Insert sample call session
    await database.query(`
      INSERT INTO call_sessions (id, call_sid, customer_name, customer_phone, status) VALUES
      ('session-001', 'CA1234567890', 'John Smith', '+1234567890', 'completed')
      ON CONFLICT (id) DO NOTHING
    `);

    // Insert sample appointment
    await database.query(`
      INSERT INTO appointments (
        id, call_sid, customer_name, customer_phone, customer_email, problem_description, 
        scheduled_date, scheduled_time, technician_id, technician_name, status, priority
      ) VALUES (
        'appt-001',
        'CA1234567890',
        'John Smith',
        '+1234567890',
        'john.smith@email.com',
        'Dishwasher is not draining properly and making strange noises',
        '2024-01-15',
        '10:00:00',
        'tech-001',
        'John Doe',
        'scheduled',
        'normal'
      ) ON CONFLICT (id) DO NOTHING
    `);

    // Insert sample conversations
    await database.query(`
      INSERT INTO conversations (call_sid, session_id, role, content, message_type, intent_detected) VALUES
      ('CA1234567890', 'session-001', 'user', 'My dishwasher has recently broken', 'text', 'appliance_repair'),
      ('CA1234567890', 'session-001', 'assistant', 'I understand you have a dishwasher issue. What specific problem are you experiencing?', 'text', 'question'),
      ('CA1234567890', 'session-001', 'user', 'It''s not draining properly and making strange noises', 'text', 'problem_description'),
      ('CA1234567890', 'session-001', 'assistant', 'That sounds like a drainage issue. I can schedule a technician for tomorrow morning at 10 AM. Would that work for you?', 'text', 'scheduling'),
      ('CA1234567890', 'session-001', 'user', 'Yes, that would be perfect', 'text', 'confirmation'),
      ('CA1234567890', 'session-001', 'assistant', 'Perfect! I''ve scheduled your appointment for tomorrow at 10 AM with technician John Doe. You''ll receive a confirmation message shortly.', 'text', 'confirmation')
    `);

    // Insert sample appointment update
    await database.query(`
      INSERT INTO appointment_updates (appointment_id, old_status, new_status, updated_by, notes) VALUES
      ('appt-001', NULL, 'scheduled', 'system', 'Appointment created from call session')
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
    await createIndexes();
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