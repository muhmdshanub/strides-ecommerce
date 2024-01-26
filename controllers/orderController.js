const otpGenerator = require('otp-generator');
const mongoose = require('mongoose');
const easyinvoice = require('easyinvoice');
var fs = require("fs");
const moment = require('moment');
const User = require('../models/userModel');
const OTP = require('../models/otpModel');
const Address = require('../models/addressModel');
const Category = require('../models/categoryModel');
const Products = require('../models/productModel');
const Cart = require('../models/cartModel');
const Order = require('../models/orderModel');
const Wishlist = require('../models/wishlistModel');
const Payment = require('../models/paymentModel');
const Wallet = require('../models/walletModel')
const sendOtpEmail = require('../utils/sendEmail');
const bcrypt = require('bcrypt');
const razorpay = require('razorpay');
const crypto = require('crypto');
const { NetworkContextImpl } = require('twilio/lib/rest/supersim/v1/network');

async function getAllCategories() {
    try {
        const categories = await Category.find();
        return categories;
    } catch (error) {
        throw error;
    }
}


const profileOrdersLoader = async (req, res, next) => {
    try {
        const userId = req.session.userId;

        if (!userId) {
            console.log("corresponding user not found login");
            return res.status(403).json({ message: 'User not authenticated' });
        }

        // Pagination parameters
        const page = req.query.page || 1;
        const pageSize = 5; // Set your desired page size

        // Use aggregation to fetch orders with product and payment information
        const orders = await Order.aggregate([
            {
                $match: { user: new mongoose.Types.ObjectId(userId) }
            },
            {
                $lookup: {
                    from: 'products',
                    localField: 'product',
                    foreignField: '_id',
                    as: 'productInfo'
                }
            },
            {
                $unwind: '$productInfo'
            },
            {
                $lookup: {
                    from: 'payments',
                    localField: '_id',
                    foreignField: 'orders',
                    as: 'paymentInfo'
                }
            },
            {
                $unwind: {
                    path: '$paymentInfo',
                    preserveNullAndEmptyArrays: true
                }
            },
            {
                $set: {
                    'product': {
                        _id: '$productInfo._id',
                        images: {
                            image1: '$productInfo.images.image1.name'
                        },
                        // Add other product fields as needed
                    },
                    'payment': {
                        paymentMethod: '$paymentInfo.paymentMethod',
                        
                    }
                }
            },
            {
                $unset: ['productInfo', 'paymentInfo']
            },
            {
                $sort: { orderDate: -1 }
            },
        ]);

        const totalOrdersCount = orders.length;

        // Use a separate aggregation to count total orders (for efficiency)
        const totalOrdersCountResult = await Order.aggregate([
            {
                $match: { user: new mongoose.Types.ObjectId(userId) }
            },
            {
                $count: 'total'
            }
        ]);

        const totalOrders = totalOrdersCountResult.length > 0 ? totalOrdersCountResult[0].total : 0;

        const categoriesData = await getAllCategories();

        // Render the payment-selection page with the paginated orders, total pages, and current page
        res.render('./user/profile/orders.ejs', {
            orders: orders.slice((page - 1) * pageSize, page * pageSize),
            categories: categoriesData,
            currentPage: parseInt(page),
            totalPages: Math.ceil(totalOrders / pageSize)
        });

    } catch (error) {
        console.log(error.message);
        next(error)
    }
}


const profileOrdersCancelHandler = async (req, res, next) => {

    let mongooseSession;

    try {

        mongooseSession = await mongoose.startSession(); // Create a new session
        mongooseSession.startTransaction(); // Start a transaction


        const orderId = req.params.orderId;
        const userId = req.session.userId;

        if (!mongoose.Types.ObjectId.isValid(orderId)) {
            const genericErrorMessage = 'Invalid order ID: ';
            const genericError = new Error(genericErrorMessage);
            genericError.status = 500;
            throw genericError;
        }
        // Check if the orderId belongs to the userId in the collection document
        const order = await Order.findOne({ _id: orderId, user: userId });

        if (!order) {
            const genericErrorMessage = 'order not found: ' + error.message;
            const genericError = new Error(genericErrorMessage);
            genericError.status = 404;
            throw genericError;
        }

        // Check if the current status is 'Placed'
        if (order.status !== 'Placed') {

            const genericErrorMessage = 'Cannot cancel the order right now. : ';
            const genericError = new Error(genericErrorMessage);
            genericError.status = 400;
            throw genericError;
        }




        const paymentUpdate = await Payment.findOneAndUpdate(
            { orders: { $elemMatch: { $in: [orderId] } } },
            { $inc: { totalAmount: -order.totalFinalAmount } },
            { new: true }
        );

        const productUpdate = await Products.findOneAndUpdate(
            { _id: order.product },
            {
                $inc: {
                    [`sizes[0].${order.size}.availableStock`]: order.quantity,
                    [`sizes[0].${order.size}.soldStock`]: -order.quantity,
                },
            },
            { mongooseSession }
        );

        let walletUpdate;

        if (paymentUpdate.paymentMethod !== "Cash on Delivery") {
            // Add the amount to the wallet balance
            walletUpdate = await Wallet.findOneAndUpdate(
                { user: userId },
                {
                    $inc: {
                        balance: order.totalFinalAmount,
                    },
                    $push: {
                        transactions: {
                            type: 'credit',
                            amount: order.totalFinalAmount,
                            description: 'refund money received',
                        },
                    },
                },
                { new: true, mongooseSession }
            );
        }

        // Change the status of the document to 'Cancelled'
        order.status = 'Cancelled';
        const updatedOrder = await order.save({ mongooseSession });

        await mongooseSession.commitTransaction();
        mongooseSession.endSession();

        // Send back the new updated order details to the client
        res.json({ message: 'Order cancelled successfully', order: updatedOrder });
    } catch (error) {
        console.error('Error cancelling order:', error);
        await mongooseSession.abortTransaction();
        mongooseSession.endSession();
        next(error)
    }
};

