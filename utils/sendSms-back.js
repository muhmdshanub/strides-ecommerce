require('dotenv').config();
const TeleSignSDK = require('telesignsdk');

// Your TeleSign API credentials
const customerId = process.env.TeleSignSDK_SID;
const apiKey = process.env.TeleSignSDK_KEY;

// Instantiate a messaging client object.
const client = new TeleSignSDK(customerId, apiKey);

// Define the SMS sending function.
async function sendSms(phoneNumber, otp) {
    // Set the message text and type.
    const message = `Your verification code is: ${otp}`;
    const messageType = "ARN";

    // Create a promise for better async handling.
    return new Promise((resolve, reject) => {
        // Define the callback.
        function smsCallback(error, responseBody) {
            if (error === null) {
                // Resolve the promise if the SMS is sent successfully.
                resolve(responseBody);
            } else {
                // Reject the promise with the error if SMS sending fails.
                reject(error);
            }
        }

        // Make the request to send SMS and capture the response.
        client.sms.message(smsCallback, phoneNumber, message, messageType);
    });
}

module.exports = sendSms;
