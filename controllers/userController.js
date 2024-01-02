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
const sendOtpEmail = require('../utils/sendEmail'); // Your function to send OTP via email


const bcrypt = require('bcrypt');




//logging out admin
const logoutHandler = async (req, res) => {
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

        // Find and update or create a new OTP document
        const updatedOtpData = await OTP.findOneAndUpdate(
            { intendedEmail: email },
            {
                intendedEmail: email,
                emailOtp: newEmailOtp,
            },
            { upsert: true, new: true }
        );

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
    try {
        const brands = await Products.distinct('brandName', { isDeleted: false });
        const colors = await Products.distinct('colors', { isDeleted: false });

        // Fetch categories from the Category model
        const categories = await Category.find({}, '_id name');

        return { brands, colors, categories };
    } catch (error) {
        console.error(error.message);
        throw error;
    }
};


const productListLoader = async (req, res) => {
    try {
        const userId = req.session.userId;
        const page = parseInt(req.query.page) || 1;
        const pageSize = 10; // Set the number of products to display per page


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


        //getting wishlist document
        const userWishlist = await Wishlist.findOne({ user: userId });

        res.render('./user/productList.ejs', {
            products: result.docs,
            currentPage: result.page,
            totalPages: result.totalPages,
            filterOptions: filterOptions,
            selectedFilters: selectedFilters,
            userWishlist: userWishlist,
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

        const productData = await Products.findById(productId).populate('category');

        if (productData) {
            res.render('./user/product-single.ejs', { product: productData });
        } else {
            req.flash('error', 'Invalid user details');
            res.redirect('/products');
        }
    } catch (error) {
        console.log(error.message);
        req.flash('error', 'An error occurred');
        res.redirect('/products');
    }
};


const homeLoader = async (req, res) => {
    try {
        res.render('./user/home.ejs')
    } catch (error) {
        console.log(error.message);
    }
}


const addToCartHandler = async (req, res) => {
    try {
        const productId = req.params.productId;
        const { size, quantity } = req.body;



        // Get user ID from the session or authentication token
        const userId = req.session.userId;

        // Find the user's cart in the Cart collection
        const cart = await Cart.findOne({ user: userId });

        if (!cart) {
            return res.status(404).json({ error: 'User\'s cart not found' });
        }

        // Find the product in the database
        const product = await Products.findOne({ _id: productId, isDeleted: false });

        if (!product) {
            return res.status(404).json({ error: 'Product not found' });

        }

        // Get the available stock for the selected size
        const availableStock = product.sizes[0][size].availableStock;

        if (availableStock < 1) {
            return res.json({
                message: `Item is Out of stock. not added to the cart.`,
            });
        }

        // Check if the product with the selected size already exists in the cart
        const existingItemIndex = cart.items.findIndex(
            (item) => item.product.equals(product._id) && item.size === size
        );

        // If available size is less than 10 and product+size doesn't exist
        if (availableStock < 10 && existingItemIndex === -1) {
            const newItem = {
                product: product._id,
                size,
                quantity: Math.min(quantity, availableStock),
                totalAmount: Math.min(quantity, availableStock) * product.finalPrice,
            };

            cart.items.push(newItem);
            cart.totalItems = cart.items.length;
            cart.totalAmount = cart.items.reduce((total, item) => total + item.totalAmount, 0);

            // Save the cart
            await cart.save();

            return res.json({
                message: `Only ${availableStock} items available for this size. Product added to cart successfully.`,
            });
        }

        // If available size is less than 10 and product+size exists
        if (availableStock < 10 && existingItemIndex !== -1) {
            const existingQuantity = cart.items[existingItemIndex].quantity;
            const canAddQuantity = availableStock - existingQuantity;

            if (canAddQuantity > 0) {
                // Update quantity and totalAmount
                cart.items[existingItemIndex].quantity += Math.min(quantity, canAddQuantity);
                cart.items[existingItemIndex].totalAmount =
                    cart.items[existingItemIndex].quantity * product.finalPrice;

                // Update totalItems and totalAmount in the cart
                cart.totalItems = cart.items.length;
                cart.totalAmount = cart.items.reduce((total, item) => total + item.totalAmount, 0);

                // Save the cart
                await cart.save();

                return res.json({
                    message: `Only ${availableStock} items available for this size. Product quantity updated to ${cart.items[existingItemIndex].quantity} in cart.`,
                });
            }
        }

        // If available size is greater than or equal to 10 and product+size doesn't exist
        if (availableStock >= 10 && existingItemIndex === -1) {
            const newItem = {
                product: product._id,
                size,
                quantity: Math.min(quantity, 10), // Add 10 quantities only
                totalAmount: Math.min(quantity, 10) * product.finalPrice,
            };

            cart.items.push(newItem);
            cart.totalItems = cart.items.length;
            cart.totalAmount = cart.items.reduce((total, item) => total + item.totalAmount, 0);

            // Save the cart
            await cart.save();

            return res.json({
                message: 'Maximum 10 quantities can be added to cart. Product added to cart successfully.',
            });
        }

        // If available size is greater than or equal to 10 and product+size exists
        if (availableStock >= 10 && existingItemIndex !== -1) {
            const existingQuantity = cart.items[existingItemIndex].quantity;
            const canAddQuantity = 10 - existingQuantity;

            if (canAddQuantity > 0) {
                // Update quantity and totalAmount
                cart.items[existingItemIndex].quantity += Math.min(quantity, canAddQuantity);
                cart.items[existingItemIndex].totalAmount =
                    cart.items[existingItemIndex].quantity * product.finalPrice;

                // Update totalItems and totalAmount in the cart
                cart.totalItems = cart.items.length;
                cart.totalAmount = cart.items.reduce((total, item) => total + item.totalAmount, 0);

                // Save the cart
                await cart.save();

                return res.json({
                    message: 'Maximum 10 quantities can be added to cart. Product quantity updated to ' +
                        `${cart.items[existingItemIndex].quantity} in cart.`,
                });
            }
        }

        // Handle other scenarios here...

        res.json({ message: 'Product added to cart successfully' });
    } catch (error) {
        console.error('Error adding product to cart:', error.message);
        res.status(500).json({ error: 'Internal server error' });
    }
};

const cartLoader = async (req, res) => {
    try {
        // Extract userId from the session
        const userId = req.session.userId;

        // Find the user's cart
        let cart = await Cart.findOne({ user: userId }).populate({
            path: 'items.product',
            match: { isDeleted: false }, // Only populate products that are not deleted
        });

        // Check if the cart exists; if not, create a new empty cart
        if (!cart) {
            cart = new Cart({ user: userId, items: [] });
            await cart.save();
        }

        // Calculate total price for each item
        cart.items.forEach(item => {
            item.totalAmount = item.quantity * item.product.finalPrice;
            item.totalInitialAmount = item.quantity * item.product.initialPrice;
        });

        // Calculate total price for the entire cart
        cart.totalAmount = parseFloat(cart.items.reduce((total, item) => total + item.totalAmount, 0)).toFixed(2);
        cart.totalInitialAmount = parseFloat(cart.items.reduce((total, item) => total + item.totalInitialAmount, 0)).toFixed(2);

        // Render the cart page with cart details
        res.render('./user/cart.ejs', {
            cart
        });
    } catch (error) {
        console.log(error.message);
        req.flash('error', 'Something went wrong while loading the cart');
        return res.redirect('/home');
    }
};

const cartItemDeleteHandler = async (req, res) => {


    try {

        const itemId = req.params.itemId;

        const userId = req.session.userId;

        if (!userId) {
            return res.status(403).json({ message: 'User not authenticated' });
        }

        // Check if the user has a cart
        const cart = await Cart.findOne({ user: userId });

        if (!cart) {
            return res.status(404).json({ message: 'Cart not found for the user' });
        }

        if (cart.totalItems <= 0) {
            return res.status(404).json({ message: 'No items left in the cart' });
        }

        // Check if the item is in the cart
        const itemIndex = cart.items.findIndex(item => item._id.equals(itemId));

        if (itemIndex === -1) {
            return res.status(404).json({ message: 'Item not found in the cart' });
        }

        // Update totalAmount by subtracting the totalAmount of the deleted item
        cart.totalAmount -= cart.items[itemIndex].totalAmount;

        // Remove the item from the items array
        cart.items.splice(itemIndex, 1);

        cart.totalItems--;

        // Save the updated cart
        await cart.save();

        return res.status(200).json({ message: 'Item deleted successfully' });
    } catch (error) {
        console.error('Error deleting item:', error);
        return res.status(500).json({ message: 'Internal Server Error' });
    }
};


const cartItemQuantityUpdateHandler = async (req, res) => {
    try {

        const itemId = req.query.itemId;
        const operation = parseInt(req.query.operation);
        const userId = req.session.userId;


        if (!userId) {
            return res.status(403).json({ message: 'User not authenticated' });
        } else {
            // Check if the user has a cart
            const cartData = await Cart.findOne({ user: userId });

            if (!cartData) {
                console.log("Cart not found")
                return res.status(404).json({ message: 'Cart not found for the user' });
            } else {

                // Check if the item is in the cart
                const itemIndex = cartData.items.findIndex(item => item._id.equals(itemId));

                if (itemIndex === -1) {
                    console.log("itemIndex not found")
                    return res.status(404).json({ message: 'Item not found in the cart' });
                }

                if (cartData.items[itemIndex].quantity === 1 && operation === -1 || cartData.items[itemIndex].quantity === 10 && operation === 1) {
                    console.log("MAximum or minimum reached.")
                    return res.redirect('/cart');
                }

                // Get the productId from cartData
                const productId = cartData.items[itemIndex].product;

                // Fetch the product from the Product collection
                const product = await Products.findOne({ _id: productId });

                if (!product) {
                    console.log("Product not found")
                    return res.status(404).json({ message: 'Corresponding Product not found' });
                }

                // Now you can access the initialPrice


                const finalPrice = product.finalPrice;

                //calculating the price of single product
                const finalPriceChange = parseFloat(finalPrice * operation);

                cartData.items[itemIndex].quantity = parseInt(cartData.items[itemIndex].quantity) + operation;
                cartData.items[itemIndex].totalAmount = parseFloat(cartData.items[itemIndex].totalAmount + finalPriceChange);
                cartData.totalAmount = parseFloat(cartData.totalAmount + finalPriceChange);


                const updatedItem = await cartData.save();

                if (updatedItem) {
                    // Send a JSON response with a success message
                    return res.status(200).json({ message: 'Quantity updated successfully', cart: updatedItem });
                }


            }



        }

    } catch (error) {
        console.error('Error updating item:', error);
        return res.status(500).json({ message: 'Internal Server Error' });
    }
}

const cartItemSizeUpdateHandler = async (req, res) => {
    try {
        const itemId = req.query.itemId;
        const newSize = req.query.newSize;
        const prevSize = req.query.prevSize;
        const userId = req.session.userId;

        if (!userId) {
            console.log("corresponding user not found login")
            return res.status(403).json({ message: 'User not authenticated' });
        }

        // Check if the user has a cart
        const cartData = await Cart.findOne({ user: userId });

        if (!cartData) {
            console.log("Cart not found")
            return res.status(404).json({ message: 'Cart not found for the user' });
        }

        // Check if the item is in the cart
        const itemIndex = cartData.items.findIndex(item => item._id.equals(itemId));

        if (itemIndex === -1) {
            console.log("itemIndex not found")
            return res.status(404).json({ message: 'Item not found in the cart' });
        }

        // Check if there is already an item with the same product ID and newSize combination
        const existingItemIndex = cartData.items.findIndex(item =>
            item.product.equals(cartData.items[itemIndex].product) && item.size === newSize
        );

        if (existingItemIndex !== -1) {
            // If an item with the same product ID and newSize exists, append quantity and total amount
            cartData.items[existingItemIndex].quantity = parseFloat(cartData.items[existingItemIndex].quantity) + parseFloat(cartData.items[itemIndex].quantity);
            cartData.items[existingItemIndex].totalAmount = parseFloat(cartData.items[existingItemIndex].totalAmount) + parseFloat(cartData.items[itemIndex].totalAmount);

            singleQuantityAmount = cartData.items[existingItemIndex].totalAmount / cartData.items[existingItemIndex].quantity;

            cartData.items[existingItemIndex].totalAmount -= (cartData.items[existingItemIndex].quantity > 10) ? ((cartData.items[existingItemIndex].quantity - 10) * singleQuantityAmount) : 0;

            cartData.items[existingItemIndex].quantity = 10;

            // Delete the old item
            cartData.items.splice(itemIndex, 1);

        } else {
            // If no item with the same product ID and newSize, simply update the size
            cartData.items[itemIndex].size = newSize;
        }

        const updatedItem = await cartData.save();

        if (updatedItem) {
            // Send a JSON response with a success message
            console.log("size updated");
            return res.status(200).json({ message: 'Size updated successfully', cart: updatedItem });
        }

    } catch (error) {
        console.error('Error updating item:', error);
        return res.status(500).json({ message: 'Internal Server Error' });
    }
}


const addressLoader = async (req, res) => {
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

        if (invalidItems.length > 0) {
            // If there are invalid items, redirect to the cart page with the invalid items
            req.flash('error', "You have some invalid items in your cart. Please click On the MOVE TO ADDDRESS button to know more.")
            return res.render('./user/cart', { invalidItems, cart });
        } else {
            // Render the payment-selection page with the first address and cart details
            res.render('./user/address.ejs', { firstAddress, user, cart });
        }


    } catch (error) {
        console.log(error.message);
        req.flash('error', "Something happened while loading the address page");
        res.redirect('/cart');
    }
};

const addressAddLoader = async (req, res) => {
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
        res.status(500).json({ message: 'Internal Server Error' });
    }
};

