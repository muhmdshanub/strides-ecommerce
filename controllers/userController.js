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

//logging out admin
const logoutHandler = async (req, res, next) => {
    try {

        const userId = req.session.userId;

        // Find the user by _id (userId) and update the isLogin property to false
        const userUpdate = await User.findByIdAndUpdate(userId, { isLogin: false });

        if (userUpdate) {
            req.session.userId = null;
            res.redirect('/');
        }

    } catch (error) {
        console.log(error.message);
        next(error)
    }
}

const signupLoader = async (req, res, next) => {
    try {
        res.render('./user/signup.ejs')
    } catch (error) {
        console.log(error.message);
        next(error)
    }
}

const generateOtp = () => {
    return otpGenerator.generate(6, {
        upperCaseAlphabets: false,
        lowerCaseAlphabets: false,
        specialChars: false,
    });
};


const signupHandler = async (req, res, next) => {
    try {

        // Validate incoming data (add more validation as needed)
        const { name, email, phone, password, dateOfBirth } = req.body;

        if (!name) {
            req.flash('error', 'Name is required');
            return res.redirect('/signup');
        }
        
        if (!email) {
            req.flash('error', 'Email is required');
            return res.redirect('/signup');
        }
        
        if (!phone) {
            req.flash('error', 'Phone is required');
            return res.redirect('/signup');
        }
        
        if (!password) {
            req.flash('error', 'Password is required');
            return res.redirect('/signup');
        }
        
        if (!dateOfBirth) {
            req.flash('error', 'Date of Birth is required');
            return res.redirect('/signup');
        }

        const isUserExist = await User.findOne({
            $or: [
                { email: req.body.email },
                { phone: req.body.phone }
            ]
        });

        if (isUserExist) {
            req.flash('error', 'Email or Phone  is already in use. Please choose another email or Phone.');
            res.redirect('/signup');
        } else {


            // Store user details in the session
            req.session.userData = { name, email, phone, password, dateOfBirth };
            //craete otps
            const emailOtp = generateOtp();
            //const phoneOtp = generateOtp();

            // Store user details and OTPs in the database
            const otpData = await OTP.create({
                intendedEmail: email,
                emailOtp: emailOtp,
                //intendedPhone: phone,
                //phoneOtp: phoneOtp,
            });

            req.session.userData.otpCreatedTime = otpData.createdAt; // Get the created time

            //sending the otps to email and phone
            try {
                await sendOtpEmail(email, emailOtp);
            } catch (emailError) {
                console.error('Error sending OTP via Email:', emailError);
                req.flash('error', 'Error sending OTP via Email. Please try again.');
                return res.redirect('/signup');
            }

            // try {
            //     await sendOtpPhone(phone, phoneOtp);
            // } catch (smsError) {
            //     console.error('Error sending SMS:', smsError);
            //     req.flash('error', 'Error sending OTP via SMS. Please try again.');
            //     return res.redirect('/signup');
            // }


            // Redirect to the signup-verify page with the created time as a query parameter
            res.redirect(`/signup-verify?createdTime=${req.session.userData.otpCreatedTime}`);

        }

    } catch (error) {
        console.log(error.message);
        next(error)
    }
}

const resendOtpHandler = async (req, res, next) => {
    try {

        // Check if the user data is in the session
        if (!req.session.userData) {
            req.flash('error', 'User data not found. Please go back to signup.');
            return res.redirect('/signup');
        }



        // Get user details from the session
        const { email } = req.session.userData;


        // Generate new OTPs
        const newEmailOtp = generateOtp();
        // const newPhoneOtp = generateOtp();

        // Find and update or create a new OTP document
        const updatedOtpData = await OTP.findOneAndUpdate(
            { intendedEmail: email },
            {
                intendedEmail: email,
                emailOtp: newEmailOtp,
                createdAt: Date.now(),
            },
            { upsert: true, new: true }
        );

        req.session.userData.otpCreatedTime = updatedOtpData.createdAt; // Get the created time

        //sending the otps to email and phone
        try {
            await sendOtpEmail(email, newEmailOtp);
        } catch (emailError) {
            console.error('Error sending OTP via Email:', emailError);
            req.flash('error', 'Error sending OTP via Email. Please try again.');
            return res.redirect('/signup');
        }

        // try {
        //     await sendOtpPhone(phone, newPhoneOtp);
        // } catch (smsError) {
        //     console.error('Error sending SMS:', smsError);
        //     req.flash('error', 'Error sending OTP via SMS. Please try again.');
        //     return res.redirect('/signup');
        // }


        // Redirect to the signup-verify page with the created time as a query parameter
        res.redirect(`/signup-verify?createdTime=${req.session.userData.otpCreatedTime}`);



    } catch (error) {
        console.log(error.message);
        next(error)
    }
}

