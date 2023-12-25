const otpGenerator = require('otp-generator');
const mongoose = require('mongoose');
const User = require('../models/userModel');
const OTP = require('../models/otpModel');
const Products = require('../models/productModel');
const sendOtpEmail = require('../utils/sendEmail'); // Your function to send OTP via email
const sendOtpPhone = require('../utils/sendSms'); // Your function to send OTP via phone

const bcrypt = require('bcrypt');




//logging out admin
const logoutHandler = async (req, res) => {
    try {

        const userId = req.session.userId;

        // Find the user by _id (userId) and update the isLogin property to false
        const userUpdate = await User.findByIdAndUpdate(userId, { isLogin: false });

        if(userUpdate){
            req.session.userId = null;
            res.redirect('/');
        }
        
    } catch (error) {
        console.log(error.message);
    }
}


const signupLoader = async (req, res) => {
    try {
        res.render('./user/signup.ejs')
    } catch (error) {
        console.log(error.message);
    }
}



const generateOtp = () => {
    return otpGenerator.generate(6, {
        upperCaseAlphabets: false,
        lowerCaseAlphabets: false,
        specialChars: false,
    });
};


const signupHandler = async (req, res) => {
    try {

        // Validate incoming data (add more validation as needed)
        const { name, email, phone, password, dateOfBirth } = req.body;

        if (!name || !email || !phone || !password || !dateOfBirth) {
            req.flash('error', 'All fields are required');
            res.redirect('/signup');
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
        req.flash('error', 'An error occurred. Please try again.');
        res.redirect('/signup'); // Redirect to the registration page or handle it as needed
    }
}

const resendOtpHandler = async (req, res) => {
    try {

        // Check if the user data is in the session
        if (!req.session.userData) {
            req.flash('error', 'User data not found. Please go back to signup.');
            return res.redirect('/signup');
        }



        // Get user details from the session
        const { email, phone } = req.session.userData;


        // Generate new OTPs
        const newEmailOtp = generateOtp();
       // const newPhoneOtp = generateOtp();

        // Store new OTPs in the database
        await OTP.findOneAndDelete({ intendedEmail: email });
        //await OTP.findOneAndDelete({ intendedPhone: phone });

        const newOtpData = await OTP.create({
            intendedEmail: email,
            emailOtp: newEmailOtp,
            //intendedPhone: phone,
            //phoneOtp: newPhoneOtp,
        });

        req.session.userData.otpCreatedTime = newOtpData.createdAt; // Get the created time

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
        req.flash('error', 'An error occurred. Please try again.');
        res.redirect('/signup'); // Redirect to the registration page or handle it as needed
    }
}




const loadsignupVerify = async (req, res) => {
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
    }
}



const getFilterOptions = async () => {
    const brands = await Products.distinct('brandName', { isDeleted: false });
    const colors = await Products.distinct('colors', { isDeleted: false });
    const categories = await Products.distinct('category', { isDeleted: false });
    return { brands, colors, categories };
};


