require('dotenv').config();
const nodemailer = require('nodemailer');

// Function to send OTP via Email
const sendOtpEmail = async (email, otp) => {
    try {
        // Create a Nodemailer transporter


        const transporter = nodemailer.createTransport({
            
            host: 'smtp.gmail.com',
            port: 587,
            secure:false,
            auth: {
                user: process.env.NODEMAILER_EMAIL, // Replace with your Gmail email
                pass: process.env.NODEMAILER_PASSWORD, // Replace with your Gmail password
            },
        });

        // Define the email options
        const mailOptions = {
            from: process.env.NODEMAILER_EMAIL, // Replace with your Gmail email
            to: email,
            subject: 'Verification Code for Signup',
            text: `Your verification code for signup is: ${otp}`,
        };

        // Send the email
        const info = await transporter.sendMail(mailOptions);
        console.log('Email sent:', info.response);
    } catch (error) {
        console.error('Error sending email:', error);
        throw error;
    }
};

module.exports = sendOtpEmail;