const loadsignupVerify = async (req, res, next) => {
    try {
        if (req.session.userData && req.session.userData.otpCreatedTime) {

            // Access the created time from the query parameters
            const otpCreatedTime = req.session.userData.otpCreatedTime;

            // Render the signup-verify page and pass the created time
            res.render('./user/signup-verify.ejs', { otpCreatedTime });

        } else {
            res.redirect('/signup');
        }

    } catch (error) {
        console.log(error.message);
        next(error)
    }
}



const signupVerificationHandler = async (req, res, next) => {
    try {
        // Retrieve user data and OTPs from the session
        const { name, email, phone, password, dateOfBirth } = req.session.userData || {};
        const { emailOtp } = req.body;

        // Validate OTPs
        const otpData = await OTP.findOne({ emailOtp: emailOtp, intendedEmail: email });

        if (!otpData || !otpData.createdAt) {
            console.log(`session.userData is ${req.session.userData}`)
            console.log(`otpData is ${otpData}`)
            req.flash('error', 'Invalid or expired OTPs. Please try again.');
            return res.redirect('/signup-verify');
        }

        // Assuming dateOfBirth is a string in the format 'dd-mm-yyyy'
        const [day, month, year] = dateOfBirth.split('-').map(Number);

        // Create a new Date object using the parsed values
        const formattedDateOfBirth = new Date(day, month - 1, year);

        // Create the user in the User schema
        const user = new User({
            name,
            email,
            phone,
            password,
            dateOfBirth: formattedDateOfBirth,
        });

        const userData = await user.save();

        if (userData) {
            // Create a new Cart document for the user
            const cart = new Cart({ user: userData._id });
            const cartData = await cart.save();

            const wishlist = new Wishlist({ user: userData._id });
            const wishlistData = await wishlist.save();

            if (cartData && wishlistData) {
                // Update the user's cart field with the new cart's _id
                userData.cart = cartData._id;
                userData.wishlist = wishlistData._id;
                const updatedUserData = await userData.save();
            }

            // Remove user data from the session after successful signup
            delete req.session.userData;

            req.flash('success', 'You have been successfully registered.');
            return res.redirect('/signup'); // Redirect to the registration page or handle it as needed
        }
    } catch (error) {
        console.error('Error in signupVerificationHandler:', error.message);
        next(error)
    }
};


const loginLoader = async (req, res) => {
    try {
        res.render('./user/login.ejs')
    } catch (error) {
        console.log(error.message);
        next(error)
    }
}

const loginHandler = async (req, res) => {
    try {
        const emailOrPhone = req.body.emailOrPhone;
        const password = req.body.password;

        const userData = await User.findOne({
            $or: [
                { email: emailOrPhone },
                { phone: emailOrPhone }
            ],
            isBlocked: false,
        });

        if (userData) {
            const passwordMatch = await bcrypt.compare(password, userData.password);

            if (passwordMatch) {
                userData.isLogin = true || userData.isLogin;
                userData.lastLogin = Date.now() || userData.lastLogin;

                const userUpdate = await userData.save();

                if (userUpdate) {
                    req.session.userId = userData._id;
                    res.redirect('/home');
                } else {
                    req.flash('error', "Something Happened while trying to log you in. Please try again");
                    res.redirect('/login');
                }

            } else {
                req.flash('error', "Invalid credetials.");
                res.redirect('/login');
            }
        } else {
            req.flash('error', "Invalid credetials.");
            res.redirect('/login');
        }
    } catch (error) {
        console.log(error.message);
        req.flash('error', "Something Happened while trying to log you in. Please try again");
        res.redirect('/login');
    }
}