const profileOrdersReturnHandler = async (req, res, next) => {

    let mongooseSession;

    try {

        mongooseSession = await mongoose.startSession(); // Create a new session
        mongooseSession.startTransaction(); // Start a transaction


        const orderId = req.params.orderId;
        const userId = req.session.userId;


        if (!mongoose.Types.ObjectId.isValid(orderId)) {
            const genericErrorMessage = 'Invalid order ID: ';
            const genericError = new Error(genericErrorMessage);
            genericError.status = 500;
            throw genericError;
        }

        // Check if the orderId belongs to the userId in the collection document
        const order = await Order.findOne({ _id: orderId, user: userId });

        if (!order) {
            return res.status(404).json({ message: 'Order not found for the user' });
        }
        if (order.deliveredDate) {
            deliveredDate = new Date(order.deliveredDate);
            currentDate = new Date();
            daysDifference = Math.abs(deliveredDate - currentDate) / (1000 * 60 * 60 * 24);

            // Check if the current status is 'Delivered'
            if (order.status === 'Delivered' && daysDifference <= 10) {

                const paymentUpdate = await Payment.findOneAndUpdate(
                    { orders: { $elemMatch: { $in: [orderId] } } },
                    { $inc: { totalAmount: -order.totalFinalAmount } },
                    { new: true, mongooseSession }
                );

                const productUpdate = await Products.findOneAndUpdate(
                    { _id: order.product },
                    {
                        $inc: {
                            [`sizes[0].${order.size}.availableStock`]: order.quantity,
                            [`sizes[0].${order.size}.soldStock`]: -order.quantity,
                        },
                    },
                    { mongooseSession }
                );

                // Add the amount to the wallet balance
                const walletUpdate = await Wallet.findOneAndUpdate(
                    { user: userId },
                    {
                        $inc: {
                            balance: order.totalFinalAmount,
                        },
                        $push: {
                            transactions: {
                                type: 'credit',
                                amount: order.totalFinalAmount,
                                description: 'refund money received',
                            },
                        },
                    },
                    { new: true, mongooseSession }
                );

                // Change the status of the document to 'Cancelled'
                order.status = 'Returned';
                const updatedOrder = await order.save();

                await mongooseSession.commitTransaction();
                mongooseSession.endSession();

                // Send back the new updated order details to the client
                if (paymentUpdate && productUpdate && walletUpdate && updatedOrder) {
                    res.json({ message: 'Order returned successfully', order: updatedOrder });
                }


            } else {
                await mongooseSession.commitTransaction();
                mongooseSession.endSession();
                return res.status(400).json({ message: 'Cannot return the order. Either the order status is not "Delivered" or the return period has expired.' });


            }
        }


    } catch (error) {
        console.error('Error returning order:', error);
        await mongooseSession.commitTransaction();
        mongooseSession.endSession();
        next(error)
    }
};


