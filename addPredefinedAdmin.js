const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const Admin = require('./models/adminModel');

mongoose.connect('');

async function createAdminUser() {
    try {
        const existingAdmin = await Admin.findOne({ email: 'admin@gmail.com' });

        if (!existingAdmin) {
            const hashedPassword = await bcrypt.hash('', 10);

            const newAdmin = new Admin({
                name: 'Muhammed Shanoob',
                phone: '',
                email: '',
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
