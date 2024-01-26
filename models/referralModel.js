const mongoose = require('mongoose');

const referralSchema = new mongoose.Schema({
    referringUser: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    referralToken: {
        type: String,
        required: true,
        unique: true,
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
    referredUsers: [
        {
            user: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'User',
            },
            timestamp: {
                type: Date,
                default: Date.now,
            },
        }
    ],
    
});

const Referral = mongoose.model('Referral', referralSchema);

module.exports = Referral;