const addressEditLoader = async (req, res) => {
    try {
        const userId = req.session.userId;

        const addressId = req.params.addressId;

        // Extract values from req.body
        const { name, phoneNumber, street, city, state, zipCode } = req.body;

        let updatedAddress;

        if (!addressId) {
            return res.status(404).json({ message: 'Address not found' });
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
        res.status(500).json({ message: 'Internal Server Error' });
    }
};



const addressDeleteHandler = async (req, res) => {
    try {
        const userId = req.session.userId;
        const addressId = req.params.addressId;



        // Delete document from the address collection
        const deletedAddress = await Address.findOneAndDelete({ _id: addressId });

        if (!deletedAddress) {
            return res.status(404).json({ message: 'Address not found' });
        }

        // Remove addressId from the user's addresses array
        await User.findByIdAndUpdate(userId, { $pull: { addresses: addressId } });

        res.status(200).json({ message: 'Address deleted successfully' });
    } catch (error) {
        console.error(error.message);
        res.status(500).json({ message: 'Internal Server Error' });
    }
};

const addressToPaymentHandler = async (req, res) => {
    try {


        const userId = req.session.userId;
        const addressId = req.params.addressId;



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
            await user.save();
        }

        // Redirect to the select-payment page

        res.redirect('/payment-selection');

    } catch (error) {
        console.log(error.message);
        return res.redirect('/address')
    }
}


