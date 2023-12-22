const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');



const stockSchema = new mongoose.Schema({
    small: {
      availableStock: { type: Number },
      soldStock: { type: Number, default: 0 },
    },
    medium: {
      availableStock: { type: Number },
      soldStock: { type: Number, default: 0 },
    },
    large: {
      availableStock: { type: Number },
      soldStock: { type: Number, default: 0 },
    },
    extraLarge: {
      availableStock: { type: Number },
      soldStock: { type: Number, default: 0 },
    },
  });

  const productSchema = new mongoose.Schema({
    images: {
      image1: { name: { type: String, required: true } },
      image2: { name: { type: String, required: true } },
      image3: { name: { type: String, required: true } },
      image4: { name: { type: String, required: true } },
    },
    brandName: { type: String, required: true },
    productName: { type: String, required: true },
    initialPrice: { type: Number, required: true },
    description: { type: String, required: true },
    discountPercentage: { type: Number, required: true },
    finalPrice: { type: Number },
    category: { type: String, required: true },
    gender: { type: String, required: true },
    colors: [{ type: String }],
    sizes: [stockSchema],
    addedDate: { type: Date, default: Date.now },
    popularity: { type: Number, default: 0 },
    isDeleted: { type: Boolean, default: false },
  });

// Custom validator function to ensure the images array has exactly 4 elements
function arrayLengthValidator(val) {
  return val.length === 4;
}

// Middleware to calculate the final price before saving
productSchema.pre('save', function (next) {
  
  const discountMultiplier = 1 - this.discountPercentage / 100;
  this.finalPrice = this.initialPrice * discountMultiplier;
  next();
});

productSchema.plugin(mongoosePaginate);

const Product = mongoose.model('Product', productSchema);

module.exports = Product;
