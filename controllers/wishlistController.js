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
const sendOtpEmail = require('../utils/sendEmail');


const bcrypt = require('bcrypt');


const addToWishlistHandler = async (req, res) => {
    try {
        const userId = req.session.userId;
        const productId = req.params.productId;

        // Check if there is a wishlist document with the same userId
        let wishlist = await Wishlist.findOne({ user: userId });

        // If there is no wishlist document, create a new one
        if (!wishlist) {
            console.log("no wishlist document find for the user");
            return res.status(404).json({ error: 'User\'s wishlist not found' });
        }
        // Find the product in the database
        const product = await Products.findOne({ _id: productId, isDeleted: false });

        if (!product) {
            console.log("no corresponding product is available on product ");
            return res.status(404).json({ error: 'Product not found' });

        }

        // Check if at least one size has available stock greater than 0
        const isAnySizeAvailable = ['small', 'medium', 'large', 'extraLarge'].some(size => {
            return product.sizes[0][size].availableStock > 0;
        });

        if (!isAnySizeAvailable) {
            console.log("every size is out of stock");
            return res.json({
                message: 'All sizes are Out of stock. Item not added to the cart.',
            });
        }



        // Check if the product is already in the wishlist
        const isProductInWishlist = wishlist.products?.some(product => product.product.equals(productId));

        if (isProductInWishlist) {
            console.log("product is already present in users wishlist");
            // Product is already in the wishlist
            return res.json({ message: 'Product is already in the wishlist.' });
        }

        // Add the product to the wishlist
        const newProduct = {
            product: product._id,
        }

        wishlist.products.push(newProduct);

        await wishlist.save();

        // Send a successful response
        return res.json({ message: 'Product added to the wishlist successfully.' });

    } catch (error) {
        console.error('Error adding to wishlist:', error.message);
        // Handle error scenarios and send an appropriate response
        return res.status(500).json({ error: 'Internal Server Error' });
    }
};

const removeFromWishlistHandler = async (req, res) => {
    try {
        const productId = req.params.productId;
        const userId = req.session.userId;

        if (!userId) {
            return res.status(403).json({ message: 'User not authenticated' });
        }

        // Check if the user has a wishlist
        const wishlist = await Wishlist.findOne({ user: userId });

        if (!wishlist) {
            return res.status(404).json({ message: 'Wishlist not found for the user' });
        }

        // Check if the product is in the wishlist
        const productIndex = wishlist.products.findIndex(product => product.product.equals(productId));

        if (productIndex === -1) {
            return res.status(404).json({ message: 'Product not found in the wishlist' });
        }

        // Remove the product from the products array
        wishlist.products.splice(productIndex, 1);

        // Save the updated wishlist
        await wishlist.save();

        return res.status(200).json({ message: 'Product removed from wishlist successfully', productsLength: wishlist.products.length });
    } catch (error) {
        console.error('Error removing product from wishlist:', error);
        return res.status(500).json({ message: 'Internal Server Error' });
    }
};

const wishlistLoader = async (req, res) => {
    try {
        // Ensure the user is authenticated
        if (!req.session.userId) {
            return res.status(403).json({ message: 'User not authenticated' });
        }

        const userId = req.session.userId;

        // Find the user's cart
        let wishlist = await Wishlist.findOne({ user: userId }).populate({
            path: 'products.product',
            match: { isDeleted: false }, // Only populate products that are not deleted
        });

        if (!wishlist) {
            // No wishlist available for the user, redirect to home
            return res.redirect('/home'); // Adjust the home route as needed
        }

        // Filter out products with no available sizes
        wishlist.products = wishlist.products.filter(product => {
            const isAnySizeAvailable = ['small', 'medium', 'large', 'extraLarge'].some(size => {
                return product.product.sizes[0][size].availableStock > 0;
            });

            return isAnySizeAvailable;
        });


        // Render the wishlist page with the populated wishlist data
        return res.render('./user/wishlist', { wishlist });

    } catch (error) {
        console.error('Error loading wishlist:', error);
        return res.status(500).json({ message: 'Internal Server Error' });
    }
};


