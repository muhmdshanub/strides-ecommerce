require('dotenv').config();
const client = require('twilio')(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

async function sendSms(phoneNumber, otp) {
  try {
    // Check if the phone number is valid (string and not empty)
    if (typeof phoneNumber !== 'string' || !phoneNumber.trim()) {
      throw new Error('Invalid phone number provided.');
    }


    const message = `Your verification code is: ${otp}`;

    // Send SMS with Twilio
    const messageResponse = await client.messages.create({
      to: phoneNumber,
      from: process.env.TWILIO_FROM_NUMBER,
      body: message,
    });

    console.log('SMS sent successfully!', messageResponse.sid);
  } catch (error) {
    console.error('Error sending SMS:', error);
  }
}

module.exports = sendSms;
