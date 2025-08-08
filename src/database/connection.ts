import { Pool, PoolClient } from 'pg';
import { logger } from '../utils/logger';

class Database {
  private pool: Pool;

  constructor() {
    // Use Aurora connection string if available, otherwise fall back to individual parameters
    const databaseUrl = process.env.DATABASE_URL;
    
    if (databaseUrl) {
      // Check if this is a local connection (no SSL required) or remote (SSL required)
      const isLocalConnection = databaseUrl.includes('localhost') || databaseUrl.includes('127.0.0.1');
      
      if (isLocalConnection) {
        // Local connection - no SSL
        this.pool = new Pool({
          connectionString: databaseUrl,
          max: 20, // Maximum number of clients in the pool
          idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
          connectionTimeoutMillis: 2000, // Return an error after 2 seconds if connection could not be established
        });
      } else {
        // Remote connection (Aurora) - SSL required
        this.pool = new Pool({
          connectionString: databaseUrl,
          ssl: {
            rejectUnauthorized: false
          },
          max: 20, // Maximum number of clients in the pool
          idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
          connectionTimeoutMillis: 2000, // Return an error after 2 seconds if connection could not be established
        });
      }
    } else {
      // Fallback to individual parameters
      this.pool = new Pool({
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '5432'),
        database: process.env.DB_NAME || 'better_call_homme',
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || '',
        max: 20, // Maximum number of clients in the pool
        idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
        connectionTimeoutMillis: 2000, // Return an error after 2 seconds if connection could not be established
      });
    }

    // Handle pool errors
    this.pool.on('error', (err) => {
      logger.error('Unexpected error on idle client', err);
    });
  }

  async testConnection(): Promise<void> {
    try {
      const client = await this.pool.connect();
      await client.query('SELECT NOW()');
      client.release();
      logger.info('Database connection test successful');
    } catch (error) {
      logger.error('Database connection test failed:', error);
      // Don't throw error in production, just log it
      if (process.env.NODE_ENV === 'production') {
        logger.warn('Database connection failed, but continuing without database');
      } else {
        throw error;
      }
    }
  }

  async query(text: string, params?: any[]): Promise<any> {
    const start = Date.now();
    try {
      const result = await this.pool.query(text, params);
      const duration = Date.now() - start;
      logger.debug('Executed query', { text, duration, rows: result.rowCount });
      return result;
    } catch (error) {
      logger.error('Database query error:', { text, error });
      throw error;
    }
  }

  async getClient(): Promise<PoolClient> {
    return await this.pool.connect();
  }

  async close(): Promise<void> {
    await this.pool.end();
    logger.info('Database connection pool closed');
  }
}

export const database = new Database(); 