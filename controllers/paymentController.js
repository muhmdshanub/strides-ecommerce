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
const Payment = require('../models/paymentModel');
const sendOtpEmail = require('../utils/sendEmail');
const bcrypt = require('bcrypt');
const razorpay = require('razorpay');

async function getAllCategories() {
    try {
        const categories = await Category.find();
        return categories;
    } catch (error) {
        throw error;
    }
}

const orderConfirmLoader= async(req, res , next) => {
    try{
        const paymentId = req.params.paymentDBId;
        // Step 1: Find the payment document using the provided payment ID
        const payment = await Payment.findOne({ _id: paymentId }).populate('orders');

        if (!payment) {
            return res.status(404).render('error.ejs', { message: 'Payment not found' });
        }

        // Now you have the orderDetails to render the order confirmation page
        const categories = await getAllCategories();

        return res.render('./user/order-confirmed.ejs', { orders: payment.orders, categories });

    }catch(error){
        console.log(error.message)
        next(error)
    }
}

module.exports = {
    orderConfirmLoader,
}