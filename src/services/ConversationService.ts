import { database } from '../database/connection';
import { logger } from '../utils/logger';

interface Conversation {
  id: string;
  callSid: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface ConversationFilters {
  page?: number;
  limit?: number;
  callSid?: string;
}

export class ConversationService {
  async getConversations(filters: ConversationFilters): Promise<{ conversations: Conversation[]; total: number }> {
    try {
      const { page = 1, limit = 50, callSid } = filters;
      const offset = (page - 1) * limit;

      let whereClause = 'WHERE 1=1';
      const params: any[] = [];
      let paramIndex = 1;

      if (callSid) {
        whereClause += ` AND call_sid = $${paramIndex}`;
        params.push(callSid);
        paramIndex++;
      }

      const countQuery = `SELECT COUNT(*) FROM conversations ${whereClause}`;
      const countResult = await database.query(countQuery, params);
      const total = parseInt(countResult.rows[0].count);

      const query = `
        SELECT * FROM conversations 
        ${whereClause}
        ORDER BY timestamp DESC 
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `;
      params.push(limit, offset);

      const result = await database.query(query, params);
      const conversations = result.rows.map(this.mapRowToConversation);

      return { conversations, total };
    } catch (error) {
      logger.error('Error fetching conversations:', error);
      throw error;
    }
  }

  async getConversationByCallSid(callSid: string): Promise<Conversation[] | null> {
    try {
      const result = await database.query(
        'SELECT * FROM conversations WHERE call_sid = $1 ORDER BY timestamp ASC',
        [callSid]
      );

      if (result.rows.length === 0) {
        return null;
      }

      return result.rows.map(this.mapRowToConversation);
    } catch (error) {
      logger.error('Error fetching conversation by call SID:', error);
      throw error;
    }
  }

  async getConversationSummary(callSid: string): Promise<any> {
    try {
      const conversations = await this.getConversationByCallSid(callSid);
      if (!conversations) {
        return null;
      }

      // Extract key information from conversation
      const userMessages = conversations.filter(c => c.role === 'user');
      const assistantMessages = conversations.filter(c => c.role === 'assistant');

      // Find problem description (usually in first few user messages)
      const problemMessage = userMessages.find(msg => 
        msg.content.toLowerCase().includes('dishwasher') ||
        msg.content.toLowerCase().includes('broken') ||
        msg.content.toLowerCase().includes('problem')
      );

      // Find scheduling information
      const schedulingMessage = userMessages.find(msg =>
        msg.content.toLowerCase().includes('tomorrow') ||
        msg.content.toLowerCase().includes('10') ||
        msg.content.toLowerCase().includes('morning')
      );

      return {
        callSid,
        totalMessages: conversations.length,
        userMessages: userMessages.length,
        assistantMessages: assistantMessages.length,
        problem: problemMessage?.content || 'Not specified',
        scheduling: schedulingMessage?.content || 'Not specified',
        duration: conversations.length > 0 ? 
          new Date(conversations[conversations.length - 1].timestamp).getTime() - 
          new Date(conversations[0].timestamp).getTime() : 0,
        firstMessage: conversations[0]?.timestamp,
        lastMessage: conversations[conversations.length - 1]?.timestamp
      };
    } catch (error) {
      logger.error('Error generating conversation summary:', error);
      throw error;
    }
  }

  async getConversationAnalytics(filters: { startDate?: string; endDate?: string }): Promise<any> {
    try {
      const { startDate, endDate } = filters;
      let whereClause = 'WHERE 1=1';
      const params: any[] = [];
      let paramIndex = 1;

      if (startDate) {
        whereClause += ` AND timestamp >= $${paramIndex}`;
        params.push(startDate);
        paramIndex++;
      }

      if (endDate) {
        whereClause += ` AND timestamp <= $${paramIndex}`;
        params.push(endDate);
        paramIndex++;
      }

      // Get conversation counts by date
      const dateQuery = `
        SELECT DATE(timestamp) as date, COUNT(*) as count 
        FROM conversations 
        ${whereClause}
        GROUP BY DATE(timestamp) 
        ORDER BY date DESC
      `;
      const dateResult = await database.query(dateQuery, params);

      // Get unique call SIDs
      const uniqueCallsQuery = `
        SELECT COUNT(DISTINCT call_sid) as unique_calls 
        FROM conversations 
        ${whereClause}
      `;
      const uniqueCallsResult = await database.query(uniqueCallsQuery, params);

      // Get average messages per call
      const avgMessagesQuery = `
        SELECT AVG(message_count) as avg_messages 
        FROM (
          SELECT call_sid, COUNT(*) as message_count 
          FROM conversations 
          ${whereClause}
          GROUP BY call_sid
        ) as call_counts
      `;
      const avgMessagesResult = await database.query(avgMessagesQuery, params);

      return {
        dateBreakdown: dateResult.rows,
        uniqueCalls: parseInt(uniqueCallsResult.rows[0].unique_calls),
        avgMessagesPerCall: parseFloat(avgMessagesResult.rows[0].avg_messages) || 0,
        totalMessages: dateResult.rows.reduce((sum: number, row: any) => sum + parseInt(row.count), 0)
      };
    } catch (error) {
      logger.error('Error fetching conversation analytics:', error);
      throw error;
    }
  }

  private mapRowToConversation(row: any): Conversation {
    return {
      id: row.id,
      callSid: row.call_sid,
      role: row.role,
      content: row.content,
      timestamp: row.timestamp
    };
  }
} 