const codPlaceOrderHandler = async (req, res, next) => {
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
            req.flash('error', 'unauthenticated user ID.')
            return res.redirect('/home')
        }

        if (!addressId) {
            console.log("no valid addressId on url")
            req.flash('error', 'No valid address selected.')
            return res.redirect('/address')
        }

        // Find the user document
        const user = await User.findOne({ _id: userId });

        if (!user) {
            console.log("user not found on user collection")
            req.flash('error', 'User not found.');
            return res.redirect('/home');
        }

        // Check if the given addressId exists in the user's addresses
        const selectedAddressIndex = user.addresses.findIndex(address => address._id.toString() === addressId);

        if (selectedAddressIndex === -1) {
            console.log("Invalid address selected")
            req.flash('error', 'Invalid address selected.');
            return res.redirect('/address');
        }

        // If the selected address is not already at the 0th index, swap it
        if (selectedAddressIndex !== 0) {
            // Swap the addresses
            const temp = user.addresses[0];
            user.addresses[0] = user.addresses[selectedAddressIndex];
            user.addresses[selectedAddressIndex] = temp;

            // Save the updated user document
            userUpdate = await user.save();
        }


        // Fetch the cart data for the current user
        const cart = await getUpdatedCartPrice(userId);

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
                req.flash('error', "You have some invalid coupon atatched to cart. We have resetted it for you.")
                return res.redirect('/cart');
            }
        }

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


        cart.totalDiscountAmount = parseFloat(cart.totalInitialAmount - cart.totalAmount).toFixed(2);

        if (invalidItems.length > 0) {
            const categories = await getAllCategories();
            // If there are invalid items, redirect to the cart page with the invalid items
            req.flash('error', "You have some invalid items in your cart. Please click On the MOVE TO ADDDRESS button to know more.")
            return res.render('./user/cart', { invalidItems, cart, categories });
        }

        //updating the order model

        // Populate the shipping address details
        const populatedAddress = await Address.findById(user.addresses[0]);

        // Create an array to store the promises of saving each order
        const orderPromises = [];

        // Iterate through each item in the cart
        cart.items.forEach(item => {
            // Adjust totalFinalAmount based on the coupon amount
            item.totalFinalAmount = item.totalAmount - (cart.coupon ? cart.coupon.amount / cart.totalItems : 0);

            // Create an order document for the current item
            const order = new Order({
                user: userId,
                userName: user.name,
                address: populatedAddress,
                product: item.product._id,
                productName: item.product.productName,
                brandName: item.product.brandName,
                size: item.size,
                quantity: item.quantity,
                totalFinalAmount: item.totalFinalAmount, // Use the adjusted value here
                totalInitialMrp: item.totalInitialAmount,
            });

            // Save the order document and push the promise to the array
            orderPromises.push(order.save());
        });

        // Use Promise.all to wait for all order promises to resolve
        const orderUpdates = await Promise.all(orderPromises);

        // Extract the order IDs from the saved orders
        const orderIds = orderUpdates.map(order => order._id);

        // Update the user document with the order IDs
        await User.findByIdAndUpdate(userId, { $push: { orders: { $each: orderIds } } });

        //update payment collection

        // Calculate totalAmount for Payment document based on adjusted item.totalFinalAmount
        const totalAmountAfterCoupon = cart.totalAmount - (cart.coupon ? cart.coupon.amount : 0);

        const payment = new Payment({
            user: userId,
            paymentMethod: 'Cash on Delivery',
            orders: orderUpdates.map(order => order._id),
            totalAmount: totalAmountAfterCoupon, // Use the adjusted value here
        });

        // Save the Payment document
        const paymentUpdate = await payment.save();

        // update product collection

        // Update product quantities based on the items in the cart
        for (const item of cart.items) {
            const product = item.product;
            const selectedSize = item.size;

            // Assuming sizes array has only one element
            const stockSchema = product.sizes[0];

            // Deduct the quantity from the available stock
            if (selectedSize in stockSchema) {
                stockSchema[selectedSize].availableStock -= item.quantity;
                stockSchema[selectedSize].soldStock += item.quantity;
            } else {
                // Handle the case where the selected size is not valid
                invalidItems.push({
                    // ... Include details of the invalid item ...
                    reason: 'Invalid size',
                });
            }

            // Increment the popularity field by 1
            product.popularity += 1;
        }

        // Save the updated product details to the database
        const productUpdate = await Products.bulkWrite(cart.items.map(item => ({
            updateOne: {
                filter: { _id: item.product._id },
                update: { $set: { sizes: item.product.sizes, popularity: item.product.popularity } },
            },
        })));

        if (orderUpdates && productUpdate && paymentUpdate) {
            // If all updates are successful, remove the cart items


            const cartEmptyUpdate = {
                $set: {
                    'items': [],
                    'totalItems': 0,
                    'coupon.code': "",
                    'coupon.amount': 0,
                }
            };

            // Save the updated cart with the applied coupon
            cartUpdate = await Cart.updateOne({ user: userId }, cartEmptyUpdate);
        }

        if (cartUpdate) {


            res.redirect(`/order-confirm/${paymentUpdate._id}`);
        }


    } catch (error) {
        console.log(error.message);
        next(error)
    }
}