const forgotPasswordFormLoader = async(req, res, next) =>{
    try {
        res.render('./user/forgot-password-form.ejs');
    } catch (error) {
        console.log(error.message);
        next(error)
    }
}

const forgotPasswordFormHandler = async(req, res, next) =>{
    try {
        // Validate incoming data (add more validation as needed)
        const { email, phone } = req.body;

        if ( !email ) {
            req.flash('error', 'Email field is required');
            res.redirect('/forgot-password');
        }
        if ( !phone ) {
            req.flash('error', 'Phone field is required');
            res.redirect('/forgot-password');
        }

        const user = await User.findOne({ email, phone });

        if (!user) {
            // User not found
            req.flash('error', 'No user found with the provided email and phone');
            return res.redirect('/forgot-password');
        }

        // Store user details in the session
        req.session.userDataPassword = {  email, phone};
        //craete otps
        const emailOtp = generateOtp();
        

        // Store user details and OTPs in the database
        const otpData = await OTP.create({
            intendedEmail: email,
            emailOtp: emailOtp,
            
        });

        req.session.userDataPassword.otpCreatedTime = otpData.createdAt; // Get the created time

        //sending the otps to email and phone
        try {
            await sendOtpEmail(email, emailOtp);
        } catch (emailError) {
            console.error('Error sending OTP via Email:', emailError);
            req.flash('error', 'Error sending OTP via Email. Please try again.');
            return res.redirect('/forgot-password');
        }

        res.redirect('/forgot-password-otp-verify');

    } catch (error) {
        console.log(error.message);
        next(error)
    }
}

const forgotPasswordOtpVerifyLoader = async (req, res, next) => {
    try {
        if (req.session.userDataPassword && req.session.userDataPassword.otpCreatedTime) {

            // Access the created time from the query parameters
            const otpCreatedTime = req.session.userDataPassword.otpCreatedTime;

            // Render the signup-verify page and pass the created time
            res.render('./user/forgot-password-otp-verify.ejs', { otpCreatedTime });

        } else {
            res.redirect('/forgot-password');
        }

    } catch (error) {
        console.log(error.message);
        next(error)
    }
}

const forgotPasswordResendOtpHandler = async (req, res, next) => {
    try {

        // Check if the user data is in the session
        if (!req.session.userDataPassword) {
            req.flash('error', 'User data not found. Please go back to signup.');
            return res.redirect('/forgot-password');
        }



        // Get user details from the session
        const { email } = req.session.userDataPassword;


        // Generate new OTPs
        const newEmailOtp = generateOtp();
        // const newPhoneOtp = generateOtp();

        // Find and update or create a new OTP document
        const updatedOtpData = await OTP.findOneAndUpdate(
            { intendedEmail: email },
            {
                intendedEmail: email,
                emailOtp: newEmailOtp,
                createdAt: Date.now(),
            },
            { upsert: true, new: true }
        );

        req.session.userDataPassword.otpCreatedTime = updatedOtpData.createdAt; // Get the created time

        //sending the otps to email and phone
        try {
            await sendOtpEmail(email, newEmailOtp);
        } catch (emailError) {
            console.error('Error sending OTP via Email:', emailError);
            req.flash('error', 'Error sending OTP via Email. Please try again.');
            return res.redirect('/forgot-password');
        }

        


        // Redirect to the signup-verify page with the created time as a query parameter
        res.redirect('/forgot-password-otp-verify');



    } catch (error) {
        console.log(error.message);
        next(error)
    }
}

