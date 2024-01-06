const bcrypt = require('bcrypt');
const mongoose = require('mongoose');
const Admin = require('../models/adminModel');
const Products = require('../models/productModel');
const Users = require('../models/userModel');
const Category = require('../models/categoryModel');
const Order = require('../models/orderModel');
const { NetworkContextImpl } = require('twilio/lib/rest/supersim/v1/network');


const adminRootHandler = async (req, res, next) => {
    try {
        if (req.session.adminId) {
            res.render('./admin/dashboard')
        } else {
            res.render('./admin/login');

        }

    } catch (error) {
        console.log(error.message);
        next(error)
    }
}
//logging out admin
const logoutHandler = async (req, res, next) => {
    try {

        const adminId = req.session.adminId;

        // Find the user by _id (userId) and update the isLogin property to false
        const adminUpdate = await Admin.findByIdAndUpdate(adminId, { isLogin: false });

        if (adminUpdate) {
            req.session.adminId = null;
            res.redirect('/admin');
        }

    } catch (error) {
        console.log(error.message);
        next(error)
    }
}




const loginLoader = async (req, res, next) => {
    try {
        res.render('./admin/login.ejs');
    } catch (error) {
        console.log(error.message);
        next(error)
    }
}

const loginHandler = async (req, res, next) => {
    try {
        const emailOrPhone = req.body.emailOrPhone;
        const password = req.body.password;

        const adminData = await Admin.findOne({
            $or: [
                { email: emailOrPhone },
                { phone: emailOrPhone }
            ]
        });

        if (adminData) {
            const passwordMatch = await bcrypt.compare(password, adminData.password);

            if (passwordMatch) {
                adminData.isLogin = true || adminData.isLogin;
                adminData.lastLogin = Date.now() || adminData.lastLogin;

                const adminUpdate = await adminData.save();

                if (adminUpdate) {
                    req.session.adminId = adminData._id;
                    res.redirect('/admin/dashboard');
                } else {
                    
                    const genericErrorMessage = 'Something Happened while trying to log you in. Please try again : ';
                    const genericError = new Error(genericErrorMessage);
                    genericError.status = 404;
                    throw genericError;
                }

            } else {
                req.flash('error', "Invalid credetials.");
                res.redirect('/admin/login');
            }
        } else {
            req.flash('error', "Invalid credetials.");
            res.redirect('/admin/login');
        }
    } catch (error) {
        console.log(error.message);
        next(error)
    }
}

const dashboardLoader = async (req, res, next) => {
    try {
        res.render('./admin/dashboard.ejs');
    } catch (error) {
        console.log(error.message);
        next(error)
    }
}





const userListLoader = async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const pageSize = 5; // Set the number of users to display per page

        const options = {
            page: page,
            limit: pageSize,
        };

        const usersData = await Users.paginate({}, options);

        // Define a function to calculate activity status
        const calculateActivityStatus = (user) => {
            if (user.isLogin && (new Date() - user.lastLogin) / (1000 * 60) <= 60) {
                return 'Online';
            } else {
                return 'Offline';
            }
        };

        // Define a function to calculate authentication status
        const calculateAuthenticationStatus = (user) => {
            return user.isBlocked ? 'Blocked' : 'Active';
        };

        const usersDataWithStatus = usersData.docs.map((user) => ({
            ...user.toObject(), // Convert Mongoose document to plain JavaScript object
            activityStatus: calculateActivityStatus(user),
            authenticationStatus: calculateAuthenticationStatus(user),
        }));

        res.render('./admin/userList.ejs', {
            users: usersDataWithStatus,
            currentPage: usersData.page,
            totalPages: usersData.totalPages,
        });
    } catch (error) {
        console.log(error.message);
        next(error)
    }
};

const singleUserBlockHandler = async (req, res, next) => {
    try {
        const userId = req.params.userId;

        if (!mongoose.Types.ObjectId.isValid(userId)) {
            const genericErrorMessage = 'Invalid user ID: ';
            const genericError = new Error(genericErrorMessage);
            genericError.status = 500;
            throw genericError;
        }

        // Update the product's status to "soft deleted" in the database
        const result = await Users.findByIdAndUpdate(userId, { $set: { isBlocked: true } });

        if (result) {

            req.session.userId = null; // Invalidate the session

            req.flash('success', 'User blocked.');
            return res.redirect('/admin/users-list');
        } else {
            req.flash('error', 'An error occurred while trying to block the user');
            return res.redirect('/admin/users-list');
        }
    } catch (error) {
        console.error(error.message);
        next(error)
    }
};

const singleUserUnblockHandler = async (req, res, next) => {
    try {
        const userId = req.params.userId;

        // Check if the provided productId is a valid ObjectId
        if (!mongoose.Types.ObjectId.isValid(userId)) {
            const genericErrorMessage = 'Invalid user ID: ';
            const genericError = new Error(genericErrorMessage);
            genericError.status = 500;
            throw genericError;
        }

        // Update the product's status to "unblock" in the database
        const result = await Users.findByIdAndUpdate(userId, { $set: { isBlocked: false } });

        if (result) {
            req.flash('success', 'User unblocked.');
            return res.redirect('/admin/users-list');
        } else {
            req.flash('error', 'An error occurred while trying to unblock the user');
            return res.redirect('/admin/users-list');
        }
    } catch (error) {
        console.error(error.message);
        next(error);
    }
};

const multipleUsersBlockHandler = async (req, res, next) => {
    try {
        const userIds = req.body.userIds;

        // Update the status of selected products to "soft deleted" in the database
        const result = await Users.updateMany({ _id: { $in: userIds } }, { $set: { isBlocked: true } });

        if (result.modifiedCount > 0) {
            req.flash('success', 'Selected users blocked successfully');
            res.redirect('/admin/users-list'); // Redirect to the product list page
        } else {
            req.flash('error', 'No users found for bulk block');
            res.redirect('/admin/users-list');
        }
    } catch (error) {
        console.error('Error bulk blocking users:', error);
        next(error)
    }
};

const multipleUsersUnblockHandler = async (req, res, next) => {
    try {
        const userIds = req.body.userIds;

        // Update the status of selected products to "soft deleted" in the database
        const result = await Users.updateMany({ _id: { $in: userIds } }, { $set: { isBlocked: false } });

        if (result.modifiedCount > 0) {
            req.flash('success', 'Selected users unblocked successfully');
            res.redirect('/admin/users-list'); // Redirect to the product list page
        } else {
            req.flash('error', 'No users found for bulk unblock');
            res.redirect('/admin/users-list');
        }
    } catch (error) {
        console.error('Error bulk unblocking users:', error);
        next(error)
    }
};







module.exports = {
    
    loginLoader,
    loginHandler,
    dashboardLoader,
    
    userListLoader,
    singleUserBlockHandler,
    singleUserUnblockHandler,
    multipleUsersBlockHandler,
    multipleUsersUnblockHandler,
    
    adminRootHandler,
    logoutHandler,
    
    
}