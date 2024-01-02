const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');

const Product = require('./productModel');

const User = require('./userModel');

const wishlistSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        unique: true,
    },
    products: [
        {
            product: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'Product',
                required: true,
            },
            addedDate: {
                type: Date,
                default: Date.now,
            },
        },
    ],
    addedDate: {
        type: Date,
        default: Date.now,
    },
});

wishlistSchema.plugin(mongoosePaginate);
const Wishlist = mongoose.model('Wishlist', wishlistSchema);

module.exports = Wishlist;