const axios = require('axios');

const BASE_URL = 'http://production-better-call-homme-alb-586738683.us-east-1.elb.amazonaws.com';

async function testAutomaticAppointment() {
  const callSid = 'test-call-' + Date.now();
  
  console.log('🧪 Testing automatic appointment creation...');
  
  // Step 1: Provide name
  console.log('1. Providing name...');
  let response = await axios.post(`${BASE_URL}/voice/speech`, {
    SpeechResult: 'John Smith',
    CallSid: callSid,
    From: '+1234567890' // Simulate caller phone number
  });
  console.log('Response:', response.data);
  
  // Step 2: Confirm name
  console.log('2. Confirming name...');
  response = await axios.post(`${BASE_URL}/voice/speech`, {
    SpeechResult: 'Yes',
    CallSid: callSid,
    From: '+1234567890'
  });
  console.log('Response:', response.data);
  
  // Step 3: Describe problem
  console.log('3. Describing problem...');
  response = await axios.post(`${BASE_URL}/voice/speech`, {
    SpeechResult: 'My dishwasher is broken',
    CallSid: callSid,
    From: '+1234567890'
  });
  console.log('Response:', response.data);
  
  // Step 4: Confirm appointment
  console.log('4. Confirming appointment...');
  response = await axios.post(`${BASE_URL}/voice/speech`, {
    SpeechResult: 'Yes',
    CallSid: callSid,
    From: '+1234567890'
  });
  console.log('Response:', response.data);
  
  // Check results
  console.log('5. Checking conversations...');
  response = await axios.get(`${BASE_URL}/api/conversations`);
  console.log('Conversations:', response.data);
  
  console.log('6. Checking appointments...');
  response = await axios.get(`${BASE_URL}/api/appointments`);
  console.log('Appointments:', response.data);
  
  // If no appointment was created automatically, create one manually
  if (response.data.appointments.length === 0) {
    console.log('7. Creating appointment manually from conversation...');
    response = await axios.post(`${BASE_URL}/api/appointments/from-conversation`, {
      callSid: callSid
    });
    console.log('Manual appointment creation:', response.data);
    
    // Check appointments again
    response = await axios.get(`${BASE_URL}/api/appointments`);
    console.log('Appointments after manual creation:', response.data);
  }
}

testAutomaticAppointment().catch(console.error); 