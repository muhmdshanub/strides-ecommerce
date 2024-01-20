const bcrypt = require('bcrypt');
const mongoose = require('mongoose');
const Admin = require('../models/adminModel');
const Products = require('../models/productModel');
const Users = require('../models/userModel');
const Category = require('../models/categoryModel');
const Order = require('../models/orderModel');
const Payment = require('../models/paymentModel');
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
        // Assuming you have Mongoose models named User, Product, Order, and Payment
        const totalUsers = await Users.countDocuments();
        const totalProducts = await Products.countDocuments();
        const totalSales = await Order.countDocuments({ status: { $in: ["Placed", "Delivered"] } });
        const totalRevenue = await Payment.aggregate([{ $group: { _id: null, total: { $sum: "$totalAmount" } } }]);

        // Extract totalRevenue from the result
        const totalRevenueAmount = totalRevenue.length > 0 ? totalRevenue[0].total : 0;

        // Count of users with users.orders.length > 1
        const usersWithOrdersCount = await Users.countDocuments({ 'orders.1': { $exists: true } });

        if (!usersWithOrdersCount) {
            console.log("ordercount not working")
        }

        res.render('./admin/dashboard.ejs', {
            userData: { totalUsers, purchasingUsers: usersWithOrdersCount },
            totalProducts,
            totalSales,
            totalRevenue: totalRevenueAmount
        });
    } catch (error) {
        console.log(error.message);
        next(error);
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

const userCreationStatisticsgraphLoader = async (req, res) => {
    const { option } = req.query;

    try {
        // Set the start and end dates based on the selected option
        const { startDate, endDate } = getDatesForOption(option);

        // Fetch user creation data from the database based on the date range
        const userCreationData = await Users.aggregate([
            {
                $match: {
                    createdAt: {
                        $gte: startDate,
                        $lt: endDate,
                    },
                },
            },
            {
                $group: {
                    _id: {
                        $dateToString: { format: getDateGroupFormat(option), date: '$createdAt' },
                    },
                    count: { $sum: 1 },
                },
            },
            { $sort: { _id: 1 } },
        ]);

        // Create a set of labels based on the selected time frame
        const allLabels = generateLabels(option);



        // Populate counts for each label
        const dataMap = new Map(userCreationData.map(entry => [entry._id, entry.count]));



        // Extract the labels (x-axis) and data (y-axis)
        const labels = allLabels.map(label => label.toString());
        const data = labels.map(label => dataMap.get(label) || 0);

        // Send the data to the client
        res.json({ labels, data });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
}

// Function to generate a complete set of labels based on the selected time frame
function generateLabels(option) {
    const { startDate, endDate } = getDatesForOption(option);
    const labels = [];
    let currentDate = new Date(startDate);

    while (currentDate <= endDate) {
        let formattedDate;

        switch (option) {
            case 'thisYear':
                formattedDate = currentDate.toISOString().slice(0, 7); // Extract yyyy-mm
                currentDate.setMonth(currentDate.getMonth() + 1); // Increment by month
                break;
            case 'thisMonth':
            case 'thisWeek':
                formattedDate = currentDate.toISOString().split('T')[0]; // Extract yyyy-mm-dd
                currentDate.setDate(currentDate.getDate() + 1); // Increment by day
                break;
            case 'today':
                formattedDate = currentDate.toISOString().split('T')[0]; // Extract yyyy-mm-dd
                currentDate.setHours(currentDate.getHours() + 1); // Increment by hour
                break;
            default:
                formattedDate = currentDate.toISOString().split('T')[0];
                currentDate.setDate(currentDate.getDate() + 1); // Default to day increment
        }

        labels.push(formattedDate);
    }

    return labels;
}

// Helper function to get start and end dates based on the selected option
function getDatesForOption(option) {
    const now = new Date();
    let startDate, endDate;

    switch (option) {
        case 'thisYear':
            startDate = new Date(now.getFullYear(), 0, 1);
            endDate = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999); // End of December
            break;
        case 'thisMonth':
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
            endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999); // End of the month
            break;
        case 'thisWeek':
            startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay() + 1);
            endDate = new Date(startDate);
            endDate.setDate(endDate.getDate() + 6);
            endDate.setHours(23, 59, 59, 999);
            break;
        case 'today':
            startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
            break;
        default:
            startDate = new Date(0);
            endDate = now;
    }

    return { startDate, endDate };
}

// Helper function to get the date format for grouping in aggregation
function getDateGroupFormat(option) {
    switch (option) {
        case 'thisYear':
            return '%Y-%m'; // Monthly grouping for the whole year
        case 'thisMonth':
            return '%Y-%m-%d'; // Daily grouping for the whole month
        case 'thisWeek':
            return '%Y-%m-%d'; // Daily grouping for the whole week
        case 'today':
            return '%Y-%m-%dT%H'; // Hourly grouping for the whole day
        default:
            return '%Y-%m-%d';
    }
}

const userMonthlySpendStatisticsGraphLoader = async (req, res) => {
    try {
        const { selectedYear } = req.query;

        

        const startOfMonth = new Date(parseInt(selectedYear), 0, 1);
        const endOfMonth = new Date(parseInt(selectedYear), 11, 31, 23, 59, 59, 999);

             
        const aggregationPipeline = [
            {
                $match: {
                    createdAt: {
                        $gte: startOfMonth,
                        $lte: endOfMonth,
                    },
                },
            },
            {
                $group: {
                    _id: {
                        month: { $month: '$createdAt' },
                        user: '$user',
                    },
                    totalAmount: { $sum: '$totalAmount' },
                },
            },
            {
                $group: {
                    _id: '$_id.month',
                    users: {
                        $push: {
                            user: '$_id.user',
                            totalAmount: '$totalAmount',
                        },
                    },
                },
            },
            {
                $project: {
                    _id: 1,
                    total1to5000: {
                        $size: {
                            $filter: {
                                input: '$users',
                                as: 'user',
                                cond: { $lte: ['$$user.totalAmount', 5000] },
                            },
                        },
                    },
                    total5000to10000: {
                        $size: {
                            $filter: {
                                input: '$users',
                                as: 'user',
                                cond: {
                                    $and: [
                                        { $gt: ['$$user.totalAmount', 5000] },
                                        { $lte: ['$$user.totalAmount', 10000] },
                                    ],
                                },
                            },
                        },
                    },
                    totalAbove10000: {
                        $size: {
                            $filter: {
                                input: '$users',
                                as: 'user',
                                cond: { $gt: ['$$user.totalAmount', 10000] },
                            },
                        },
                    },
                },
            },
            {
                $sort: {
                    _id: 1,
                },
            },
        ];

        const paymentStatistics = await Payment.aggregate(aggregationPipeline);
        


        // Create an array with all 12 months
        const allMonths = Array.from({ length: 12 }, (_, index) => index + 1);

        // Iterate through allMonths and fill in the counts
        const resultWithZeros = allMonths.map(month => {
            const existingRecord = paymentStatistics.find(record => record._id === month);

            if (existingRecord) {
                return existingRecord;
            } else {
                return {
                    _id: month,
                    total1to5000: 0,
                    total5000to10000: 0,
                    totalAbove10000: 0,
                };
            }
        });

        
        


        res.json(resultWithZeros);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
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

    userCreationStatisticsgraphLoader,
    userMonthlySpendStatisticsGraphLoader,


}