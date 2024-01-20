const mongoose = require('mongoose');

const offerSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String, required: true },
  offerType: { type: String, required: true },
  percentageDiscount: { type: Number, required: true },
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
  category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category' },
  validFrom: { type: Date, required: true },
  validUpto: { type: Date, required: true },
  isActive: { type: Boolean, default: true },
});

// Ensure that an offer is either product-based or category-based, not both
offerSchema.pre('validate', function (next) {
  if (this.product && this.category) {
    throw new Error('An offer can be either product-based or category-based, not both.');
  }
  next();
});

const Offer = mongoose.model('Offer', offerSchema);

module.exports = Offer;