const placeOrderByWalletHandler = async (req, res, next) => {
    try {


        const userId = req.session.userId;
        const addressId = req.params.addressId;

        if (!mongoose.Types.ObjectId.isValid(addressId)) {
            console.log("address id is invalid")
            const genericErrorMessage = 'Invalid address ID: ';
            const genericError = new Error(genericErrorMessage);
            genericError.status = 500;
            throw genericError;
        }

        if (!userId) {
            console.log("no valid userID on session")
            req.flash('error', 'unauthenticated user ID.')
            return res.redirect('/home')
        }

        if (!addressId) {
            console.log("no valid addressId on url")
            req.flash('error', 'No valid address selected.')
            return res.redirect('/address')
        }

        // Find the user document
        const user = await User.findOne({ _id: userId });

        if (!user) {
            console.log("user not found on user collection")
            req.flash('error', 'User not found.');
            return res.redirect('/home');
        }

        // Find the user document
        const wallet = await Wallet.findOne({ user: userId });

        // Check if the wallet exists
        if (!wallet) {
            console.log("corresponding wallet not found")
            const walletNotFoundMessage = 'Wallet not found for the user';
            const walletNotFoundError = new Error(walletNotFoundMessage);
            walletNotFoundError.status = 404;
            throw walletNotFoundError;
        }

        // Check if the given addressId exists in the user's addresses
        const selectedAddressIndex = user.addresses.findIndex(address => address._id.toString() === addressId);

        if (selectedAddressIndex === -1) {
            console.log("Invalid address selected")
            req.flash('error', 'Invalid address selected.');
            return res.redirect('/address');
        }

        // If the selected address is not already at the 0th index, swap it
        if (selectedAddressIndex !== 0) {
            // Swap the addresses
            const temp = user.addresses[0];
            user.addresses[0] = user.addresses[selectedAddressIndex];
            user.addresses[selectedAddressIndex] = temp;

            // Save the updated user document
            userUpdate = await user.save();
        }


        // Fetch user's cart details
        const cart = await getUpdatedCartPrice(userId);


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
                req.flash('error', "You have some invalid coupon atatched to cart. We have resetted it for you.")
                return res.redirect('/cart');
            }
        }

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

        // Calculate total price details for the cart
        cart.totalDiscountAmount = parseFloat(cart.totalInitialAmount - cart.totalAmount).toFixed(2);

        if (invalidItems.length > 0) {
            console.log("invalid items in cart")
            const categories = await getAllCategories();
            // If there are invalid items, redirect to the cart page with the invalid items
            req.flash('error', "You have some invalid items in your cart. Please click On the MOVE TO ADDDRESS button to know more.")
            return res.render('./user/cart', { invalidItems, cart, categories });
        }

        // Check if wallet balance is sufficient
        const amountToDeduct = cart.totalAmount - (cart.coupon ? cart.coupon.amount : 0);

        if (amountToDeduct > parseFloat(wallet.balance)) {
            console.log("not enough money in wallet")
            const walletNotEnoughMessage = 'Insufficient balance in the wallet';
            const walletNotEnoughError = new Error(walletNotEnoughMessage);
            walletNotEnoughError.status = 404;
            throw walletNotEnoughError;
        }

        // Reduce the amount from the wallet and save
        wallet.balance -= amountToDeduct;

        // Add a transaction to the transactions array with the current date
        wallet.transactions.push({
            type: 'debit',
            amount: amountToDeduct,
            description: 'product purchased',
            date: new Date(),
        });

        const walletUpdate = wallet.save();

        // Populate the shipping address details
        const populatedAddress = await Address.findById(user.addresses[0]);

        // Create an array to store the promises of saving each order
        const orderPromises = [];

        // Iterate through each item in the cart
        cart.items.forEach(item => {
            // Adjust totalFinalAmount based on the coupon amount
            item.totalFinalAmount = item.totalAmount - (cart.coupon ? cart.coupon.amount / cart.totalItems : 0);

            // Create an order document for the current item
            const order = new Order({
                user: userId,
                userName: user.name,
                address: populatedAddress,
                product: item.product._id,
                productName: item.product.productName,
                brandName: item.product.brandName,
                size: item.size,
                quantity: item.quantity,
                totalFinalAmount: item.totalFinalAmount, // Use the adjusted value here
                totalInitialMrp: item.totalInitialAmount,
            });

            // Save the order document and push the promise to the array
            orderPromises.push(order.save());
        });

        // Use Promise.all to wait for all order promises to resolve
        const orderUpdates = await Promise.all(orderPromises);

        // Extract the order IDs from the saved orders
        const orderIds = orderUpdates.map(order => order._id);

        // Update the user document with the order IDs
        await User.findByIdAndUpdate(userId, { $push: { orders: { $each: orderIds } } });

        //update payment collection

        // Calculate totalAmount for Payment document based on adjusted item.totalFinalAmount
        const totalAmountAfterCoupon = cart.totalAmount - (cart.coupon ? cart.coupon.amount : 0);

        const payment = new Payment({
            user: userId,
            paymentMethod: 'Wallet Payment',
            orders: orderUpdates.map(order => order._id),
            totalAmount: totalAmountAfterCoupon, // Use the adjusted value here
        });

        // Save the Payment document
        const paymentUpdate = await payment.save();





        // update product collection

        // Update product quantities based on the items in the cart
        for (const item of cart.items) {
            const product = item.product;
            const selectedSize = item.size;

            // Assuming sizes array has only one element
            const stockSchema = product.sizes[0];

            // Deduct the quantity from the available stock
            if (selectedSize in stockSchema) {
                stockSchema[selectedSize].availableStock -= item.quantity;
                stockSchema[selectedSize].soldStock += item.quantity;
            } else {
                // Handle the case where the selected size is not valid
                invalidItems.push({
                    // ... Include details of the invalid item ...
                    reason: 'Invalid size',
                });
            }

            // Increment the popularity field by 1
            product.popularity += 1;
        }

        // Save the updated product details to the database
        const productUpdate = await Products.bulkWrite(cart.items.map(item => ({
            updateOne: {
                filter: { _id: item.product._id },
                update: { $set: { sizes: item.product.sizes, popularity: item.product.popularity } },
            },
        })));

        if (orderUpdates && productUpdate && paymentUpdate && walletUpdate) {
            // If all updates are successful, remove the cart items
            const cartEmptyUpdate = {
                $set: {
                    'items': [],
                    'totalItems': 0,
                    'coupon.code': "",
                    'coupon.amount': 0,
                }
            };

            // Save the updated cart with the applied coupon
            cartUpdate = await Cart.updateOne({ user: userId }, cartEmptyUpdate);
        }

        if (cartUpdate) {


            return res.json({ success: true, paymentDBId: paymentUpdate._id });
        }


    } catch (error) {
        console.log(error.message);
        next(error)
    }
}

