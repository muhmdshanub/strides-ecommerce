const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');

const categorySchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  description: { type: String , required: true,},
  addedDate: { type: Date, default: Date.now },
});

categorySchema.plugin(mongoosePaginate);

const Category = mongoose.model('Category', categorySchema);

module.exports = Category;