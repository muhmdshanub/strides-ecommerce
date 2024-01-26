const otpGenerator = require('otp-generator');
const mongoose = require('mongoose');
const User = require('../models/userModel');
const OTP = require('../models/otpModel');
const Address = require('../models/addressModel');
const Category = require('../models/categoryModel');
const Products = require('../models/productModel');
const Cart = require('../models/cartModel');
const Wishlist = require('../models/wishlistModel');
const Order = require('../models/orderModel');
const sendOtpEmail = require('../utils/sendEmail');

const bcrypt = require('bcrypt');

async function getAllCategories() {
    try {
      const categories = await Category.find();
      return categories;
    } catch (error) {
      throw error;
    }
  }


const addressLoader = async (req, res, next) => {
    try {
        const userId = req.session.userId;

        if (!userId) {
            console.log("corresponding user not found login");
            const error = new Error('User not authenticated');
            error.status = 403; // Unauthorized status code
            throw error;
        }

        // Fetch the cart data for the current user
        const cart = await getUpdatedCartPrice(userId);

        

        // Check for invalidated items in the cart
        const invalidItems = [];

        for (const item of cart.items) {
            const product = item.product;

            const selectedSize = item.size;

            // Assuming sizes array has only one element
            const stockSchema = product.sizes[0];

            // Check if the selected size exists in the stock schema
            if (!(selectedSize in stockSchema)) {
                invalidItems.push({
                    item: item.product,
                    productName: product.productName,
                    brandName: product.brandName,
                    size: selectedSize,
                    selectedQuantity: item.quantity,
                    reason: 'Invalid size',
                });
                continue;
            }

            const availableStock = stockSchema[selectedSize].availableStock;

            // Check if availableStock is 0 or quantity is greater than available stock or greater than 10
            if (availableStock === 0 || item.quantity > 10 || item.quantity > availableStock) {
                invalidItems.push({
                    item: item.product,
                    productName: product.productName,
                    brandName: product.brandName,
                    size: selectedSize,
                    selectedQuantity: item.quantity,
                    reason: availableStock === 0 ? 'Not available' : (item.quantity > 10 ? 'More than 10' : 'More than available stock'),
                });
            }
        }



        // Fetch user document with populated addresses field
        const user = await User.findById(userId).populate('addresses');

        // Get the first address from the addresses array
        const firstAddress = user.addresses.length > 0 ? user.addresses[0] : null;

        


        const categories = await  getAllCategories();

        // Check if the cart has a coupon
        if (cart.coupon) {
            const isValidCoupon = await isCouponValidForUser(cart.coupon, userId, cart);

            // If the coupon is not valid, reset it in the cart
            if (!isValidCoupon) {
                console.log('Invalid coupon. Resetting cart coupon.');
                const couponUpdate = {
                    $set: {
                        'coupon.amount': 0,
                        'coupon.code': "",
                    }
                };
        
                // Save the updated cart with the applied coupon
                await Cart.updateOne({ user: userId }, couponUpdate);

                // If there are invalid coupons
                 req.flash('error', "You have some invalid coupon atatched. We have removed it.")
                return res.rendirectr('/cart');
            }
        }

        if (invalidItems.length > 0) {
            // If there are invalid items, redirect to the cart page with the invalid items
            req.flash('error', "You have some invalid items in your cart. Please click On the MOVE TO ADDDRESS button to know more.")
            return res.render('./user/cart', { invalidItems, cart, categories });
        } else {
            // Render the payment-selection page with the first address and cart details
            res.render('./user/address.ejs', { firstAddress, user, cart, categories });
        }


    } catch (error) {
        if (error.status) {
            // Custom error with status code, handle it in error-handling middleware
            throw error;
        } else {
            // Unexpected error, log it and redirect to a generic error page
            console.error(error.message);
            
            next(error)
        }
        
    }
};

