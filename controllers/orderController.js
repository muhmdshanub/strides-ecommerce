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
const { NetworkContextImpl } = require('twilio/lib/rest/supersim/v1/network');

async function getAllCategories() {
    try {
      const categories = await Category.find();
      return categories;
    } catch (error) {
      throw error;
    }
  }


const profileOrdersLoader = async (req, res, next) => {
    try {

        const userId = req.session.userId;

        if (!userId) {
            console.log("corresponding user not found login");
            return res.status(403).json({ message: 'User not authenticated' });
        }

        // Find orders for the current user and populate specific product fields
        const orders = await Order.find({ user: userId })
            .populate({
                path: 'product',
                model: 'Product',
                select: '_id images.image1.name', // Include the fields you need
            })
            .exec();

        const categoriesData = await  getAllCategories();

        // Render the payment-selection page with the first address and cart details
        res.render('./user/profile/orders.ejs',  { orders,categories : categoriesData });

    } catch (error) {
        console.log(error.message);
        next(error)
    }
}

const profileOrdersCancelHandler = async (req, res, next) => {
    try {
        const orderId = req.params.orderId;
        const userId = req.session.userId;

        if (!mongoose.Types.ObjectId.isValid(orderId)) {
            const genericErrorMessage = 'Invalid order ID: ';
            const genericError = new Error(genericErrorMessage);
            genericError.status = 500;
            throw genericError;
        }
        // Check if the orderId belongs to the userId in the collection document
        const order = await Order.findOne({ _id: orderId, user: userId });

        if (!order) {
            const genericErrorMessage = 'order not found: ' + error.message;
            const genericError = new Error(genericErrorMessage);
            genericError.status = 404;
            throw genericError;
        }

        // Check if the current status is 'Placed'
        if (order.status !== 'Placed') {
            
            const genericErrorMessage = 'Cannot cancel the order right now. : ';
            const genericError = new Error(genericErrorMessage);
            genericError.status = 400;
            throw genericError;
        }

        // Change the status of the document to 'Cancelled'
        order.status = 'Cancelled';
        const updatedOrder = await order.save();

        // Send back the new updated order details to the client
        res.json({ message: 'Order cancelled successfully', order: updatedOrder });
    } catch (error) {
        console.error('Error cancelling order:', error);
        next(error)
    }
};

const profileOrdersReturnHandler = async (req, res, next) => {
    try {
        const orderId = req.params.orderId;
        const userId = req.session.userId;


        if (!mongoose.Types.ObjectId.isValid(orderId)) {
            const genericErrorMessage = 'Invalid order ID: ';
            const genericError = new Error(genericErrorMessage);
            genericError.status = 500;
            throw genericError;
        }

        // Check if the orderId belongs to the userId in the collection document
        const order = await Order.findOne({ _id: orderId, user: userId });

        if (!order) {
            return res.status(404).json({ message: 'Order not found for the user' });
        }
        if(order.deliveredDate){
            deliveredDate = new Date(order.deliveredDate);
            currentDate = new Date();
            daysDifference = Math.abs(deliveredDate - currentDate) / (1000 * 60 * 60 * 24);
            
            // Check if the current status is 'Delivered'
            if (order.status === 'Delivered' && daysDifference <= 10) {
                // Change the status of the document to 'Cancelled'
                order.status = 'Returned';
                const updatedOrder = await order.save();
                 // Send back the new updated order details to the client
                res.json({ message: 'Order returned successfully', order: updatedOrder });

            }else{
                return res.status(400).json({ message: 'Cannot return the order. Either the order status is not "Delivered" or the return period has expired.' });
                const genericErrorMessage = 'cannot return the order : ' ;
                const genericError = new Error(genericErrorMessage);
                genericError.status = 400;
                throw genericError;
           
            }
        }
 
       
    } catch (error) {
        console.error('Error returning order:', error);
        next(error)
    }
};


const codPlaceOrderHandler = async (req, res, next) => {
    try {


        const userId = req.session.userId;
        const addressId = req.params.addressId;

        if (!mongoose.Types.ObjectId.isValid(addressId)) {
            const genericErrorMessage = 'Invalid address ID: ';
            const genericError = new Error(genericErrorMessage);
            genericError.status = 500;
            throw genericError;
        }

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
            const categories = await getAllCategories();
            // If there are invalid items, redirect to the cart page with the invalid items
            req.flash('error', "You have some invalid items in your cart. Please click On the MOVE TO ADDDRESS button to know more.")
            return res.render('./user/cart', { invalidItems, cart , categories});
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

                const categories = await getAllCategories();
            res.render('./user/order-confirmed.ejs',{ orders: orderUpdates, categories });
        }


    } catch (error) {
        console.log(error.message);
        next(error)
    }
}

const ordersListLoaderAdmin = async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const pageSize = parseInt(req.query.pageSize) || 10;

        const options = {
            page: page,
            limit: pageSize,
            populate: {
                path: 'product',
                select: '_id images.image1.name', // Specify the fields to populate
            },
        };

        const ordersData = await Order.paginate({}, options);

        res.render('./admin/orderList.ejs', {
            orders: ordersData.docs,
            currentPage: ordersData.page,
            totalPages: ordersData.totalPages,
        });
    } catch {
        console.error('Error loading order list:', error);
        next(error)
    }
}
      
const orderStatusUpdateHandlerAdmin = async (req, res, next) => {
    try {
        // Extract values from the request body
        const { orderId, newStatus } = req.body;

        // Check if orderId and newStatus are present in the request body
        if (!orderId || !newStatus) {
            return res.status(400).json({ message: 'Missing orderId or newStatus in the request body' });
        }

        // Find the corresponding order
        const order = await Order.findById(orderId);

        // If no order found, send a response
        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }

        // Update the status field and save
        order.status = newStatus;

        // If the new status is 'Placed', update the orderDate with the current date
        if (newStatus === 'Placed') {
            order.orderDate = Date.now();
        }

        // If the new status is 'Delivered', update the deliveredDate with the current date
        if (newStatus === 'Delivered') {
            order.deliveredDate = Date.now();
        }

        // Save the changes
        await order.save();

        // Send back a success response with the updated order details
        res.status(200).json({ message: 'Order status updated successfully', order: order });
    } catch (error) {
        console.error('Error updating order status:', error.message);
        next(error)
    }
};

module.exports = {


    codPlaceOrderHandler,
    profileOrdersLoader,
    profileOrdersCancelHandler,
    profileOrdersReturnHandler,
    ordersListLoaderAdmin,
    orderStatusUpdateHandlerAdmin,
}
