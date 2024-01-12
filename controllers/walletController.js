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

  const walletLoader = async (req, res, next) => {
    try {
        // Ensure the user is authenticated
        if (!req.session.userId) {
            
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

module.exports = {
    walletLoader,
}