const cartToAddressHandler = async (req, res) => {
    try {
        // Assuming you have the user ID in the session
        const userId = req.session.userId;

        // Find the user's cart in the Cart collection
        const cart = await Cart.findOne({ user: userId });

        if (!cart) {
            return res.status(404).json({ error: 'User\'s cart not found' });
        }

        // Iterate through cart items and check quantity conditions
        const invalidItems = [];

        if (cart.length === 0) {
            return res.status(404).json({ error: 'User\'s cart is empty' });
        }

        for (const item of cart.items) {
            const product = await Products.findById(item.product);

            if (!product) {
                return res.status(404).json({ error: 'Product not found' });
            }

            const selectedSize = item.size;
            const selectedQuantity = item.quantity;

            // Assuming sizes array has only one element
            const stockSchema = product.sizes[0];

            // Check if the selected size exists in the stock schema
            if (!(selectedSize in stockSchema)) {
                invalidItems.push({
                    item: item.product,
                    productName: product.productName,
                    brandName: product.brandName,
                    size: selectedSize,
                    selectedQuantity,
                    reason: 'Invalid size',
                });
                continue;
            }

            const availableStock = stockSchema[selectedSize].availableStock;

            // Check if availableStock is 0 or quantity is greater than available stock or greater than 10
            if (availableStock === 0 || selectedQuantity > 10 || selectedQuantity > availableStock) {
                invalidItems.push({
                    item: item.product,
                    productName: product.productName,
                    brandName: product.brandName,
                    size: selectedSize,
                    selectedQuantity,
                    reason: availableStock === 0 ? 'Not available' : (selectedQuantity > 10 ? 'Max quantity should be 10' : `Only ${availableStock} number quantity left.`),
                });
            }
        }

        if (invalidItems.length > 0) {
            // If there are invalid items, return the details without redirecting
            return res.json({ invalidItems });
        }

        // If all items pass the checks, redirect to the address page
        // Replace the following line with the actual redirect code
        res.json({ message: 'Redirect to address page' });
    } catch (error) {
        console.error('Error processing cart to address:', error.message);
        res.status(500).json({ error: 'Internal server error' });
    }
};


