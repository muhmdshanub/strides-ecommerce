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
const Coupon = require('../models/couponModel');
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

const addToCartHandler = async (req, res, next) => {
    try {
        const productId = req.params.productId;
        const { size, quantity } = req.body;

        if (!mongoose.Types.ObjectId.isValid(productId)) {
            const genericErrorMessage = 'Invalid product ID: ';
            const genericError = new Error(genericErrorMessage);
            genericError.status = 500;
            throw genericError;
        }

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

            // Rest COupon details of cart
            cart.coupon = {
                amount: 0,
                code: "",
            };

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
        next(error)
    }
};

const cartLoader = async (req, res, next) => {
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

        const categoriesData = await getAllCategories();

        // Fetch all documents from the coupons collection
        const allCoupons = await Coupon.find();

        // Check if the user's orders field is not empty
        const user = await User.findById(userId);
        if (user.orders && user.orders.length > 0) {
            // Remove the WELCOME350 coupon from the list
            const welcomeCouponIndex = allCoupons.findIndex(coupon => coupon.code === 'WELCOME350');
            if (welcomeCouponIndex !== -1) {
                allCoupons.splice(welcomeCouponIndex, 1);
            }
        }

        // Render the cart page with cart details
        res.render('./user/cart.ejs', {
            cart,
            categories: categoriesData,
            coupons: allCoupons,
        });
    } catch (error) {
        console.log(error.message);
        next(error)
    }
};

const cartItemDeleteHandler = async (req, res, next) => {


    try {

        const itemId = req.params.itemId;

        const userId = req.session.userId;

        if (!userId) {
            return res.status(403).json({ message: 'User not authenticated' });
        }
        if (!mongoose.Types.ObjectId.isValid(itemId)) {
            const genericErrorMessage = 'Invalid item ID: ';
            const genericError = new Error(genericErrorMessage);
            genericError.status = 500;
            throw genericError;
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

        // Rest COupon details of cart
        cart.coupon = {
            amount: 0,
            code: "",
        };

        // Save the updated cart
        const updatedCart = await cart.save();

        return res.status(200).json({ message: 'Item deleted successfully', cart: updatedCart });
    } catch (error) {
        console.error('Error deleting item:', error);
        next(error)
    }
};


const cartItemQuantityUpdateHandler = async (req, res, next) => {
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
                    console.log("Maximum or minimum reached.")
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

                const size = cartData.items[itemIndex].size;
                const availableStock = product.sizes[0][`${size}`].availableStock;


                if (cartData.items[itemIndex].quantity === availableStock && operation === 1) {
                    console.log("Maximum available stock is reached.")
                    return res.status(404).json({ message: 'Maximum available stock is reached' });
                }
                // Now you can access the initialPrice


                const finalPrice = product.finalPrice;

                //calculating the price of single product
                const finalPriceChange = parseFloat(finalPrice * operation);

                cartData.items[itemIndex].quantity = parseInt(cartData.items[itemIndex].quantity) + operation;
                cartData.items[itemIndex].totalAmount = parseFloat(cartData.items[itemIndex].totalAmount + finalPriceChange);
                cartData.totalAmount = parseFloat(cartData.totalAmount + finalPriceChange);

                // Rest COupon details of cart
                cartData.coupon = {
                    amount: 0,
                    code: "",
                };

                const updatedItem = await cartData.save();

                if (updatedItem) {
                    // Send a JSON response with a success message
                    return res.status(200).json({ message: 'Quantity updated successfully', cart: updatedItem });
                }


            }



        }

    } catch (error) {
        console.error('Error updating item:', error);
        next(error)
    }
}

const cartItemSizeUpdateHandler = async (req, res, next) => {
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

        // Recalculate totalItems and totalAmount
        cartData.totalItems = cartData.items.reduce((total, item) => total + item.quantity, 0);
        cartData.totalAmount = cartData.items.reduce((total, item) => total + item.totalAmount, 0);


        // Rest COupon details of cart
        cartData.coupon = {
            amount: 0,
            code: "",
        };

        const updatedItem = await cartData.save();

        if (updatedItem) {
            // Send a JSON response with a success message
            console.log("size updated");
            return res.status(200).json({ message: 'Size updated successfully', cart: updatedItem });
        }

    } catch (error) {
        console.error('Error updating item:', error);
        next(error)
    }
}




const cartToAddressHandler = async (req, res, next) => {
    try {
        // Assuming you have the user ID in the session
        const userId = req.session.userId;

        // Find the user's cart in the Cart collection
        const cart = await Cart.findOne({ user: userId });

        if (!cart) {
            const genericErrorMessage = 'No cart found for user : ';
            const genericError = new Error(genericErrorMessage);
            genericError.status = 500;
            throw genericError;
        }

        // Check if the cart has a coupon
        if (cart.coupon) {
            const isValidCoupon = await isCouponValidForUser(cart.coupon, userId, cart);

            // If the coupon is not valid, reset it in the cart
            if (!isValidCoupon) {
                console.log('Invalid coupon. Resetting cart coupon.');
                cart.coupon.amount = 0;
                cart.coupon.code="";
                await cart.save();
                return res.status(400).json({ error: 'Invalid coupon. Cart coupon has been reset.' });
            }
        }

        // Iterate through cart items and check quantity conditions
        const invalidItems = [];

        if (cart.items.length === 0) {
            const genericErrorMessage = 'Empty cart: ';
            const genericError = new Error(genericErrorMessage);
            genericError.status = 404;
            throw genericError;
        }

        for (const item of cart.items) {
            const product = await Products.findById(item.product);

            if (!product) {
                const genericErrorMessage = 'product not found : ';
                const genericError = new Error(genericErrorMessage);
                genericError.status = 404;
                throw genericError;
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
        next(error)
    }
};

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
module.exports = {
    addToCartHandler,
    cartLoader,
    cartItemDeleteHandler,
    cartItemQuantityUpdateHandler,
    cartItemSizeUpdateHandler,
    cartToAddressHandler,
}