const addressAddLoader = async (req, res, next) => {
    try {
        const userId = req.session.userId;

        // Extract values from req.body
        const { name, phoneNumber, street, city, state, zipCode } = req.body;

        // Create an Address document
        const newAddress = new Address({
            user: userId,
            name,
            phoneNumber,
            street,
            city,
            state,
            zipCode,
        });

        // Save the Address document
        await newAddress.save();

        // Update the User model with the new address ID
        await User.findByIdAndUpdate(
            userId,
            { $push: { addresses: newAddress._id } },
            { new: true }
        );

        // Send a success response
        res.status(200).json({ message: 'Address added successfully', address: newAddress });
    } catch (error) {
        console.error(error.message);
        next(error);
    }
};

const addressEditLoader = async (req, res, next) => {
    try {
        const userId = req.session.userId;

        const addressId = req.params.addressId;

        if (!mongoose.Types.ObjectId.isValid(addressId)) {
            const genericErrorMessage = 'Invalid address ID: ';
            const genericError = new Error(genericErrorMessage);
            genericError.status = 500;
            throw genericError;
        }

        // Extract values from req.body
        const { name, phoneNumber, street, city, state, zipCode } = req.body;

        let updatedAddress;

        if (!addressId) {
            const genericErrorMessage = 'Address not found : ' ;
            const genericError = new Error(genericErrorMessage);
            genericError.status = 404;
            throw genericError;
        }

        // If addressId is provided, update the existing address
        updatedAddress = await Address.findByIdAndUpdate(addressId, {
            name,
            phoneNumber,
            street,
            city,
            state,
            zipCode,
        }
        );

        // Check if the address was found and updated
        if (!updatedAddress) {
            return res.status(404).json({ message: 'Address not found' });
        }


        // Send a success response with the updated address
        res.status(200).json({ message: 'Address updated/added successfully', address: updatedAddress });
    } catch (error) {
        console.error(error.message);
        next(error)
    }
};



const addressDeleteHandler = async (req, res, next) => {
    try {
        const userId = req.session.userId;
        const addressId = req.params.addressId;


        if (!mongoose.Types.ObjectId.isValid(addressId)) {
            const genericErrorMessage = 'Invalid address ID: ';
            const genericError = new Error(genericErrorMessage);
            genericError.status = 500;
            throw genericError;
        }

        // Delete document from the address collection
        const deletedAddress = await Address.findOneAndDelete({ _id: addressId });

        if (!deletedAddress) {
            const genericErrorMessage = 'Address not found : ' ;
            const genericError = new Error(genericErrorMessage);
            genericError.status = 404 ;
            throw genericError;
        }

        // Remove addressId from the user's addresses array
        await User.findByIdAndUpdate(userId, { $pull: { addresses: addressId } });

        res.status(200).json({ message: 'Address deleted successfully' });
    } catch (error) {
        console.error(error.message);
        next(error)
    }
};

const addressToPaymentHandler = async (req, res, next) => {
    try {


        const userId = req.session.userId;
        const addressId = req.params.addressId;

        if (!mongoose.Types.ObjectId.isValid(addressId)) {
            const genericErrorMessage = 'Invalid address ID: ';
            const genericError = new Error(genericErrorMessage);
            genericError.status = 500;
            throw genericError;
        }
        

        if (!userId) {
            console.log("no valid userID on session")
            const genericErrorMessage = 'No valid userId on session : ';
            const genericError = new Error(genericErrorMessage);
            genericError.status = 404;
            throw genericError;
        }

        if (!addressId) {
            console.log("no valid addressId on url")
            const genericErrorMessage = 'No valid AddressId on url: ';
            const genericError = new Error(genericErrorMessage);
            genericError.status = 404;
            throw genericError;
        }

        // Find the user document
        const user = await User.findOne({ _id: userId });

        if (!user) {
            console.log("user not found on user collection")
            const genericErrorMessage = 'User not found on the list : ' ;
        const genericError = new Error(genericErrorMessage);
        genericError.status = 404;
        throw genericError;
        }

        // Check if the given addressId exists in the user's addresses
        const selectedAddressIndex = user.addresses.findIndex(address => address._id.toString() === addressId);

        if (selectedAddressIndex === -1) {
            console.log("Invalid address selected")
            const genericErrorMessage = 'Invalid address choosen : ';
            const genericError = new Error(genericErrorMessage);
            genericError.status = 404;
            throw genericError;
        }

        // If the selected address is not already at the 0th index, swap it
        if (selectedAddressIndex !== 0) {
            // Swap the addresses
            const temp = user.addresses[0];
            user.addresses[0] = user.addresses[selectedAddressIndex];
            user.addresses[selectedAddressIndex] = temp;

            // Save the updated user document
            await user.save();
        }

        // Redirect to the select-payment page

        res.redirect('/payment-selection');

    } catch (error) {
        console.log(error.message);
        next(error)
    }
}




