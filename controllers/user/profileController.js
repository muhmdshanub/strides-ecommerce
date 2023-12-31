
const mongoose = require('mongoose');

const otpGenerator = require('otp-generator');
const User = require('../../models/userModel');
const OTP = require('../../models/otpModel');
const Address = require('../../models/addressModel');
const Category = require('../../models/categoryModel');
const Products = require('../../models/productModel');
const Cart = require('../../models/cartModel');
const Order = require('../../models/orderModel');
const sendOtpEmail = require('../../utils/sendEmail'); // Your function to send OTP via email



const bcrypt = require('bcrypt');

const profileLoader = async (req, res) => {
    try {

        const userId = req.session.userId;

        const user = await User.findById(userId).populate('addresses').exec();

        const year = user.dateOfBirth.getFullYear();
        const month = (user.dateOfBirth.getMonth() + 1).toString().padStart(2, '0');
        const day = user.dateOfBirth.getDate().toString().padStart(2, '0');

        user.stringDateOfBirth = `${day}-${month}-${year}`;


        res.render('./user/profile/profile.ejs', { user });

    } catch (error) {
        console.log(error.message)
        res.redirect('/home');
    }
}

const profileUserEditHandler = async (req, res) => {
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
        res.status(500).json({ error: 'Internal Server Error' });
    }
}

const profileaddressesLoader = async (req, res) => {
    try {
        const userId = req.session.userId;

        if (!userId) {
            console.log("corresponding user not found login");
            return res.status(403).json({ message: 'User not authenticated' });
        }





        // Fetch user document with populated addresses field
        const user = await User.findById(userId).populate('addresses');

        // Get the first address from the addresses array
        const firstAddress = user.addresses.length > 0 ? user.addresses[0] : null;




        // Render the payment-selection page with the first address and cart details
        res.render('./user/profile/profile-addresses.ejs', { firstAddress, user });



    } catch (error) {
        console.log(error.message);
        req.flash('error', "Something happened while loading the address page");
        res.redirect('/cart');
    }
};


const updateUserPrimaryAddress = async (req, res) => {
    try {
        const userId = req.session.userId;
        const addressId = req.params.addressId;

        // Validate input parameters
        if (!userId || !addressId) {
            return res.status(400).json({ success: false, message: 'Invalid request parameters.' });
        }

        // Find the user document
        const user = await User.findOne({ _id: userId });

        if (!user) {
            console.log("User not found.");
            return res.status(404).json({ success: false, message: 'User not found.' });
        }

        // Check if the given addressId exists in the user's addresses
        const selectedAddressIndex = user.addresses.findIndex(address => address._id.toString() === addressId);

        if (selectedAddressIndex === -1) {
            console.log("Invalid address selected.");
            return res.status(400).json({ success: false, message: 'Invalid address selected.' });
        }

        // If the selected address is not already at the 0th index, swap it
        if (selectedAddressIndex !== 0) {
            // Swap the addresses
            const temp = user.addresses[0];
            user.addresses[0] = user.addresses[selectedAddressIndex];
            user.addresses[selectedAddressIndex] = temp;

            // Save the updated user document
            await user.save();


            return res.status(200).json({ success: true, message: 'Primary address updated successfully.' });
        }

        // If the selected address is already at the 0th index, no need to swap
        console.log("Selected address is already the primary address.");
        return res.status(200).json({ success: true, message: 'Selected address is already the primary address.' });
    } catch (error) {
        console.error("Error updating primary address:", error.message);
        return res.status(500).json({ success: false, message: 'Error updating primary address. Please try again.' });
    }
};

const passwordChangeHandler = async (req, res) => {
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
        return res.status(500).json({ error: 'An error occurred. Please try again.' });
    }
};

const profileOrdersLoader = async (req, res) => {
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


        // Render the payment-selection page with the first address and cart details
        res.render('./user/profile/orders.ejs',  { orders });

    } catch (error) {
        console.log(error.message);
        res.redirect('/profile')
    }
}

const profileOrdersCancelHandler = async (req, res) => {
    try {
        const orderId = req.params.orderId;
        const userId = req.session.userId;

        // Check if the orderId belongs to the userId in the collection document
        const order = await Order.findOne({ _id: orderId, user: userId });

        if (!order) {
            return res.status(404).json({ message: 'Order not found for the user' });
        }

        // Check if the current status is 'Placed'
        if (order.status !== 'Placed') {
            return res.status(400).json({ message: 'Cannot cancel the order. Current status is not "Placed".' });
        }

        // Change the status of the document to 'Cancelled'
        order.status = 'Cancelled';
        const updatedOrder = await order.save();

        // Send back the new updated order details to the client
        res.json({ message: 'Order cancelled successfully', order: updatedOrder });
    } catch (error) {
        console.error('Error cancelling order:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

const profileOrdersReturnHandler = async (req, res) => {
    try {
        const orderId = req.params.orderId;
        const userId = req.session.userId;

        // Check if the orderId belongs to the userId in the collection document
        const order = await Order.findOne({ _id: orderId, user: userId });

        if (!order) {
            return res.status(404).json({ message: 'Order not found for the user' });
        }
        if(order.deliveredDate){
            order.deliveredDate = new Date(order.deliveredDate);
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
            }
        }
 
       
    } catch (error) {
        console.error('Error returning order:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

module.exports = {
    profileLoader,
    profileUserEditHandler,
    profileaddressesLoader,
    updateUserPrimaryAddress,
    passwordChangeHandler,
    profileOrdersLoader,
    profileOrdersCancelHandler,
    profileOrdersReturnHandler,
}