const forgotPasswordOtpVerifyHandler = async (req, res, next) => {
    try{
        // Retrieve user data and OTPs from the session
        const { email, phone } = req.session.userDataPassword || {};
        const { emailOtp } = req.body;

        // Validate OTPs
        const otpData = await OTP.findOne({ emailOtp: emailOtp, intendedEmail: email });

        if (!otpData || !otpData.createdAt) {
            
            req.flash('error', 'Invalid or expired OTPs. Please try again.');
            return res.redirect('/forgot-password-otp-verify');
        }

        req.session.userDataPassword.isOtpVerified = true ;
        req.flash('success', 'You have been verified your authenticity Now you can update the Password.');
        return res.redirect('/forgot-password-update-password'); // Redirect to the registration page or handle it as needed

    }catch (error) {
        console.log(error.message);
        next(error)
    }
}

const forgotPasswordUpdateLoader = async (req, res, next) => {
    try {
        if (req.session.userDataPassword && req.session.userDataPassword.isOtpVerified) {

            // Render the signup-verify page and pass the created time
            res.render('./user/forgot-password-update-form.ejs');

        } else {
            req.session.userDataPassword.isOtpVerified = false ;
            res.redirect('forgot-password-otp-verify');
        }

    } catch (error) {
        console.log(error.message);
        
        next(error)
    }
}

const forgotPasswordUpdateHandler = async (req, res, next) =>{
    try{
        // Validate incoming data (add more validation as needed)
        const { password, confirmPassword } = req.body;

        // Check if password and confirmPassword match and have at least 8 characters
        if (password !== confirmPassword || password.length < 8) {
            req.flash('error', 'Password and Confirm Password must match and be at least 8 characters long.');
            return res.redirect('/forgot-password-update-password');
        }

        // Check if session contains the necessary data
        if (!req.session.userDataPassword || !req.session.userDataPassword.isOtpVerified) {
            req.flash('error', 'Invalid request. Please restart the password reset process.');
            return res.redirect('/forgot-password');
        }

        // Find the user in the database based on email and phone
        const user = await User.findOne({
            email: req.session.userDataPassword.email,
            phone: req.session.userDataPassword.phone
        });

        if (!user) {
            req.session.userDataPassword.isOtpVerified = false ;
            req.flash('error', 'User not found. Please restart the password reset process.');
            return res.redirect('/forgot-password');
        }

        // Update the user's password
        user.password = password;
        await user.save();

        // Clear the session data after successful password update
        req.session.userDataPassword = null;

        req.flash('success', 'Password updated successfully. You can now login with your new password.');
        return res.redirect('/login');

    }catch (error) {
        console.log(error.message);
        next(error)
    }
}

const homeLoader = async (req, res, next) => {
    try {
        const categories = await getAllCategories();

        res.render('./user/home.ejs',{categories})
    } catch (error) {
        console.log(error.message);
        next(error)
    }
}


const paymentSelectionLoader = async (req, res, next) => {
    try {
        const userId = req.session.userId;

        if (!userId) {
            console.log("corresponding user not found login");
            return res.status(403).json({ message: 'User not authenticated' });
        }

        // Fetch user's cart details
        let cart = await Cart.findOne({ user: userId }).populate({
            path: 'items.product',
            match: { isDeleted: false }, // Only populate products that are not deleted
        });

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

        // Calculate total price details for the cart
        cart.items.forEach(item => {
            item.totalAmount = item.quantity * item.product.finalPrice;
            item.totalInitialAmount = item.quantity * item.product.initialPrice;
        });
        cart.totalAmount = parseFloat(cart.items.reduce((total, item) => total + item.totalAmount, 0)).toFixed(2);
        cart.totalInitialAmount = parseFloat(cart.items.reduce((total, item) => total + item.totalInitialAmount, 0)).toFixed(2);
        cart.totalDiscountAmount = parseFloat(cart.totalInitialAmount - cart.totalAmount).toFixed(2);

        const categories = await getAllCategories();

        if (invalidItems.length > 0) {
            // If there are invalid items, redirect to the cart page with the invalid items
            req.flash('error', "You have some invalid items in your cart. Please click On the MOVE TO ADDDRESS button to know more.")
            return res.render('./user/cart', { invalidItems, cart, categories });
        } else {
            // Render the payment-selection page with the first address and cart details
            res.render('./user/payment-selection.ejs', { firstAddress, user, cart, categories});
        }


    } catch (error) {
        console.log(error.message);
        next(error)
    }
};