const paymentSelectionLoader = async (req, res) => {
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

        if (invalidItems.length > 0) {
            // If there are invalid items, redirect to the cart page with the invalid items
            req.flash('error', "You have some invalid items in your cart. Please click On the MOVE TO ADDDRESS button to know more.")
            return res.render('./user/cart', { invalidItems, cart });
        } else {
            // Render the payment-selection page with the first address and cart details
            res.render('./user/payment-selection.ejs', { firstAddress, user, cart });
        }


    } catch (error) {
        console.log(error.message);
        req.flash('error', "Something happened while loading the address page");
        res.redirect('/cart');
    }
};

const codPlaceOrderHandler = async (req, res) => {
    try {


        const userId = req.session.userId;
        const addressId = req.params.addressId;



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

        // Calculate total price details for the cart
        cart.items.forEach(item => {
            item.totalAmount = item.quantity * item.product.finalPrice;
            item.totalInitialAmount = item.quantity * item.product.initialPrice;
        });
        cart.totalAmount = parseFloat(cart.items.reduce((total, item) => total + item.totalAmount, 0)).toFixed(2);
        cart.totalInitialAmount = parseFloat(cart.items.reduce((total, item) => total + item.totalInitialAmount, 0)).toFixed(2);
        cart.totalDiscountAmount = parseFloat(cart.totalInitialAmount - cart.totalAmount).toFixed(2);

        if (invalidItems.length > 0) {
            // If there are invalid items, redirect to the cart page with the invalid items
            req.flash('error', "You have some invalid items in your cart. Please click On the MOVE TO ADDDRESS button to know more.")
            return res.render('./user/cart', { invalidItems, cart });
        }

        //updating the order model

        // Populate the shipping address details
        const populatedAddress = await Address.findById(user.addresses[0]);

        // Create an array to store the promises of saving each order
        const orderPromises = [];

        // Iterate through each item in the cart
        cart.items.forEach(item => {
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
                totalFinalAmount: item.totalAmount,
                totalInitialMrp: item.totalInitialAmount,
            });

            // Save the order document and push the promise to the array
            orderPromises.push(order.save());
        });

        // Use Promise.all to wait for all order promises to resolve
        const orderUpdates = await Promise.all(orderPromises);


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
        }

        // Save the updated product details to the database
        const productUpdate = await Products.bulkWrite(cart.items.map(item => ({
            updateOne: {
                filter: { _id: item.product._id },
                update: { $set: { sizes: item.product.sizes } },
            },
        })
        ));

        if (orderUpdates && productUpdate) {
            // If all updates are successful, remove the cart items
            cart.items = [];
            cart.totalItems = 0;
            cart.totalAmount = 0;

            cartUpdate = await cart.save();
        }

        if (cartUpdate) {

            res.render('./user/order-confirmed.ejs',{ orders: orderUpdates });
        }


    } catch (error) {
        console.log(error.message);
        return res.redirect('/address')
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
    addToCartHandler,
    cartLoader,
    cartItemDeleteHandler,
    cartItemQuantityUpdateHandler,
    cartItemSizeUpdateHandler,
    addressLoader,
    addressAddLoader,
    addressEditLoader,
    addressDeleteHandler,
    cartToAddressHandler,
    paymentSelectionLoader,
    addressToPaymentHandler,
    codPlaceOrderHandler,
}