const razorpayPlaceOrderHandler = async (req, res, next) => {
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
            req.flash('error', 'unauthenticated user ID.')
            return res.redirect('/home')
        }

        if (!addressId) {
            console.log("no valid addressId on url")
            req.flash('error', 'No valid address selected.')
            return res.redirect('/address')
        }

        // Find the user document
        const user = await User.findOne({ _id: userId });

        if (!user) {
            console.log("user not found on user collection")
            req.flash('error', 'User not found.');
            return res.redirect('/home');
        }

        // Check if the given addressId exists in the user's addresses
        const selectedAddressIndex = user.addresses.findIndex(address => address._id.toString() === addressId);

        if (selectedAddressIndex === -1) {
            console.log("Invalid address selected")
            req.flash('error', 'Invalid address selected.');
            return res.redirect('/address');
        }

        // If the selected address is not already at the 0th index, swap it
        if (selectedAddressIndex !== 0) {
            // Swap the addresses
            const temp = user.addresses[0];
            user.addresses[0] = user.addresses[selectedAddressIndex];
            user.addresses[selectedAddressIndex] = temp;

            // Save the updated user document
            userUpdate = await user.save();
        }


        // Fetch user's cart details
        let cart = await getUpdatedCartPrice(userId);

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
                req.flash('error', "You have some invalid coupon atatched to cart. We have resetted it for you.")
                return res.redirect('/cart');
            }
        }

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

        // Calculate total price details for the cart
        cart.totalDiscountAmount = parseFloat(cart.totalInitialAmount - cart.totalAmount).toFixed(2);

        if (invalidItems.length > 0) {
            const categories = await getAllCategories();
            // If there are invalid items, redirect to the cart page with the invalid items
            req.flash('error', "You have some invalid items in your cart. Please click On the MOVE TO ADDDRESS button to know more.")
            return res.render('./user/cart', { invalidItems, cart, categories });
        }

        // Store order and payment data in session
        req.session.orderData = {
            order: {
                user: userId,
                userName: user.name,
                address: user.addresses[0], // Use the address ID or details as needed
                product: cart.items.map(item => ({
                    productId: item.product._id,
                    productName: item.product.productName,
                    brandName: item.product.brandName,
                    size: item.size,
                    quantity: item.quantity,
                    totalFinalAmount: item.totalAmount - (cart.coupon ? cart.coupon.amount / cart.totalItems : 0),
                    totalInitialMrp: item.totalInitialAmount,
                })),
            },
            payment: {
                user: userId,
                paymentMethod: 'RazorPay Payment', // Update this if payment method changes
                totalAmount: cart.totalAmount - (cart.coupon.amount ? cart.coupon.amount : 0),
            },
        };

        var instance = new razorpay({ key_id: process.env.RAZORPAY_KEY_ID, key_secret: process.env.RAZORPAY_KEY_SECRET })



        const order = await instance.orders.create({
            amount: req.session.orderData.payment.totalAmount * 100,
            currency: "INR",
            receipt: "receipt"
        })

        req.session.orderData.razorPayOrderId = order.id;

        res.json({ order, success: true });

    } catch (error) {
        console.log(error.message + "here");
        next(error)
    }
}

const razorpayVerifyPaymentHandler = async (req, res) => {

    try {

        const razorPayOrderId = req.params.razorpay_order_id;
        const razorPayPaymentId = req.body.payment_id;
        const razorPaySignature = req.body.razorpay_signature;

        const userId = req.session.userId;

        // Find the user document
        const user = await User.findOne({ _id: userId });

        if (!user) {
            console.log("user not found on user collection")
            req.flash('error', 'User not found.');
            return res.redirect('/home');
        }


        // Check if orderData is present in the session
        if (!req.session.orderData) {
            console.log("req.session.orderData is not found")
            return res.json({ success: false, error: 'Order data not found in session' });
        }

        // Extract necessary data from orderData
        const { order, payment } = req.session.orderData;

        if (!order || !payment) {
            console.log("order and payment is not found in req.session.orderData ")
            return res.json({ success: false, error: 'Incomplete order data in session' });
        }

        var instance = new razorpay({ key_id: process.env.RAZORPAY_KEY_ID, key_secret: process.env.RAZORPAY_KEY_SECRET });

        // Verify payment with Razorpay
        const paymentVerificationResponse = await instance.payments.fetch(razorPayPaymentId);

        if (paymentVerificationResponse && paymentVerificationResponse.status === 'captured') {

            // Check if the payment amount matches the expected amount
            const expectedAmount = req.session.orderData.payment.totalAmount * 100;
            const actualAmount = paymentVerificationResponse.amount;


            // **Signature verification using Razorpay's secret key:**
            const expectedSignature = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
                .update(`${razorPayOrderId}|${razorPayPaymentId}`)
                .digest('hex');

            if (expectedSignature !== razorPaySignature) {
                console.error('Signature verification failed');
                return res.json({ success: false, error: 'Invalid signature' });
            }

            if (expectedAmount !== actualAmount) {
                console.log("Amount does not matches ")
                return res.json({ success: false, error: 'Payment amount mismatch' });
            }

            // Check if the Razorpay Payment ID and Order ID already exist in the Payment collection
            const existingPayment = await Payment.findOne({
                $or: [
                    { 'transactions.razorpayPaymentId': razorPayPaymentId },
                    { 'transactions.razorpayOrderId': razorPayOrderId },
                    { 'transactions.razorpaySignature': razorPaySignature },
                ],
            });

            if (existingPayment) {
                console.log("This is an already existing payment ")
                return res.json({ success: false, error: 'Payment already processed' });
            }

            const existingTransaction = await Wallet.findOne({
                $or: [
                    { 'transactions.razorpayPaymentId': razorPayPaymentId },
                    { 'transactions.razorpayOrderId': razorPayOrderId },
                    { 'transactions.razorpaySignature': razorPaySignature },
                ],
            });

            if (existingTransaction) {
                console.log("This is an already existing wallet transaction ")
                return res.json({ success: false, error: 'Transaction already processed' });
            }

            // Populate the shipping address details
            const populatedAddress = await Address.findById(user.addresses[0]);

            // Now, let's create order documents for each product in the orderData
            const orderPromises = req.session.orderData.order.product.map(async (item) => {
                try {
                    // Create an order document for the current item
                    const order = new Order({
                        user: req.session.orderData.order.user,
                        userName: req.session.orderData.order.userName,
                        address: populatedAddress,
                        product: item.productId,
                        productName: item.productName,
                        brandName: item.brandName,
                        size: item.size,
                        quantity: item.quantity,
                        totalFinalAmount: item.totalFinalAmount,
                        totalInitialMrp: item.totalInitialMrp,
                        // Add other fields as needed
                    });

                    // Save the order document
                    const savedOrder = await order.save();

                    return savedOrder;
                } catch (error) {
                    console.error('Error creating order document:', error);
                    throw error;
                }
            });

            // Use Promise.all to wait for all order promises to resolve
            const orderUpdates = await Promise.all(orderPromises);

            // Extract the order IDs from the saved orders
            const orderIds = orderUpdates.map(order => order._id);

            // Update the user document with the order IDs
            await User.findByIdAndUpdate(userId, { $push: { orders: { $each: orderIds } } });


            const payment = new Payment({
                user: req.session.orderData.payment.user,
                paymentMethod: req.session.orderData.payment.paymentMethod,
                orders: orderUpdates.map(order => order._id),
                totalAmount: req.session.orderData.payment.totalAmount,
                razorpayPaymentId: razorPayPaymentId,
                razorpayOrderId: razorPayOrderId,
                razorpaySignature: razorPaySignature,
            });

            // Save the Payment document
            const paymentUpdate = await payment.save();

            // Fetch user's cart details
            const cart = await getUpdatedCartPrice(userId);

            // Update product quantities based on the items in the cart
            for (const item of cart.items) {
                const product = item.product;
                const selectedSize = item.size;

                // Assuming sizes array has only one element
                const stockSchema = product.sizes[0];

                // Deduct the quantity from the available stock
                if (selectedSize in stockSchema) {
                    stockSchema[selectedSize].availableStock -= item.quantity;
                    stockSchema[selectedSize].soldStock += item.quantity;
                } else {
                    // Handle the case where the selected size is not valid
                    invalidItems.push({
                        // ... Include details of the invalid item ...
                        reason: 'Invalid size',
                    });
                }

                // Increment the popularity field by 1
                product.popularity += 1;
            }

            // Save the updated product details to the database
            const productUpdate = await Products.bulkWrite(cart.items.map(item => ({
                updateOne: {
                    filter: { _id: item.product._id },
                    update: { $set: { sizes: item.product.sizes, popularity: item.product.popularity } },
                },
            })));

            if (orderUpdates && productUpdate && paymentUpdate) {
                // If all updates are successful, remove the cart items
                const cartEmptyUpdate = {
                    $set: {
                        'items': [],
                        'totalItems': 0,
                        'coupon.code': "",
                        'coupon.amount': 0,
                    }
                };

                // Save the updated cart with the applied coupon
                cartUpdate = await Cart.updateOne({ user: userId }, cartEmptyUpdate);
            }

            if (cartUpdate) {

                req.session.orderData = null;

                return res.json({ success: true, paymentDBId: paymentUpdate._id });
            }


        } else {
            console.log("payment verification response is not okay or not equals to capture")
            // Payment verification failed
            return res.json({ success: false, error: 'Payment verification failed' });
        }
    } catch (error) {
        console.error('Error during payment verification:', error);
        return res.json({ success: false, error: 'Internal server error' });
    }

}

