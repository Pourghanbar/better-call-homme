const axios = require('axios');

const BASE_URL = 'http://production-better-call-homme-alb-586738683.us-east-1.elb.amazonaws.com';

async function testSingleConversation() {
  const callSid = 'test-call-' + Date.now();
  
  console.log('🧪 Testing single conversation flow...');
  
  // Simulate a complete conversation in one request
  const conversationData = {
    SpeechResult: 'Yes, my dishwasher is broken and I need it fixed tomorrow at 10 AM',
    CallSid: callSid
  };
  
  console.log('Sending complete conversation data...');
  let response = await axios.post(`${BASE_URL}/voice/speech`, conversationData);
  console.log('Response:', response.data);
  
  // Check results
  console.log('Checking conversations...');
  response = await axios.get(`${BASE_URL}/api/conversations`);
  console.log('Conversations:', response.data);
  
  console.log('Checking appointments...');
  response = await axios.get(`${BASE_URL}/api/appointments`);
  console.log('Appointments:', response.data);
}

testSingleConversation().catch(console.error); 