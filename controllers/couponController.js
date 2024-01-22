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
const Coupon = require('../models/couponModel');


const couponAddLoaderAdmin = async (req, res, next) => {
    try {


        res.render('./admin/coupon-add.ejs');
    } catch (error) {
        console.log(error.message);
        next(error)
    }
}


const couponAddHandlerAdmin = async (req, res, next) => {
    try {
        const {
            name,
            code,
            description,
            amount,
            minimumPurchaseLimit,
            validFrom,
            validUpto
        } = req.body;
        
        // Validate that name is present and of string type
        if (!name || typeof name !== 'string') {
            req.flash('error', 'Invalid or missing value for the Name field.');
            return res.redirect('/admin/coupon-add');
        }

        // Validate that code is present and of string type
        if (!code || typeof code !== 'string') {
            req.flash('error', 'Invalid or missing value for the Code field.');
            return res.redirect('/admin/coupon-add');
        }

        // Validate that description is present and of string type
        if (!description || typeof description !== 'string') {
            req.flash('error', 'Invalid or missing value for the Description field.');
            return res.redirect('/admin/coupon-add');
        }

        // Validate that amount is present, a number, and greater than 0
        if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
            req.flash('error', 'Invalid or missing value for the Amount field.');
            return res.redirect('/admin/coupon-add');
        }

        // Validate that minimumPurchaseLimit is present, a number, and greater than 0
        if (!minimumPurchaseLimit || isNaN(parseFloat(minimumPurchaseLimit)) || parseFloat(minimumPurchaseLimit) < 0) {
            req.flash('error', 'Invalid or missing value for the Minimum Purchase Limit field.');
            return res.redirect('/admin/coupon-add');
        }

        // Validate data type for validFrom and convert it to a Date object
        const validFromDate = validFrom ? new Date(validFrom) : new Date();
        if (validFrom && !(validFromDate instanceof Date && !isNaN(validFromDate))) {
            req.flash('error', 'Invalid value for the Valid From field.');
            return res.redirect('/admin/coupon-add');
        }

        // Validate data type for validUpto and convert it to a Date object
        const validUptoDate = validUpto ? new Date(validUpto) : undefined;
        if (validUpto && !(validUptoDate instanceof Date && !isNaN(validUptoDate))) {
            req.flash('error', 'Invalid value for the Valid Upto field.');
            return res.redirect('/admin/coupon-add');
        }

        // Create a new coupon object
        const coupon = new Coupon({
            name,
            code,
            description,
            amount: parseFloat(amount),
            minimumPurchaseLimit: parseFloat(minimumPurchaseLimit),
            validFrom: validFromDate,
            validUpto: validUptoDate
        });

        // Save the new coupon to the database
        const couponData = await coupon.save();

        if (couponData) {
            req.flash('success', 'You have successfully added a new coupon.');
            return res.redirect('/admin/coupon-add');
        }
    } catch (error) {
        console.error(error.message);
        next(error);
    }
};

const couponListLoaderAdmin = async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const pageSize = 10; // Set the number of coupons to display per page

        const options = {
            page: page,
            limit: pageSize,
        };

        // Fetch all coupons where isDeleted is false using mongoose-paginate-v2
        const couponsData = await Coupon.paginate({ isDeleted: false }, options);

        res.render('./admin/coupon-list.ejs', {
            coupons: couponsData.docs,
            currentPage: couponsData.page,
            totalPages: couponsData.totalPages,
        });
    } catch (error) {
        console.error(error.message);
        next(error);
    }
};


const couponEditLoaderAdmin = async (req, res, next) => {
    try {

        const categoryId = req.params.couponId;

        if (!mongoose.Types.ObjectId.isValid(categoryId)) {
            const genericErrorMessage = 'Invalid coupon ID: ';
            const genericError = new Error(genericErrorMessage);
            genericError.status = 500;
            throw genericError;
        }
        const couponData = await Coupon.findById(categoryId);
        if (couponData) {
            res.render('./admin/coupon-edit.ejs', { coupon: couponData });
        } else {
            req.flash('error', 'Invalid coupon details');
            res.redirect('/admin/coupon-list');
        }
    } catch (error) {
        console.log(error.message);
        next(error)
    }
}