const ordersListLoaderAdmin = async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const pageSize = parseInt(req.query.pageSize) || 10;

        const options = {
            page: page,
            limit: pageSize,
            sort: { orderDate: -1 },
            populate: {
                path: 'product',
                select: '_id images.image1.name', // Specify the fields to populate
            },
        };

        const ordersData = await Order.paginate({}, options);

        res.render('./admin/orderList.ejs', {
            orders: ordersData.docs,
            currentPage: ordersData.page,
            totalPages: ordersData.totalPages,
        });
    } catch {
        console.error('Error loading order list:', error);
        next(error)
    }
}

const orderStatusUpdateHandlerAdmin = async (req, res, next) => {
    try {
        // Extract values from the request body
        const { orderId, newStatus } = req.body;
        const userId = req.session.userId;

        // Check if orderId and newStatus are present in the request body
        if (!orderId || !newStatus) {
            return res.status(400).json({ message: 'Missing orderId or newStatus in the request body' });
        }

        if (!mongoose.Types.ObjectId.isValid(orderId)) {
            const genericErrorMessage = 'Invalid order ID: ';
            const genericError = new Error(genericErrorMessage);
            genericError.status = 500;
            throw genericError;
        }

        // Find the corresponding order
        const order = await Order.findById(orderId);

        // If no order found, send a response
        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }

        //check if wrong status change requested by user
        const prevStatus = order.status;

        if (prevStatus === "Cancelled" && newStatus === "Placed") {
            return res.status(404).json({ message: 'Invalid operation. Cannot Proceed with status change.' });
        }

        if (prevStatus === "Delivered" && (newStatus === "Placed" || newStatus === "Cancelled")) {
            return res.status(404).json({ message: 'Invalid operation. Cannot Proceed with status change.' });
        }

        if (prevStatus === "Returned" && (newStatus === "Placed" || newStatus === "Cancelled" || newStatus === "Delivered")) {
            return res.status(404).json({ message: 'Invalid operation. Cannot Proceed with status change.' });
        }

        if (prevStatus === "Return received" && (newStatus === "Placed" || newStatus === "Cancelled" || newStatus === "Delivered" || newStatus === "Returned")) {
            return res.status(404).json({ message: 'Invalid operation. Cannot Proceed with status change.' });
        }

        if (prevStatus === newStatus) {
            // Send back a success response with the updated order details
            res.status(200).json({ message: 'Order status updated successfully', order: order });
        }

        // Update the status field and save
        order.status = newStatus;

        // If the new status is 'Placed', update the orderDate with the current date
        if (newStatus === 'Placed') {
            order.orderDate = Date.now();
        }

        // If the new status is 'Delivered', update the deliveredDate with the current date
        if (newStatus === 'Delivered') {
            order.deliveredDate = Date.now();
        }

        // Save the changes
        await order.save();

        if (newStatus === 'Cancelled' && prevStatus === "Placed") {
            mongooseSession = await mongoose.startSession(); // Create a new session
            mongooseSession.startTransaction(); // Start a transaction


            const paymentUpdate = await Payment.findOneAndUpdate(
                { orders: { $elemMatch: { $in: [orderId] } } },
                { $inc: { totalAmount: -order.totalFinalAmount } },
                { new: true }
            );

            const productUpdate = await Products.findOneAndUpdate(
                { _id: order.product },
                {
                    $inc: {
                        [`sizes[0].${order.size}.availableStock`]: order.quantity,
                        [`sizes[0].${order.size}.soldStock`]: -order.quantity,
                    },
                },
                { mongooseSession }
            );

            let walletUpdate;

            if (paymentUpdate.paymentMethod !== "Cash on Delivery") {
                // Add the amount to the wallet balance
                walletUpdate = await Wallet.findOneAndUpdate(
                    { user: userId },
                    {
                        $inc: {
                            balance: order.totalFinalAmount,
                        },
                        $push: {
                            transactions: {
                                type: 'credit',
                                amount: order.totalFinalAmount,
                                description: 'refund money received',
                            },
                        },
                    },
                    { new: true, mongooseSession }
                );
            }

            await mongooseSession.commitTransaction();
            mongooseSession.endSession();

        }

        if (newStatus === 'Returned' && prevStatus === "Delivered") {

            mongooseSession = await mongoose.startSession(); // Create a new session
            mongooseSession.startTransaction(); // Start a transaction




            const paymentUpdate = await Payment.findOneAndUpdate(
                { orders: { $elemMatch: { $in: [orderId] } } },
                { $inc: { totalAmount: -order.totalFinalAmount } },
                { new: true, mongooseSession }
            );

            const productUpdate = await Products.findOneAndUpdate(
                { _id: order.product },
                {
                    $inc: {
                        [`sizes[0].${order.size}.availableStock`]: order.quantity,
                        [`sizes[0].${order.size}.soldStock`]: -order.quantity,
                    },
                },
                { mongooseSession }
            );

            // Add the amount to the wallet balance
            const walletUpdate = await Wallet.findOneAndUpdate(
                { user: userId },
                {
                    $inc: {
                        balance: order.totalFinalAmount,
                    },
                    $push: {
                        transactions: {
                            type: 'credit',
                            amount: order.totalFinalAmount,
                            description: 'refund money received',
                        },
                    },
                },
                { new: true, mongooseSession }
            );

            await mongooseSession.commitTransaction();
            mongooseSession.endSession();
        }

        // Send back a success response with the updated order details
        res.status(200).json({ message: 'Order status updated successfully', order: order });
    } catch (error) {
        console.error('Error updating order status:', error.message);
        next(error)
    }
};



