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
    type: Address.schema, // Use the imported Address model
    required: true,
  },
  orderDate: {
    type: Date,
    default: Date.now,
  },
  deliveredDate: {
    type: Date,
  },
  status: {
    type: String,
    enum: ['Placed', 'Cancelled', 'Delivered', 'Returned', 'Return Received'],
    default: 'Placed',
  },
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
  totalFinalAmount: {
    type: Number,
    required: true,
  },
  totalInitialMrp: {
    type: Number,
    required: true,
  },
});

orderSchema.plugin(mongoosePaginate);

const Order = mongoose.model('Order', orderSchema);

module.exports = Order;