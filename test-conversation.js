const axios = require('axios');

const BASE_URL = 'http://production-better-call-homme-alb-586738683.us-east-1.elb.amazonaws.com';

async function testConversation() {
  const callSid = 'test-call-' + Date.now();
  
  console.log('🧪 Testing complete conversation flow...');
  
  // Step 1: Provide name
  console.log('1. Providing name...');
  let response = await axios.post(`${BASE_URL}/voice/speech`, {
    SpeechResult: 'John Smith',
    CallSid: callSid
  });
  console.log('Response:', response.data);
  
  // Step 2: Confirm name
  console.log('2. Confirming name...');
  response = await axios.post(`${BASE_URL}/voice/speech`, {
    SpeechResult: 'Yes',
    CallSid: callSid
  });
  console.log('Response:', response.data);
  
  // Step 3: Describe problem
  console.log('3. Describing problem...');
  response = await axios.post(`${BASE_URL}/voice/speech`, {
    SpeechResult: 'My dishwasher is broken',
    CallSid: callSid
  });
  console.log('Response:', response.data);
  
  // Step 4: Confirm appointment
  console.log('4. Confirming appointment...');
  response = await axios.post(`${BASE_URL}/voice/speech`, {
    SpeechResult: 'Yes',
    CallSid: callSid
  });
  console.log('Response:', response.data);
  
  // Check results
  console.log('5. Checking conversations...');
  response = await axios.get(`${BASE_URL}/api/conversations`);
  console.log('Conversations:', response.data);
  
  console.log('6. Checking appointments...');
  response = await axios.get(`${BASE_URL}/api/appointments`);
  console.log('Appointments:', response.data);
}

testConversation().catch(console.error); 