const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');

const User = require('./userModel');

const cartSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    items: [
        {
            product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
            size: { type: String, required: true },
            quantity: { type: Number, required: true },
            totalAmount: { type: Number, default: 0 },
        }
    ],
    totalItems: { type: Number, default: 0 },
    totalAmount: { type: Number, default: 0 },
    createdAt: {
        type: Date,
        default: Date.now
    },
    coupon:{
        amount : { type: Number, default: 0 },
        code : { type: String,default: ''}, 
    }
});

// Create a compound unique index for items.product and items.size within each item
cartSchema.path('items').index({ 'product': 1, 'size': 1 }, { unique: true });






cartSchema.plugin(mongoosePaginate);

const Cart = mongoose.model('Cart', cartSchema);

module.exports = Cart;
