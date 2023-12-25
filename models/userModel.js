const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const mongoosePaginate = require('mongoose-paginate-v2');

const Cart = require('./cartModel');

const userSchema = new mongoose.Schema({

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
    wishlist: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Wishlist'
    }],
    cart: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Cart',
        unique: true,
    }],
    orders: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Order',
    }],
    isLogin: {
        type: Boolean,
        default: false
    },
    lastLogin: {
        type: Date
    },
    totalAmountSpent: {
        type: Number,
        default: 0
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    isBlocked: {
        type: Boolean,
        default: false
    },
});

// Middleware to update lastLogin and isLogin fields upon login
userSchema.pre('save', function (next) {
    if (this.isModified('isLogin') && this.isLogin) {
        this.lastLogin = new Date();
    }
    next();
});

//middleware to encrypt password
userSchema.pre('save', async function (next) {
    try {
        if (this.isModified('password')) {
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(this.password, salt);
            this.password = hashedPassword;
        }
        next();
    } catch (error) {
        next(error);
    }
});



userSchema.plugin(mongoosePaginate);

const User = mongoose.model('User', userSchema);

module.exports = User;