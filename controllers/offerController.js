const otpGenerator = require('otp-generator');
const mongoose = require('mongoose');
const { body, validationResult } = require('express-validator');
const User = require('../models/userModel');
const OTP = require('../models/otpModel');
const Address = require('../models/addressModel');
const Category = require('../models/categoryModel');
const Products = require('../models/productModel');
const Cart = require('../models/cartModel');
const Wishlist = require('../models/wishlistModel');
const Order = require('../models/orderModel');
const Wallet = require('../models/walletModel')
const Referrals = require('../models/referralModel')
const Offers = require('../models/offerModel')
const sendOtpEmail = require('../utils/sendEmail');

const offersAddLoader = async(req,res, next) =>{
    try{
        const categories = await Category.find();

        res.render('./admin/offers-add.ejs',{categories})

    }catch(error){
        console.log(error.message);
        next(error)
    }
}


const offerAddHandlerAdmin = async(req, res, next) => {
    try{

        const { name, description, percentage, offerType, selectedProductId, category, validFrom, validUpto } = req.body;

        console.log("offerType is " + offerType)
        // Validate each field separately
        if (!name) {
            return res.status(400).send('Name is required.');
        }

        if (!description) {
            return res.status(400).send('Description is required.');
        }

        if (!percentage || isNaN(percentage) || percentage <=0 || percentage >= 100) {
            return res.status(400).send('Percentage is required and should be 1 to 99.');
        }

        if (!offerType) {
            return res.status(400).send('Offer type is required.');
        }

        if (!validFrom) {
            return res.status(400).send('Valid from date is required.');
        }

        if (!validUpto) {
            return res.status(400).send('Valid upto date is required.');
        }

        if (offerType === 'category' && !category) {
            return res.status(400).send('Category is required for category-based offer.');
        }

        if (offerType === 'product' && !selectedProductId) {
            return res.status(400).send('Product is required for product-based offer.');
        }

        if (offerType === 'category' && !mongoose.Types.ObjectId.isValid(category)) {
            const genericErrorMessage = 'Invalid category ID: ';
            const genericError = new Error(genericErrorMessage);
            genericError.status = 500;
            throw genericError;
        }

        if (offerType === 'product' && !mongoose.Types.ObjectId.isValid(selectedProductId)) {
            console.log("productId is "+ selectedProductId)
            const genericErrorMessage = 'Invalid product ID: ';
            const genericError = new Error(genericErrorMessage);
            genericError.status = 500;
            throw genericError;
        }

        const offerData = {
            name,
            description,
            offerType:offerType,
            percentageDiscount: parseFloat(percentage),
            validFrom: new Date(validFrom),
            validUpto: new Date(validUpto),
        };

        if (offerType === 'category') {
            offerData.category = category;
        } else if (offerType === 'product') {
            offerData.product = selectedProductId;
        }

        // Create a new offer using the Offer model
        const newOffer = new Offers(offerData);

        // Save the offer to the database
        await newOffer.save();

        // Redirect or respond as needed
        req.flash('success', 'You have successfully added a new offer.');
        res.redirect('/admin/offers-list');

    }catch(error){
        console.log(error.message);
        next(error);
    }
}

const offerListLoader = async (req, res, next) => {
    try {
        // Pagination parameters
        const page = parseInt(req.query.page) || 1;
        const pageSize = 10; // Adjust this based on your preference

        // Calculate the skip value
        const skip = (page - 1) * pageSize;

        // Load offers for the current page
        const offers = await Offers.find()
            .populate({
                path: 'product',
                select: '_id productName brandName'
            })
            .populate({
                path: 'category',
                select: '_id name'
            })
            .skip(skip)
            .limit(pageSize);

        // Count total number of offers
        const totalOffers = await Offers.countDocuments();

        // Calculate total pages
        const totalPages = Math.ceil(totalOffers / pageSize);

        // Render the offers list view with pagination details
        res.render('./admin/offers-list.ejs', {
            offers,
            currentPage: page,
            totalPages
        });
    } catch (error) {
        console.log(error.message);
        next(error);
    }
};

module.exports={
    offersAddLoader,
    offerAddHandlerAdmin,
    offerListLoader,
}