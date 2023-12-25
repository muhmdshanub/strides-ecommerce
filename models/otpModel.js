const mongoose = require('mongoose');

const otpSchema = new mongoose.Schema({
   
    emailOtp: {
        type: String,
        required: true,
        expires: 120, // Set expiration time for 2 minutes
    },
    intendedEmail: {
        type: String,
        required: true,
        expires: 120, // Set expiration time for 2 minutes
    },
    createdAt: {
        type: Date,
        default: Date.now,
        expires: 120, // Set expiration time for 2 minutes
    },
});

const OTP = mongoose.model('OTP', otpSchema);

module.exports = OTP;
