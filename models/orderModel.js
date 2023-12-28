const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');

const Cart = require('./cartModel');
const User = require('./userModel');
const Address = require('./addressModel');
const Product = require('./productModel');



const orderSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  userName: {
    type: String,
    required: true,
  },
  address: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Address', // Reference to the Address model
    required: true,
  },
  orderDate: {
    type: Date,
    default: Date.now,
  },
  status: {
    type: String,
    default: 'Pending',
  },
  products: [
    {
      product: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
        required: true,
      },
      productName: {
        type: String,
        required: true,
      },
      brandName: {
        type: String,
        required: true,
      },
      size: {
        type: String,
        required: true,
      },
      quantity: {
        type: Number,
        required: true,
      },
      itemTotalAmount: {
        type: Number,
        required: true,
      },
      totalInitialMrp: {
        type: Number,
        required: true,
      },
    },
  ],
  totalAmount: {
    type: Number,
    required: true,
  },
  totalInitialMrp: {
    type: Number,
    required: true,
  },
});

orderSchema.plugin(require('mongoose-paginate-v2'));

const Order = mongoose.model('Order', orderSchema);

module.exports = Order;