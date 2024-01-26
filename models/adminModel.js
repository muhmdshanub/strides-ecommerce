
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const adminSchema = new mongoose.Schema({

    name: {
        type: String,
        required: true
    },
    email: {
        type: String,
        unique: true,
        required: true
    },
    phone: {
        type: String,
        unique: true
    },
    password: {
        type: String,
        required: true
    },
    dateOfBirth: {
        type: Date
    },
    addresses: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Address'
    }],
    isLogin: {
        type: Boolean,
        default: false
    },
    lastLogin: {
        type: Date
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
});

// Middleware to update lastLogin and isLogin fields upon login
adminSchema.pre('save', function (next) {
    if (this.isModified('isLogin') && this.isLogin) {
        this.lastLogin = new Date();
    }
    next();
});



const Admin = mongoose.model('Admin', adminSchema);

module.exports = Admin;