const couponEditHandlerAdmin = async (req, res, next) => {
    try {
        const couponId = req.params.couponId;


        if (!mongoose.Types.ObjectId.isValid(couponId)) {
            const genericErrorMessage = 'Invalid coupon ID: ';
            const genericError = new Error(genericErrorMessage);
            genericError.status = 500;
            throw genericError;
        }

        const {
            name,
            code,
            description,
            amount,
            minimumPurchaseLimit,
            validFrom,
            validUpto
        } = req.body;

        // Find the coupon by ID
        const coupon = await Coupon.findById(couponId);

        if (!coupon) {
            req.flash('error', 'Coupon not found.');
            return res.redirect('/admin/coupon-list');
        }

        // Validate that name is present and of string type
        if (!name || typeof name !== 'string') {
            req.flash('error', 'Invalid or missing value for the Name field.');
            return res.redirect(`/admin/coupon-edit/${couponId}`);
        }

        // Validate that code is present and of string type
        if (!code || typeof code !== 'string') {
            req.flash('error', 'Invalid or missing value for the Code field.');
            return res.redirect(`/admin/coupon-edit/${couponId}`);
        }

        // Validate that description is present and of string type
        if (!description || typeof description !== 'string') {
            req.flash('error', 'Invalid or missing value for the Description field.');
            return res.redirect(`/admin/coupon-edit/${couponId}`);
        }

        // Validate that amount is present, a number, and greater than 0
        if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
            req.flash('error', 'Invalid or missing value for the Amount field.');
            return res.redirect(`/admin/coupon-edit/${couponId}`);
        }

        // Validate that minimumPurchaseLimit is present, a number, and greater than or equal to 0
        if (!minimumPurchaseLimit || isNaN(parseFloat(minimumPurchaseLimit)) || parseFloat(minimumPurchaseLimit) < 0) {
            req.flash('error', 'Invalid or missing value for the Minimum Purchase Limit field.');
            return res.redirect(`/admin/coupon-edit/${couponId}`);
        }

        // Validate data type for validFrom and convert it to a Date object
        const validFromDate = validFrom ? new Date(validFrom) : new Date();
        if (validFrom && !(validFromDate instanceof Date && !isNaN(validFromDate))) {
            req.flash('error', 'Invalid value for the Valid From field.');
            return res.redirect(`/admin/coupon-edit/${couponId}`);
        }

        // Validate data type for validUpto and convert it to a Date object
        const validUptoDate = validUpto ? new Date(validUpto) : undefined;
        if (validUpto && !(validUptoDate instanceof Date && !isNaN(validUptoDate))) {
            req.flash('error', 'Invalid value for the Valid Upto field.');
            return res.redirect(`/admin/coupon-edit/${couponId}`);
        }

        // Update the coupon fields
        coupon.name = name;
        coupon.code = code;
        coupon.description = description;
        coupon.amount = parseFloat(amount);
        coupon.minimumPurchaseLimit = parseFloat(minimumPurchaseLimit);
        coupon.validFrom = validFromDate;
        coupon.validUpto = validUptoDate;

        // Save the updated coupon to the database
        const updatedCoupon = await coupon.save();

        if (updatedCoupon) {
            req.flash('success', 'Coupon updated successfully.');
            return res.redirect('/admin/coupon-list');
        }
    } catch (error) {
        console.error(error.message);
        next(error);
    }
};


const applyCouponInCartHandler = async (req, res, next) => {
    try {
        console.log("reached the function")
        // Extract couponId from params
        const { couponId } = req.params;

         // Extract couponId from session
         const userId = req.session.userId;

        // Check if couponId is present
        if (!couponId) {
            console.log("No couponId")
            return res.status(400).json({ error: 'Coupon ID is required.' });
        }

        // Check if couponId is a valid ObjectId
        if (!mongoose.Types.ObjectId.isValid(couponId)) {
            console.log("invalid format couponId")
            return res.status(400).json({ error: 'Invalid Coupon ID.' });
        }

        // Find the coupon in the database
        const coupon = await Coupon.findById(couponId);

        // Check if the coupon exists
        if (!coupon) {
            console.log("No coupon with id in db")
            return res.status(404).json({ error: 'Coupon not found.' });
        }

        // Fetch the cart data for the current user
        const userCart = await getUpdatedCartPrice(userId);

        // Check if the user has a cart
        if (!userCart) {
            console.log("corresponding users cart not found")
            return res.status(404).json({ error: 'Cart not found for the user.' });
        }

         // Check if the coupon code is "WELCOME350"
         if (coupon.code === "WELCOME350") {
            // Check if it's the user's first purchase
            const user = await User.findById(userId);
            if (user && user.orders && user.orders.length > 0) {
                console.log("cannot use welcome coupon after first purchase")
                return res.status(400).json({ error: 'This coupon can only be used on the first purchase.' });
            }
        }

        // For other coupons
        if (userCart.totalAmount < coupon.minimumPurchaseLimit) {
            console.log("minimum purchase limit not met " +userCart.totalAmount + "   "+ coupon.minimumPurchaseLimit)
            return res.status(400).json({ error: 'Coupon is invalid for the current purchase.' });
        }

        if (new Date(coupon.validFrom) > Date.now()){
            console.log("coupon not yet activated ")
            return res.status(400).json({ error: 'Coupon is invalid for the current purchase.' });
        }

        if (coupon.validUpto && new Date(coupon.validUpto) < Date.now()){
            console.log("expired coupon ")
            return res.status(400).json({ error: 'Coupon is invalid for the current purchase.' });
        }

        // Apply the coupon logic here and update the cart's coupon details
        const couponUpdate = {
            $set: {
                'coupon.amount': coupon.amount,
                'coupon.code': coupon.code,
            }
        };

        // Save the updated cart with the applied coupon
        await Cart.updateOne({ user: userId }, couponUpdate);

        
        userCart.coupon = {
            amount: coupon.amount,
            code: coupon.code,
        }
        // Send a success response or additional data as needed
        return res.status(200).json({ message: 'Coupon applied successfully.', data: coupon , cart: userCart});

    } catch (error) {

        console.log('Error applying coupon:', error.message);
        // Send an error response to the client
        return res.status(500).json({ error: 'Internal Server Error.' });
    }
};

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
    couponAddLoaderAdmin,
    couponAddHandlerAdmin,
    couponListLoaderAdmin,
    couponEditLoaderAdmin,
    couponEditHandlerAdmin,
    applyCouponInCartHandler,
}