const profileLoader = async (req, res, next) => {
    try {

        const userId = req.session.userId;

        const user = await User.findById(userId).populate('addresses').exec();

        const year = user.dateOfBirth.getFullYear();
        const month = (user.dateOfBirth.getMonth() + 1).toString().padStart(2, '0');
        const day = user.dateOfBirth.getDate().toString().padStart(2, '0');

        user.stringDateOfBirth = `${day}-${month}-${year}`;

        const categories = await getAllCategories();

        res.render('./user/profile/profile.ejs', { user , categories });

    } catch (error) {
        console.log(error.message)
        next(error)
    }
}

const profileUserEditHandler = async (req, res, next) => {
    try {
        const userId = req.session.userId;

        // Retrieve updated user details from the request body
        const { name, email, phone, dateOfBirth } = req.body;

        // Update user details in the database
        const updatedUser = await User.findByIdAndUpdate(userId, {
            name,
            email,
            phone,
            dateOfBirth
            // Add other fields as needed
        });

        if (!updatedUser) {
            console.log("failed update user collection")
            // Handle the case where the user is not found
            return res.status(404).json({ error: 'User not found' });
        }
        const year = updatedUser.dateOfBirth.getFullYear();
        const month = (updatedUser.dateOfBirth.getMonth() + 1).toString().padStart(2, '0');
        const day = updatedUser.dateOfBirth.getDate().toString().padStart(2, '0');

        updatedUser.stringDateOfBirth = `${day}-${month}-${year}`;

        // Send the original user details in the response
        res.status(200).json(updatedUser);
    } catch (error) {
        console.error(error.message);
        next(error)
    }
}

const passwordChangeHandler = async (req, res, next) => {
    try {
        // Validate incoming data (add more validation as needed)
        const { oldPassword, newPassword, confirmNewPassword } = req.body;
        const userId = req.session.userId;

        if (!oldPassword || !newPassword || !confirmNewPassword) {
            return res.status(400).json({ error: 'All fields are required' });
        }

        if (!oldPassword || oldPassword.length < 8) {
            return res.status(400).json({ error: 'Old password is invalid' });
        }

        if (!newPassword || newPassword.length < 8) {
            return res.status(400).json({ error: 'New password is invalid' });
        }

        if (!confirmNewPassword || confirmNewPassword.length < 8) {
            return res.status(400).json({ error: 'Confirm new password is invalid' });
        }

        if (oldPassword === newPassword) {
            return res.status(400).json({ error: 'New password must be different from the old password' });
        }

        if (newPassword !== confirmNewPassword) {
            return res.status(400).json({ error: 'New password and confirm new password must match' });
        }

        // Retrieve user data from the database
        const userData = await User.findById(userId);

        if (!userData) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Compare the old password with the stored bcrypt hash
        const isPasswordMatch = await bcrypt.compare(oldPassword, userData.password);

        if (!isPasswordMatch) {
            return res.status(401).json({ error: 'Old password is incorrect' });
        }



        userData.password = newPassword;

        const userUpdate = await userData.save();

        if (userUpdate) {
            // Send a success response
            return res.status(200).json({ message: 'Password changed successfully' });
        }


    } catch (error) {
        console.error(error.message);
        next(error)
    }
};




module.exports = {
    signupLoader,
    signupHandler,
    loginLoader,
    loginHandler,
    loadsignupVerify,
    signupVerificationHandler,
    forgotPasswordFormLoader,
    forgotPasswordFormHandler,
    forgotPasswordOtpVerifyLoader,
    forgotPasswordResendOtpHandler,
    forgotPasswordOtpVerifyHandler,
    forgotPasswordUpdateLoader,
    forgotPasswordUpdateHandler,
    homeLoader,
    resendOtpHandler,
    logoutHandler,
    paymentSelectionLoader,
    profileLoader,
    profileUserEditHandler,
    passwordChangeHandler,
    
}