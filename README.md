# Better Call Homme 🏠

An AI-powered home service booking system that allows customers to call a Twilio number, interact with an AI agent, and automatically schedule appointments with SMS confirmations.

## 🚀 Features

- **Voice AI Agent**: Natural language conversation with OpenAI
- **Automatic Appointment Scheduling**: Creates appointments during voice calls
- **SMS Confirmations**: Sends appointment details to caller's phone
- **Conversation Storage**: All interactions stored and retrievable
- **API Endpoints**: RESTful API for dashboard integration
- **AWS Deployment**: Production-ready cloud deployment

## 🏗️ Architecture

- **Backend**: Node.js, Express.js, TypeScript
- **AI**: OpenAI GPT-4 for natural language processing
- **Voice**: Twilio for voice calls and SMS
- **Database**: PostgreSQL (with in-memory fallback)
- **Deployment**: AWS ECS Fargate, Application Load Balancer
- **Dashboard**: Retool integration ready

## 📋 Prerequisites

- Node.js 18+
- Docker
- AWS CLI
- Twilio Account
- OpenAI API Key

## 🔧 Environment Variables

Create a `.env` file:

```env
# Twilio Configuration
TWILIO_ACCOUNT_SID=your_twilio_account_sid
TWILIO_AUTH_TOKEN=your_twilio_auth_token
TWILIO_PHONE_NUMBER=your_twilio_phone_number

# OpenAI Configuration
OPENAI_API_KEY=your_openai_api_key

# Database Configuration
DATABASE_URL=postgresql://username:password@host:port/database

# Server Configuration
PORT=3000
NODE_ENV=production
```

## 🚀 Quick Start

### Local Development

```bash
# Install dependencies
npm install

# Build TypeScript
npm run build

# Start development server
npm run dev
```

### Docker Development

```bash
# Build and run with Docker Compose
docker-compose up --build
```

### AWS Deployment

```bash
# Deploy to AWS
./scripts/deploy.sh
```

## 📞 Voice Flow

1. **Customer calls** Twilio number
2. **AI greets** and asks for name
3. **Confirms name** with customer
4. **Asks for problem** description
5. **Schedules appointment** (tomorrow 10 AM)
6. **Sends SMS confirmation** to caller's phone
7. **Ends call** with confirmation

## 🔌 API Endpoints

### Voice Endpoints
- `POST /voice/incoming` - Initial greeting
- `POST /voice/speech` - Process speech input
- `POST /voice/call-completed` - Create appointment and send SMS

### Data Endpoints
- `GET /api/appointments` - List all appointments
- `GET /api/conversations` - List all conversations
- `POST /api/appointments` - Create appointment manually
- `POST /api/appointments/from-conversation` - Create from conversation

### Health Check
- `GET /health` - Service health status

## 🗄️ Database Schema

### Appointments Table
```sql
CREATE TABLE appointments (
  id VARCHAR PRIMARY KEY,
  call_sid VARCHAR,
  customer_name VARCHAR,
  customer_phone VARCHAR,
  problem TEXT,
  scheduled_date VARCHAR,
  scheduled_time VARCHAR,
  technician_name VARCHAR,
  technician_id VARCHAR,
  status VARCHAR,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

### Conversations Table
```sql
CREATE TABLE conversations (
  id SERIAL PRIMARY KEY,
  call_sid VARCHAR,
  role VARCHAR,
  content TEXT,
  timestamp TIMESTAMP
);
```

## 🧪 Testing

```bash
# Test conversation flow
node test-conversation.js

# Test complete flow with appointment creation
node test-complete-flow.js

# Test SMS functionality
node test-sms.js
```

## 📊 Monitoring

- **ECS Logs**: CloudWatch Logs
- **Health Checks**: Application Load Balancer
- **Metrics**: CloudWatch Metrics

## 🔐 Security

- **HTTPS**: Application Load Balancer with SSL
- **Rate Limiting**: Express rate limiting
- **CORS**: Configured for dashboard access
- **Helmet**: Security headers

## 🚀 Deployment Status

- **Application**: Deployed on AWS ECS
- **Load Balancer**: production-better-call-homme-alb-586738683.us-east-1.elb.amazonaws.com
- **Database**: PostgreSQL (in-memory fallback active)
- **SMS**: Twilio configured and working

## 📱 Twilio Configuration

1. **Webhook URL**: `https://your-alb-url/voice/incoming`
2. **HTTP Method**: POST
3. **Voice Configuration**: Speech recognition enabled

## 🎯 Next Steps

1. **Connect Retool Dashboard** to API endpoints
2. **Configure Twilio webhook** for production calls
3. **Add real database** for persistent storage
4. **Set up monitoring** and alerting

## 📄 License

MIT License - see LICENSE file for details

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

---

**Better Call Homme** - Making home service booking simple and automated! 🏠✨ 