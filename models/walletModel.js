const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');

const walletSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User', // Reference to the User model
        unique: true,
    },
    balance: {
        type: Number,
        default: 0,
        validate: {
            validator: function (value) {
                return value >= 0;
            },
            message: 'Balance should be greater than or equal to 0.',
        },
    },
    transactions: [
        {
            type: {
                type: String, // Transaction type: 'credit' or 'debit'
                enum: ['credit', 'debit'],
                required: true,
            },
            amount: {
                type: Number,
                required: true,
            },
            description: {
                type: String,
                enum: ['money added to wallet', 'refund money received', 'product purchased', 'other'],
                required: true,
            },
            date: {
                type: Date,
                default: Date.now,
            },
            razorpayPaymentId: {
                type: String,
                
            },
            razorpayOrderId: {
                type: String,
                
            },
            razorpaySignature:{
              type: String,
            },
        },
    ],
});

walletSchema.plugin(mongoosePaginate);

const Wallet = mongoose.model('Wallet', walletSchema);

module.exports = Wallet;
