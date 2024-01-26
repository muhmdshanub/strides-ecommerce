const otpGenerator = require('otp-generator');
const mongoose = require('mongoose');
const User = require('../models/userModel');
const OTP = require('../models/otpModel');
const Address = require('../models/addressModel');
const Category = require('../models/categoryModel');
const Products = require('../models/productModel');
const Cart = require('../models/cartModel');
const Order = require('../models/orderModel');
const Wishlist = require('../models/wishlistModel');
const Wallet = require('../models/walletModel');
const Payment = require('../models/paymentModel');
const sendOtpEmail = require('../utils/sendEmail');
const Razorpay = require('razorpay')
const bcrypt = require('bcrypt');
const crypto = require('crypto')

async function getAllCategories() {
    try {
        const categories = await Category.find();
        return categories;
    } catch (error) {
        throw error;
    }
}

const walletLoader = async (req, res, next) => {
    try {
        // Ensure the user is authenticated
        if (!req.session.userId) {

            console.log("corresponding userId")
            const genericErrorMessage = 'User not authenticated :  ';
            const genericError = new Error(genericErrorMessage);
            genericError.status = 403;
            throw genericError;
        }

        const userId = req.session.userId;

        // Fetch the user's wallet from the database
        const wallet = await Wallet.findOne({ user: userId });

        // Check if the wallet exists
        if (!wallet) {
            console.log("corresponding wallet not found")
            const walletNotFoundMessage = 'Wallet not found for the user';
            const walletNotFoundError = new Error(walletNotFoundMessage);
            walletNotFoundError.status = 404;
            throw walletNotFoundError;
        }

        // Assuming getAllCategories is a function that fetches all categories
        const categories = await getAllCategories();

        // Render the wallet page with the wallet and categories data
        return res.render('./user/wallet', { wallet, categories });

    } catch (error) {
        console.error('Error loading wallet:', error);
        next(error)
    }
};

const createOrderToAddMoney = async (req, res, next) => {
    try {

        const userId = req.session.userId;

        if (!userId) {
            console.log("no valid userID on session")
            req.flash('error', 'unauthenticated user ID.')
            return res.redirect('/home')
        }

        // Get the amount from the request body
        const amount = req.body.amount;

        // Check if the amount is greater than 0
        if (amount <= 0) {
            console.log("Amount should be greater than 0");
            const walletNotFoundMessage = 'Amount should be greater than 0';
            const walletNotFoundError = new Error(walletNotFoundMessage);
            walletNotFoundError.status = 404;
            throw walletNotFoundError;
        }


        // Find the user document
        const user = await User.findOne({ _id: userId });

        if (!user) {
            console.log("user not found on user collection")
            req.flash('error', 'User not found.');
            return res.redirect('/home');
        }

        // Fetch the user's wallet from the database
        const wallet = await Wallet.findOne({ user: userId });

        // Check if the wallet exists
        if (!wallet) {
            const walletNotFoundMessage = 'Wallet not found for the user';
            const walletNotFoundError = new Error(walletNotFoundMessage);
            walletNotFoundError.status = 404;
            throw walletNotFoundError;
        }

        // Store the amount in req.session.walletData
        req.session.walletData = { amount };

        var instance = new Razorpay({ key_id: process.env.RAZORPAY_KEY_ID, key_secret: process.env.RAZORPAY_KEY_SECRET })



        const order = await instance.orders.create({
            amount: amount * 100,
            currency: "INR",
            receipt: "receipt#1walletRecharge#"
        })

        req.session.walletData.razorPayOrderId = order.id;

        res.json({ order, success: true });

    } catch (error) {
        console.error('Error creating razorpay order from server:', error);
        next(error)
    }
}


const verifyOrderToAddMoneyHandler =  async (req, res) => {
    
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
        if (!req.session.walletData) {
            console.log("req.session.orderData is not found")
            return res.json({ success: false, error: 'Order data not found in session' });
        }

        

        if (!req.session.walletData.amount || !req.session.walletData.razorPayOrderId) {
            console.log("order and payment is not found in req.session.orderData ")
            return res.json({ success: false, error: 'Incomplete order data in session' });
        }

        var instance = new Razorpay({ key_id: process.env.RAZORPAY_KEY_ID, key_secret: process.env.RAZORPAY_KEY_SECRET });

        // Verify payment with Razorpay
        const paymentVerificationResponse = await instance.payments.fetch(razorPayPaymentId);

        if (paymentVerificationResponse && paymentVerificationResponse.status === 'captured') {
            
            // Check if the payment amount matches the expected amount
            const expectedAmount = req.session.walletData.amount * 100;
            const actualAmount = paymentVerificationResponse.amount;


            if (expectedAmount !== actualAmount || actualAmount <= 0) {
                console.log("Amount does not matches or invalid amount")
                return res.json({ success: false, error: 'Payment amount mismatch or invalid value' });
            }


            // **Signature verification using Razorpay's secret key:**
            const expectedSignature = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
                .update(`${razorPayOrderId}|${razorPayPaymentId}`)
                .digest('hex');

            if (expectedSignature !== razorPaySignature) {
                console.error('Signature verification failed');
                return res.json({ success: false, error: 'Invalid signature' });
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

            
            // Create a transaction for the wallet
            const walletTransaction = {
                type: 'credit', // Assuming this is a credit transaction when money is added
                amount: req.session.walletData.amount,
                description: 'money added to wallet',
                date: new Date(),
                razorpayPaymentId : razorPayPaymentId,
                razorpayOrderId : razorPayOrderId,
                razorpaySignature : razorPaySignature,
            };

            // Update the user's wallet with the new transaction
            const walletUpdate = await Wallet.updateOne(
                { user: userId },
                { 
                    $push: { transactions: walletTransaction },
                    $inc: { balance: req.session.walletData.amount },
                }
            );

            if (walletUpdate) {

                

                req.session.walletData = null;
                return res.json({ success: true, newTransaction:walletTransaction });
            }

            
        } else {
            console.log("payment verification response is not okay or not equals to capture")
            console.log("Payment Verification Response:", paymentVerificationResponse);
            // Payment verification failed
            return res.json({ success: false, error: 'Payment verification failed' });
        }
    } catch (error) {
        console.error('Error during payment verification:', error);
        return res.json({ success: false, error: 'Internal server error' });
    }

}



module.exports = {
    walletLoader,
    createOrderToAddMoney,
    verifyOrderToAddMoneyHandler,
}