const generateInvoiceHandler = async (req, res, next) => {
    try {
        console.log("entered the invoice handler");

        const orderId = req.body.orderId;
        if (!orderId) {
            return res.status(400).json({ message: 'Missing orderId in the request body' });
        }

        const order = await Order.findById(orderId);

        if (!order) {
            return res.status(400).json({ message: 'Missing orderId in the request body' });
        }

        if (order.deliveredDate && order.status === "Delivered") {
            deliveredDate = new Date(order.deliveredDate);
            currentDate = new Date();
            daysDifference = Math.abs(deliveredDate - currentDate) / (1000 * 60 * 60 * 24);
        }

        if (daysDifference <= 10) {
            return res.status(400).json({ message: 'Order is not valid for invoice generation yet.' });
        }

        const formatDate = (date) => {
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        };

        const data = {
            sender: {
                company: 'Strides E-commerce',
                address: '123 Main Street, Suite 456',
                zip: 'Cityville, State 12345',
                city: 'India',
                country: 'Phone: 8157882661'
            },
            client: {
                company: order.address.name,
                city: order.address.city,
                state: order.address.state,
                zip: order.address.zipCode,
            },
            images: {
                logo: fs.readFileSync('./public/images/logo.jpg', 'base64'),
            },
            information: {

                date: formatDate(new Date(order.deliveredDate)),
            },
            products: [
                {
                    description: `${order.brandName}_${order.productName}, \t size : ${order.size}`,
                    quantity: order.quantity,
                    price: parseFloat(order.totalFinalAmount / order.quantity),
                    "tax-rate": parseFloat(0),
                }
            ],
            settings: {
                currency: 'INR',

            }
        };

        // Create your invoice! Easy!
        easyinvoice.createInvoice(data, function (result) {
            console.log("invoice created");
            // The response will contain a base64 encoded PDF file
            const pdfBase64 = result.pdf;

            // Send the PDF as a response
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', 'attachment; filename=invoice.pdf');
            res.send(Buffer.from(pdfBase64, 'base64'));
        });

    } catch (error) {
        console.error(error.message);
        next(error);
    }
};

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', reason.stack || reason);
    // Recommended: send the information to a service like Sentry
    // promise.catch((err) => console.error('Promise rejection error:', err));
});

