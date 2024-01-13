const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');

const couponSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
  },
  code: {
    type: String,
    required: true,
    unique: true,
  },
  description: {
    type: String,
    required: true,
  },
  amount: {
    type: Number,
    required: true,
  },
  minimumPurchaseLimit: {
    type: Number,
    required: true,
  },
  validFrom: {
    type: Date,
    default: Date.now,
  },
  validUpto: {
    type: Date,
  },
  isDeleted: { type: Boolean, default: false },
});

couponSchema.plugin(mongoosePaginate);

const Coupon = mongoose.model('Coupon', couponSchema);

module.exports = Coupon;