const profileaddressesLoader = async (req, res, next) => {
    try {
        const userId = req.session.userId;

        if (!userId) {
            console.log("corresponding user not found login");
            const genericErrorMessage = 'user not authenticated : ';
            const genericError = new Error(genericErrorMessage);
            genericError.status = 404;
            throw genericError;
        }





        // Fetch user document with populated addresses field
        const user = await User.findById(userId).populate('addresses');

        // Get the first address from the addresses array
        const firstAddress = user.addresses.length > 0 ? user.addresses[0] : null;


        const categories = await  getAllCategories();

        // Render the payment-selection page with the first address and cart details
        res.render('./user/profile/profile-addresses.ejs', { firstAddress, user, categories });



    } catch (error) {
        console.log(error.message);
        next(error)
    }
};


const updateUserPrimaryAddress = async (req, res, next) => {
    try {
        const userId = req.session.userId;
        const addressId = req.params.addressId;

        // Validate input parameters
        if (!userId || !addressId) {
            return res.status(400).json({ success: false, message: 'Invalid request parameters.' });
        }

        if (!mongoose.Types.ObjectId.isValid(addressId)) {
            const genericErrorMessage = 'Invalid address ID: ';
            const genericError = new Error(genericErrorMessage);
            genericError.status = 500;
            throw genericError;
        }

        // Find the user document
        const user = await User.findOne({ _id: userId });

        if (!user) {
            console.log("User not found.");
            return res.status(404).json({ success: false, message: 'User not found.' });
        }

        // Check if the given addressId exists in the user's addresses
        const selectedAddressIndex = user.addresses.findIndex(address => address._id.toString() === addressId);

        if (selectedAddressIndex === -1) {
            console.log("Invalid address selected.");
            return res.status(400).json({ success: false, message: 'Invalid address selected.' });
        }

        // If the selected address is not already at the 0th index, swap it
        if (selectedAddressIndex !== 0) {
            // Swap the addresses
            const temp = user.addresses[0];
            user.addresses[0] = user.addresses[selectedAddressIndex];
            user.addresses[selectedAddressIndex] = temp;

            // Save the updated user document
            await user.save();


            return res.status(200).json({ success: true, message: 'Primary address updated successfully.' });
        }

        // If the selected address is already at the 0th index, no need to swap
        console.log("Selected address is already the primary address.");
        return res.status(200).json({ success: true, message: 'Selected address is already the primary address.' });
    } catch (error) {
        console.error("Error updating primary address:", error.message);
        next(error)
    }
};

async function isCouponValidForUser(coupon, userId, userCart) {
    // Check if the coupon code is "WELCOME350"
    if (coupon.code === "WELCOME350") {
        // Check if it's the user's first purchase
        const user = await User.findById(userId);
        if (user && user.orders && user.orders.length > 0) {
            console.log("cannot use welcome coupon after the first purchase");
            return false;
        }
    }

    // For other coupons
    if (userCart.totalAmount < coupon.minimumPurchaseLimit) {
        console.log("minimum purchase limit not met " + userCart.totalAmount + " " + coupon.minimumPurchaseLimit);
        return false;
    }

    if (new Date(coupon.validFrom) > Date.now()) {
        console.log("coupon not yet activated ");
        return false;
    }

    if (coupon.validUpto && new Date(coupon.validUpto) < Date.now()) {
        console.log("expired coupon ");
        return false;
    }

    // If all conditions pass, the coupon is valid
    return true;
}

