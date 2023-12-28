
const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');

const User = require('./userModel');

const addressSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },name: {
        type: String,
        required: true,
    },
    phoneNumber: {
        type: String,
        required: true,
    }, street: {
        type: String,
        required: true,
    },
    city: {
        type: String,
        required: true,
    },
    state: {
        type: String,
        required: true,
    },
    zipCode: {
        type: String,
        required: true,
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
});

addressSchema.plugin(mongoosePaginate);

const Address = mongoose.model('Address', addressSchema);

module.exports = Address;