import { database } from '../database/connection';
import { logger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';
import moment from 'moment';

interface AppointmentRequest {
  callSid: string;
  customerName?: string;
  customerPhone?: string;
  problem: string;
  preferredDate: string;
  preferredTime: string;
}

interface Appointment {
  id: string;
  callSid: string;
  customerName?: string;
  customerPhone?: string;
  problem: string;
  scheduledDate: string;
  scheduledTime: string;
  technicianName: string;
  technicianId: string;
  status: 'scheduled' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled';
  createdAt: Date;
  updatedAt: Date;
}

interface Technician {
  id: string;
  name: string;
  specialties: string[];
  availability: string[];
  phone: string;
}

export class AppointmentService {
  private technicians: Technician[] = [
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

  async scheduleAppointment(request: AppointmentRequest): Promise<Appointment> {
    try {
      const appointmentId = uuidv4();
      const technician = this.assignTechnician(request.problem);
      const scheduledDate = this.parsePreferredDate(request.preferredDate);
      const scheduledTime = request.preferredTime || '10:00 AM';

      const appointment: Appointment = {
        id: appointmentId,
        callSid: request.callSid,
        customerName: request.customerName,
        customerPhone: request.customerPhone,
        problem: request.problem,
        scheduledDate,
        scheduledTime,
        technicianName: technician.name,
        technicianId: technician.id,
        status: 'scheduled',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Store in database
      await this.storeAppointment(appointment);

      logger.info('Appointment scheduled', {
        appointmentId,
        callSid: request.callSid,
        technician: technician.name,
        scheduledDate,
        scheduledTime
      });

      return appointment;
    } catch (error) {
      logger.error('Error scheduling appointment:', error);
      throw error;
    }
  }

  private assignTechnician(problem: string): Technician {
    // Simple assignment logic - can be enhanced with more sophisticated matching
    const problemLower = problem.toLowerCase();
    
    if (problemLower.includes('dishwasher') || problemLower.includes('appliance')) {
      return this.technicians.find(t => t.specialties.includes('appliances')) || this.technicians[0];
    } else if (problemLower.includes('plumbing') || problemLower.includes('pipe')) {
      return this.technicians.find(t => t.specialties.includes('plumbing')) || this.technicians[0];
    } else if (problemLower.includes('electrical') || problemLower.includes('wiring')) {
      return this.technicians.find(t => t.specialties.includes('electrical')) || this.technicians[0];
    } else {
      // Default to first available technician
      return this.technicians[0];
    }
  }

  private parsePreferredDate(preferredDate: string): string {
    if (preferredDate.toLowerCase() === 'tomorrow') {
      return moment().add(1, 'day').format('YYYY-MM-DD');
    } else if (preferredDate.toLowerCase() === 'today') {
      return moment().format('YYYY-MM-DD');
    } else {
      // Try to parse the date string
      const parsed = moment(preferredDate, ['MM/DD/YYYY', 'YYYY-MM-DD', 'MM-DD-YYYY']);
      if (parsed.isValid()) {
        return parsed.format('YYYY-MM-DD');
      } else {
        // Default to tomorrow
        return moment().add(1, 'day').format('YYYY-MM-DD');
      }
    }
  }

  private async storeAppointment(appointment: Appointment): Promise<void> {
    await database.query(
      `INSERT INTO appointments (
        id, call_sid, customer_name, customer_phone, problem, scheduled_date, scheduled_time, 
        technician_name, technician_id, status, 
        created_at, updated_at
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
  }

  async getAppointments(filters: {
    page?: number;
    limit?: number;
    status?: string;
    date?: string;
  }): Promise<{ appointments: Appointment[]; total: number }> {
    try {
      const { page = 1, limit = 50, status, date } = filters;
      const offset = (page - 1) * limit;

      let whereClause = 'WHERE 1=1';
      const params: any[] = [];
      let paramIndex = 1;

      if (status) {
        whereClause += ` AND status = $${paramIndex}`;
        params.push(status);
        paramIndex++;
      }

      if (date) {
        whereClause += ` AND scheduled_date = $${paramIndex}`;
        params.push(date);
        paramIndex++;
      }

      const countQuery = `SELECT COUNT(*) FROM appointments ${whereClause}`;
      const countResult = await database.query(countQuery, params);
      const total = parseInt(countResult.rows[0].count);

      const query = `
        SELECT * FROM appointments 
        ${whereClause}
        ORDER BY created_at DESC 
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `;
      params.push(limit, offset);

      const result = await database.query(query, params);
      const appointments = result.rows.map(this.mapRowToAppointment);

      return { appointments, total };
    } catch (error) {
      logger.error('Error fetching appointments:', error);
      throw error;
    }
  }

  async getAppointmentById(id: string): Promise<Appointment | null> {
    try {
      const result = await database.query(
        'SELECT * FROM appointments WHERE id = $1',
        [id]
      );

      if (result.rows.length === 0) {
        return null;
      }

      return this.mapRowToAppointment(result.rows[0]);
    } catch (error) {
      logger.error('Error fetching appointment by ID:', error);
      throw error;
    }
  }

  async updateAppointmentStatus(id: string, status: string): Promise<Appointment> {
    try {
      const result = await database.query(
        'UPDATE appointments SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
        [status, id]
      );

      if (result.rows.length === 0) {
        throw new Error('Appointment not found');
      }

      return this.mapRowToAppointment(result.rows[0]);
    } catch (error) {
      logger.error('Error updating appointment status:', error);
      throw error;
    }
  }

  async getAvailableTechnicians(): Promise<Technician[]> {
    return this.technicians;
  }

  async getAnalytics(filters: { startDate?: string; endDate?: string }): Promise<any> {
    try {
      const { startDate, endDate } = filters;
      let whereClause = 'WHERE 1=1';
      const params: any[] = [];
      let paramIndex = 1;

      if (startDate) {
        whereClause += ` AND created_at >= $${paramIndex}`;
        params.push(startDate);
        paramIndex++;
      }

      if (endDate) {
        whereClause += ` AND created_at <= $${paramIndex}`;
        params.push(endDate);
        paramIndex++;
      }

      // Get appointment counts by status
      const statusQuery = `
        SELECT status, COUNT(*) as count 
        FROM appointments 
        ${whereClause}
        GROUP BY status
      `;
      const statusResult = await database.query(statusQuery, params);

      // Get appointments by date
      const dateQuery = `
        SELECT scheduled_date, COUNT(*) as count 
        FROM appointments 
        ${whereClause}
        GROUP BY scheduled_date 
        ORDER BY scheduled_date DESC
      `;
      const dateResult = await database.query(dateQuery, params);

      return {
        statusBreakdown: statusResult.rows,
        dateBreakdown: dateResult.rows,
        totalAppointments: statusResult.rows.reduce((sum: number, row: any) => sum + parseInt(row.count), 0)
      };
    } catch (error) {
      logger.error('Error fetching analytics:', error);
      throw error;
    }
  }

  private mapRowToAppointment(row: any): Appointment {
    return {
      id: row.id,
      callSid: row.call_sid,
      customerName: row.customer_name,
      customerPhone: row.customer_phone,
      problem: row.problem,
      scheduledDate: row.scheduled_date,
      scheduledTime: row.scheduled_time,
      technicianName: row.technician_name,
      technicianId: row.technician_id,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
} 