const moveFromWishlistToCartHandler = async (req, res) => {
    try {

        const productId = req.params.productId;
        // Get user ID from the session or authentication token
        const userId = req.session.userId;

        // Find the user's cart in the Cart collection
        const cart = await Cart.findOne({ user: userId });

        if (!cart) {
            return res.status(404).json({ error: 'User\'s cart not found' });
        }

        // Find the product in the database
        product = await Products.findOne({ _id: productId, isDeleted: false });

        if (!product) {
            return res.status(404).json({ error: 'Product not found' });

        }
        

        const selectedQuantity = 1;

        const selectedSize = (product.sizes[0]['small'].availableStock > 0) ? "small" : (product.sizes[0]['medium'].availableStock > 0) ? "medium" : (product.sizes[0]['large'].availableStock > 0) ? "large" : (product.sizes[0]['extraLarge'].availableStock > 0) ? "extraLarge" : null;
        
        if (selectedSize === null) {
            // Handle out of stock case
            return res.json({
                message: 'Item is Out of stock. Not added to the cart.',
            });
        }




        // Check if the product with the selected size already exists in the cart
        const existingItemIndex = cart.items.findIndex(
            (item) => item.product.equals(product._id) && item.size === selectedSize
        );

        availableStock = product.sizes[0][`${selectedSize}`].availableStock;

        // If available size is less than 10 and product+size doesn't exist
        if (availableStock < 10 && existingItemIndex === -1) {
            const newItem = {
                product: product._id,
                size: selectedSize,
                quantity: 1,
                totalAmount: 1 * product.finalPrice,
            };

            cart.items.push(newItem);
            cart.totalItems = cart.items.length;
            cart.totalAmount = cart.items.reduce((total, item) => total + item.totalAmount, 0);

            // Save the cart
            await cart.save();

            const wishlist = await Wishlist.findOne({ user: userId });

            // Check if the product is in the wishlist
            const productIndex = wishlist.products.findIndex(product => product.product.equals(product._id));

             // Remove the product from the products array
             wishlist.products.splice(productIndex, 1);

             await wishlist.save();

            return res.json({
                message: `Only ${availableStock} items available for this size. Product added to cart successfully.`,
                productsLength: wishlist.products.length,
            });
        }

        // If available size is less than 10 and product+size exists
        if (availableStock < 10 && existingItemIndex !== -1) {
            const existingQuantity = cart.items[existingItemIndex].quantity;
            const canAddQuantity = availableStock - existingQuantity;

            if (canAddQuantity > 0) {
                // Update quantity and totalAmount
                cart.items[existingItemIndex].quantity += 1;
                cart.items[existingItemIndex].totalAmount =
                    cart.items[existingItemIndex].quantity * product.finalPrice;

                // Update totalItems and totalAmount in the cart
                cart.totalItems = cart.items.length;
                cart.totalAmount = cart.items.reduce((total, item) => total + item.totalAmount, 0);

                // Save the cart
                await cart.save();


                const wishlist = await Wishlist.findOne({ user: userId });

                // Check if the product is in the wishlist
                const productIndex = wishlist.products.findIndex(product => product.product.equals(product._id));

                // Remove the product from the products array
                wishlist.products.splice(productIndex, 1);

                await wishlist.save();


                return res.json({
                    message: `Only ${availableStock} items available for this size. Product quantity updated to ${cart.items[existingItemIndex].quantity} in cart.`,
                    productsLength: wishlist.products.length,
                });
            } else {
                return res.status(404).json({
                    message: `Only ${availableStock} items available for this size. Product quantity on cart  Already at maximum.`,
                });
            }
        }

        // If available size is greater than or equal to 10 and product+size doesn't exist
        if (availableStock >= 10 && existingItemIndex === -1) {
            const newItem = {
                product: product._id,
                size: selectedSize,
                quantity: 1, // Add 10 quantities only
                totalAmount: product.finalPrice,
            };

            cart.items.push(newItem);
            cart.totalItems = cart.items.length;
            cart.totalAmount = cart.items.reduce((total, item) => total + item.totalAmount, 0);

            // Save the cart
            await cart.save();

            const wishlist = await Wishlist.findOne({ user: userId });

            // Check if the product is in the wishlist
            const productIndex = wishlist.products.findIndex(product => product.product.equals(product._id));

            // Remove the product from the products array
            wishlist.products.splice(productIndex, 1);

            await wishlist.save();

            return res.json({
                message: 'Product added to cart successfully.',
                productsLength: wishlist.products.length,
            });
        }

        // If available size is greater than or equal to 10 and product+size exists
        if (availableStock >= 10 && existingItemIndex !== -1) {
            const existingQuantity = cart.items[existingItemIndex].quantity;
            const canAddQuantity = 10 - existingQuantity;

            if (canAddQuantity > 0) {
                // Update quantity and totalAmount
                cart.items[existingItemIndex].quantity += 1;
                cart.items[existingItemIndex].totalAmount =
                    cart.items[existingItemIndex].quantity * product.finalPrice;

                // Update totalItems and totalAmount in the cart
                cart.totalItems = cart.items.length;
                cart.totalAmount = cart.items.reduce((total, item) => total + item.totalAmount, 0);

                // Save the cart
                await cart.save();
                const wishlist = await Wishlist.findOne({ user: userId });

                // Check if the product is in the wishlist
                const productIndex = wishlist.products.findIndex(product => product.product.equals(product._id));

                // Remove the product from the products array
                wishlist.products.splice(productIndex, 1);

                await wishlist.save();

                return res.json({
                    message: 'Maximum 10 quantities can be added to cart. Product quantity updated to ' +
                        `${cart.items[existingItemIndex].quantity} in cart.`,
                    productsLength: wishlist.products.length,
                });
            }
        }


    } catch (error) {
        console.error('Error adding product to cart:', error.message);
        res.status(500).json({ error: 'Internal server error' });
    }
};

module.exports = {

    addToWishlistHandler,
    removeFromWishlistHandler,
    wishlistLoader,
    moveFromWishlistToCartHandler,
}