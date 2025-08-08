const twilio = require('twilio');

// Test SMS functionality
async function testSMS() {
  console.log('📱 Testing SMS functionality...');
  
  // Check if Twilio credentials are configured
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const phoneNumber = process.env.TWILIO_PHONE_NUMBER;
  
  console.log('Twilio Account SID:', accountSid ? 'Configured' : 'Not configured');
  console.log('Twilio Auth Token:', authToken ? 'Configured' : 'Not configured');
  console.log('Twilio Phone Number:', phoneNumber || 'Not configured');
  
  if (!accountSid || !authToken || !phoneNumber) {
    console.log('❌ Twilio credentials not configured. Please add to your .env file:');
    console.log('TWILIO_ACCOUNT_SID=your_account_sid');
    console.log('TWILIO_AUTH_TOKEN=your_auth_token');
    console.log('TWILIO_PHONE_NUMBER=your_twilio_phone_number');
    return;
  }
  
  try {
    const client = twilio(accountSid, authToken);
    
    // Test SMS
    const message = await client.messages.create({
      body: 'Test SMS from Better Call Homme - Your appointment has been confirmed for tomorrow at 10 AM!',
      from: phoneNumber,
      to: '+1234567890' // Replace with your actual phone number for testing
    });
    
    console.log('✅ SMS sent successfully!');
    console.log('Message SID:', message.sid);
    console.log('Status:', message.status);
    
  } catch (error) {
    console.error('❌ Error sending SMS:', error.message);
    console.log('Please check your Twilio credentials and phone number.');
  }
}

testSMS(); 