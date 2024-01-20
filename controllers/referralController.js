const uuid = require('uuid');
const mongoose = require('mongoose');
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
const sendOtpEmail = require('../utils/sendEmail');


const createReferralsTokenHandler = async(req, res, next) => {
    try{
        
        const userId = req.session.userId;

        const existingReferrals = await Referrals.findOne({ referringUser: userId });

        if (existingReferrals) {
            console.log("Referrals is existing for the suer")
            return res.status(400).json({ message: 'Referral token already exists for this user.' });
        }

        let referralToken;
        let existingReferral;

        // Keep generating a new referralToken until it's unique
        do {
            referralToken = generateUniqueToken();
            existingReferral = await Referrals.findOne({ referralToken });
        } while (existingReferral);

        // Create a new Referral document
        const newReferral = new Referrals({
            referringUser: userId,
            referralToken: referralToken,
            referredUsers: [],
        })

        // Save the new Referral document to the collection
        await newReferral.save();

        // Respond with the created Referral document or a success message
        res.status(200).json({ message: 'Referral token created successfully.', referrals: newReferral });

    }catch(error){
        console.log(error.message);
        next(error);
    }
}

// Function to generate a unique referral token (you can customize this based on your needs)
const generateUniqueToken = () => {
    
    
    return uuid.v4();
};

module.exports = {
    createReferralsTokenHandler,
}