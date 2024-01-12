const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');

const Order = require('./orderModel');

const paymentSchema = new mongoose.Schema({
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    paymentMethod: {
      type: String,
      enum: ['Cash on Delivery', 'RazorPay Payment', 'Wallet Payment'],
      required: true,
    },
    orders: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Order',
        required: true,
      },
    ],
    totalAmount: {
      type: Number,
      required: true,
    },
    createdAt: {
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
  });
  
  const Payment = mongoose.model('Payment', paymentSchema);

  module.exports = Payment;