async function getUpdatedCartPrice(userId) {
    const cartPipeline = [
        {
            $match: { user: new mongoose.Types.ObjectId(userId) },
        },
        {
            $addFields: {
                items: { $ifNull: ['$items', []] },
            },
        },
        {
            $unwind: '$items',
        },
        {
            $lookup: {
                from: 'products',
                localField: 'items.product',
                foreignField: '_id',
                as: 'items.product',
            },
        },
        {
            $unwind: '$items.product',
        },
        {
            $lookup: {
                from: 'categories',
                localField: 'items.product.category',
                foreignField: '_id',
                as: 'items.product.category',
            },
        },
        {
            $unwind: '$items.product.category',
        },
        {
            $lookup: {
                from: 'offers',
                let: {
                    productId: '$items.product._id',
                    categoryId: '$items.product.category._id',
                },
                pipeline: [
                    {
                        $match: {
                            $expr: {
                                $and: [
                                    { $or: [{ $eq: ['$product', '$$productId'] }, { $eq: ['$category', '$$categoryId'] }] },
                                    { $lte: ['$validFrom', new Date()] },
                                    { $gte: ['$validUpto', new Date()] },
                                    { $eq: ['$isActive', true] },
                                ],
                            },
                        },
                    },
                    {
                        $group: {
                            _id: null,
                            maxDiscount: { $max: '$percentageDiscount' },
                        },
                    },
                ],
                as: 'items.product.offersData',
            },
        },
        {
            $addFields: {
                'items.product.maxDiscountPercentage': {
                    $ifNull: [{ $arrayElemAt: ['$items.product.offersData.maxDiscount', 0] }, 0],
                },
            },
        },
        {
            $addFields: {
                'items.product.finalPrice': {
                    $cond: {
                        if: { $gt: ['$items.product.maxDiscountPercentage', 0] },
                        then: {
                            $multiply: [
                                '$items.product.initialPrice',
                                {
                                    $subtract: [
                                        1,
                                        {
                                            $divide: ['$items.product.maxDiscountPercentage', 100],
                                        },
                                    ],
                                },
                            ],
                        },
                        else: '$items.product.initialPrice',
                    },
                },
            },
        },
        {
            $group: {
                _id: '$_id',
                user: { $first: '$user' },
                createdAt: { $first: '$createdAt' },
                totalItems: { $first: '$totalItems' },
                coupon: { $first: '$coupon' },
                items: { $push: '$items' },
            },
        },
    ];

    const cartAggregationResult = await Cart.aggregate(cartPipeline);

    let cartResult;

    if (cartAggregationResult.length > 0) {
        // If the cart exists in the aggregation result
        cartResult = cartAggregationResult[0];
    } else {
        // If the cart doesn't exist, find it using mongoose
        cartResult = await Cart.findOne({ user: userId });

        if (!cartResult) {
            // If still not found, create a new cart with an empty items array
            cartResult = new Cart({ user: userId, items: [] });
        }
    }

    // Calculate total prices for each item
    cartResult.items.forEach(item => {
        item.totalAmount = item.quantity * item.product.finalPrice;
        item.totalInitialAmount = item.quantity * item.product.initialPrice;
    });

    // Calculate total price for the entire cart
    cartResult.totalAmount = cartResult.items.length > 0 ?
        parseFloat(cartResult.items.reduce((total, item) => total + item.totalAmount, 0)).toFixed(2) : 0;
    cartResult.totalInitialAmount = cartResult.items.length > 0 ?
        parseFloat(cartResult.items.reduce((total, item) => total + item.totalInitialAmount, 0)).toFixed(2) : 0;


    return cartResult;
}

module.exports = {
    addressLoader,
    addressAddLoader,
    addressEditLoader,
    addressDeleteHandler,
    addressToPaymentHandler,
    profileaddressesLoader,
    updateUserPrimaryAddress,
}