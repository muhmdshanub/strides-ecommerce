const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const Admin = require('./models/adminModel');

mongoose.connect('mongodb://localhost:27017/strides');

async function createAdminUser() {
    try {
        const existingAdmin = await Admin.findOne({ email: 'admin@gmail.com' });

        if (!existingAdmin) {
            const hashedPassword = await bcrypt.hash('admin', 10);

            const newAdmin = new Admin({
                name: 'Muhammed Shanoob',
                phone: '+918157882662',
                email: 'admin@gmail.com',
                password: hashedPassword,
                dateOfBirth: '11-11-1997'
                // Add other properties as needed
            });

            await newAdmin.save();
            console.log('Predefined admin user created successfully.');
        } else {
            console.log('Admin user already exists.');
        }
    } catch (error) {
        console.error('Error creating admin user:', error);
    } 
}

createAdminUser();