const productListLoader = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const pageSize = 5; // Set the number of products to display per page


        // Extracting filter parameters from the query
        //const genderFilter = req.query.gender || [];

        const temp_genderFilter = req.query.gender ? (Array.isArray(req.query.gender) ? req.query.gender : [req.query.gender]) : [];
        const genderFilter = temp_genderFilter.length === 1 ? temp_genderFilter[0].split(',') : temp_genderFilter;


        //const categoryFilter = req.query.category || [];
        const temp_categoryFilter = req.query.category ? (Array.isArray(req.query.category) ? req.query.category : [req.query.category]) : [];
        const categoryFilter = temp_categoryFilter.length === 1 ? temp_categoryFilter[0].split(',') : temp_categoryFilter;


        const discountFilter = !isNaN(req.query.discount) ? parseInt(req.query.discount) : null;

        //const colorFilter = req.query.colors || [];
        const temp_colorFilter = req.query.colors ? (Array.isArray(req.query.colors) ? req.query.colors : [req.query.colors]) : [];
        const colorFilter = temp_colorFilter.length === 1 ? temp_colorFilter[0].split(',') : temp_colorFilter;


        //const brandFilter = req.query.brands || [];

        const temp_brandFilter = req.query.brands ? (Array.isArray(req.query.brands) ? req.query.brands : [req.query.brands]) : [];
        const brandFilter = temp_brandFilter.length === 1 ? temp_brandFilter[0].split(',') : temp_brandFilter;


        const temp_sizesFilter = req.query.sizes ? (Array.isArray(req.query.sizes) ? req.query.sizes : [req.query.sizes]) : [];
        const sizesFilter = temp_sizesFilter.length === 1 ? temp_sizesFilter[0].split(',') : temp_sizesFilter;



        // Validate and parse min and max prices
        const minPriceFilter = !isNaN(req.query.minPrice) ? parseInt(req.query.minPrice) : null;
        const maxPriceFilter = !isNaN(req.query.maxPrice) ? parseInt(req.query.maxPrice) : null;

        // Constructing the filter object based on the query parameters
        const filterObject = {
            isDeleted: false,

        };


        // Add gender filter if not empty
        if (genderFilter.length > 0) {
            filterObject.gender = { $in: genderFilter };
        }

        // Add category filter if not empty
        if (categoryFilter.length > 0) {
            filterObject.category = { $in: categoryFilter };
        }

        // Add discount filter if not null
        if (!isNaN(discountFilter) && discountFilter !== null) {
            filterObject.discountPercentage = { $gte: discountFilter };
        }

        // Add colors filter if not empty
        if (colorFilter.length > 0) {
            filterObject.colors = { $in: colorFilter };
        }

        // Add brand filter if not empty
        if (brandFilter.length > 0) {
            filterObject.brandName = { $in: brandFilter };
        }

        // Add sizes filter

        if (sizesFilter.length > 0) {

            filterObject.sizes = {
                $elemMatch: {
                    $or: sizesFilter.map((size) => ({
                        [`${size}.availableStock`]: { $gt: 0 },
                    })),
                },
            };
        } else {
            // If no sizes selected, match any product with at least one size available
            filterObject.sizes = {
                $elemMatch: {
                    $or: ['small', 'medium', 'large', 'extraLarge'].map((size) => ({
                        [`${size}.availableStock`]: { $gt: 0 },
                    })),
                },
            };
        }


        // Adding min and max price filters if provided
        if ((!isNaN(minPriceFilter) && minPriceFilter !== null) || (!isNaN(maxPriceFilter) && maxPriceFilter !== null)) {
            filterObject.finalPrice = {}; // Initialize finalPrice as an empty object

            if (!isNaN(minPriceFilter)) {
                filterObject.finalPrice.$gte = minPriceFilter;
            }
            if (!isNaN(maxPriceFilter)) {
                filterObject.finalPrice.$lte = maxPriceFilter;
            }
        }







        const result = await Products.paginate(filterObject, { page: page, limit: pageSize });

        const filterOptions = await getFilterOptions();


        const selectedFilters = {
            ...(genderFilter.length > 0 && { gender: genderFilter }),
            ...(categoryFilter.length > 0 && { category: categoryFilter }),
            ...(colorFilter.length > 0 && { colors: colorFilter }),
            ...(brandFilter.length > 0 && { brands: brandFilter }),
            ...(sizesFilter.length > 0 && { sizes: Array.isArray(sizesFilter) ? sizesFilter : [sizesFilter] }),
            ...(minPriceFilter !== null && !isNaN(minPriceFilter) && { minPrice: minPriceFilter }),
            ...(maxPriceFilter !== null && !isNaN(maxPriceFilter) && { maxPrice: maxPriceFilter }),
            ...(discountFilter !== null && !isNaN(discountFilter) && { discount: discountFilter }),
        };

        Object.keys(selectedFilters).forEach((key) => selectedFilters[key] == null && delete selectedFilters[key]);




        res.render('./user/productList.ejs', {
            products: result.docs,
            currentPage: result.page,
            totalPages: result.totalPages,
            filterOptions: filterOptions,
            selectedFilters: selectedFilters,
        });
    } catch (error) {
        console.log(error.message);
        res.redirect('/home');
    }
}


const signupVerificationHandler = async (req, res) => {
    try {
        // Retrieve user data and OTPs from the session
        const { name, email, phone, password, dateOfBirth } = req.session.userData || {};
        const { emailOtp, phoneOtp } = req.body;

        // Validate OTPs
        const otpData = await OTP.findOne({ emailOtp: emailOtp, intendedEmail: email });

        if (!otpData || !otpData.createdAt) {
            console.log(`session.userData is ${req.session.userData}`)
            console.log(`otpData is ${otpData}`)
            req.flash('error', 'Invalid or expired OTPs. Please try again.');
            return res.redirect('/signup-verify');
        }

        // Create the user in the User schema
        const user = new User({
            name,
            email,
            phone,
            password,
            dateOfBirth,
        });

        const userData = await user.save();

        if (userData) {
            // Remove user data from the session after successful signup
            delete req.session.userData;

            req.flash('success', 'You have been successfully registered.');
            return res.redirect('/signup'); // Redirect to the registration page or handle it as needed
        }
    } catch (error) {
        console.error('Error in signupVerificationHandler:', error.message);
        req.flash('error', 'An error occurred. Please try again.');
        res.redirect('/signup-verify');
    }
};




const loginLoader = async (req, res) => {
    try {
        res.render('./user/login.ejs')
    } catch (error) {
        console.log(error.message);
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

const productSingleLoader = async (req, res) => {
    try {

        const productId = req.params.productId;

        if (!mongoose.Types.ObjectId.isValid(productId)) {
            req.flash('error', 'Invalid product ID');
            res.redirect('/products');
            return;
        }
        const productData = await Products.findById(productId);
        if (productData) {
            res.render('./user/product-single.ejs', { product: productData });
        } else {
            req.flash('error', 'Invalid user details');
            res.redirect('/products');
        }
    } catch (error) {
        console.log(error.message);
        req.flash('error', 'An error occured');
        res.redirect('/products');
    }
}

const homeLoader = async (req, res) => {
    try {
        res.render('./user/home.ejs')
    } catch (error) {
        console.log(error.message);
    }
}




module.exports = {
    signupLoader,
    signupHandler,
    loginLoader,
    loginHandler,
    loadsignupVerify,
    signupVerificationHandler,
    productListLoader,
    productSingleLoader,
    homeLoader,
    resendOtpHandler,
    logoutHandler,
}