// Handle unhandled exceptions
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error.stack || error);
    // Recommended: send the information to a service like Sentry
    // process.exit(1); // Ensure process exits after uncaught exception
});

const generateSalesReportHandler = async (req, res, next) => {
    try {

        // Check if both startDate and endDate are present
        if (!req.query.startDate || !req.query.endDate) {
            console.log("Both startDate and endDate are required.")
            return res.status(400).json({ error: 'Both startDate and endDate are required.' });
        }

        const isoStartDate = req.query.startDate;
        const isoEndDate = req.query.endDate;


        

        // // Function to validate ISO date format
        // function isValidISODate(dateString) {
        //     const regex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/;
        //     return regex.test(dateString);
        // }


        // // Validate ISO format for both dates
        // if (!isValidISODate(isoStartDate) || !isValidISODate(isoEndDate)) {

        //     console.log('Invalid date format. Please provide dates in ISO format.')
        //     return res.status(400).json({ error: 'Invalid date format. Please provide dates in ISO format.' });
        // }





        // Parse the dates and check if they are valid
        const updatedISOstartDate = new Date(isoStartDate);
        const updatedISOendDate = new Date(isoEndDate);


        

        // Set time to the start of the day for startDate
        updatedISOstartDate.setHours(0, 0, 0, 0);

        // Set time to the end of the day for endDate
        updatedISOendDate.setHours(23, 59, 59, 999);


        const result = await Order.aggregate([
            // Match orders within the date range
            { $match: { orderDate: { $gte: updatedISOstartDate, $lte: updatedISOendDate } } },

            // Lookup product details
            {
                $lookup: {
                    from: 'products',
                    localField: 'product',
                    foreignField: '_id',
                    as: 'productDetails',
                },
            },

            // Unwind the productDetails array
            { $unwind: '$productDetails' },

            // Group and count orders by gender and category
            {
                $group: {
                    _id: null,
                    totalOrders: { $sum: 1 },
                    successfulOrders: { $sum: { $cond: { if: { $eq: ['$status', 'Delivered'] }, then: 1, else: 0 } } },
                    cancelledOrders: { $sum: { $cond: { if: { $eq: ['$status', 'Cancelled'] }, then: 1, else: 0 } } },
                    returnedOrders: { $sum: { $cond: { if: { $in: ['$status', ['Returned', 'Return Received']] }, then: 1, else: 0 } } },
                    mensOrders: { $sum: { $cond: { if: { $eq: ['$productDetails.gender', 'men'] }, then: 1, else: 0 } } },
                    womensOrders: { $sum: { $cond: { if: { $eq: ['$productDetails.gender', 'women'] }, then: 1, else: 0 } } },
                    unisexOrders: { $sum: { $cond: { if: { $eq: ['$productDetails.gender', 'unisex'] }, then: 1, else: 0 } } },
                    totalRevenue: {
                        $sum: {
                            $cond: {
                                if: { $eq: ['$status', 'Delivered'] },
                                then: '$totalFinalAmount',
                                else: 0,
                            },
                        },
                    },
                },
            },

            // Separate counts using $facet
            {
                $facet: {
                    ordersCounts: [
                        {
                            $project: {
                                _id: 0,
                                totalOrders: 1,
                                successfulOrders: 1,
                                cancelledOrders: 1,
                                returnedOrders: 1,
                            }
                        }
                    ],
                    productsCounts: [
                        {
                            $project: {
                                _id: 0,
                                mensOrders: 1,
                                womensOrders: 1,
                                unisexOrders: 1,
                            }
                        }
                    ],
                    revenueCount: [
                        {
                            $project: {
                                _id: 0,
                                totalRevenue: 1,
                            }
                        }
                    ],
                }
            },

            // Unwind and merge the results
            {
                $unwind: "$ordersCounts"
            },
            {
                $unwind: "$productsCounts"
            },
            {
                $unwind: "$revenueCount"
            },

            // Merge the results
            {
                $project: {
                    _id: 0,
                    totalOrders: "$ordersCounts.totalOrders",
                    successfulOrders: "$ordersCounts.successfulOrders",
                    cancelledOrders: "$ordersCounts.cancelledOrders",
                    returnedOrders: "$ordersCounts.returnedOrders",
                    mensOrders: "$productsCounts.mensOrders",
                    womensOrders: "$productsCounts.womensOrders",
                    unisexOrders: "$productsCounts.unisexOrders",
                    totalRevenue: "$revenueCount.totalRevenue",
                }
            },
        ]);

        console.log(result)

        res.json(result.length > 0 ? result[0] : 
            
            {
                totalOrders: 0,
                successfulOrders: 0,
                cancelledOrders: 0,
                returnedOrders: 0,
                mensOrders: 0,
                womensOrders: 0,
                unisexOrders: 0,
                totalRevenue: 0
              }
            
            );

    } catch (error) {
        console.log(error.message)
        res.status(500).json({ error: 'Internal Server Error' });
    }
}


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

    codPlaceOrderHandler,
    placeOrderByWalletHandler,
    razorpayPlaceOrderHandler,
    razorpayVerifyPaymentHandler,
    profileOrdersLoader,
    profileOrdersCancelHandler,
    profileOrdersReturnHandler,
    ordersListLoaderAdmin,
    orderStatusUpdateHandlerAdmin,
    generateInvoiceHandler,
    generateSalesReportHandler,
}
