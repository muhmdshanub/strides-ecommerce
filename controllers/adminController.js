const bcrypt = require('bcrypt');
const mongoose = require('mongoose');
const Admin = require('../models/adminModel');
const Products = require('../models/productModel');
const Users = require('../models/userModel');


const adminRootHandler = async (req, res) => {
    try {
        if (req.session.adminId) {
            res.render('./admin/dashboard')
        } else {
            res.render('./admin/login');

        }

    } catch (error) {
        console.log(error.message);
    }
}
//logging out admin
const logoutHandler = async (req, res) => {
    try {

        const adminId = req.session.adminId;

        // Find the user by _id (userId) and update the isLogin property to false
        const adminUpdate = await Admin.findByIdAndUpdate(adminId, { isLogin: false });

        if(adminUpdate){
            req.session.adminId = null;
            res.redirect('/admin');
        }
       
    } catch (error) {
        console.log(error.message);
    }
}


const productListLoader = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const pageSize = 10; // Set the number of products to display per page

        const options = {
            page: page,
            limit: pageSize,
        };

        const productsData = await Products.paginate({ isDeleted: false }, options);

        res.render('./admin/productList.ejs', {
            products: productsData.docs,
            currentPage: productsData.page,
            totalPages: productsData.totalPages,
        });
    } catch (error) {
        console.log(error.message);
    }
};




const productAddLoader = async (req, res) => {
    try {


        res.render('./admin/product-add.ejs');
    } catch (error) {
        console.log(error.message);
    }
}

const loginLoader = async (req, res) => {
    try {
        res.render('./admin/login.ejs');
    } catch (error) {
        console.log(error.message);
    }
}

const loginHandler = async (req, res) => {
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
                    req.flash('error', "Something Happened while trying to log you in. Please try again");
                    res.redirect('/admin/login');
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
        req.flash('error', "Something Happened while trying to log you in. Please try again");
        res.redirect('/admin/login');
    }
}

const dashboardLoader = async (req, res) => {
    try {
        res.render('./admin/dashboard.ejs');
    } catch (error) {
        console.log(error.message);
    }
}



const productAddHandler = async (req, res) => {
    try {
        const {
            brandName,
            productName,
            gender,
            colors,
            category,
            description,
            price,
            discount,
            available_stock_small,
            available_stock_medium,
            available_stock_large,
            available_stock_extra_large,
        } = req.body;

        // Check if required fields are present
        if (
            !brandName ||
            !productName ||
            !gender ||
            !colors ||
            !category ||
            !description ||
            !price ||
            !discount ||
            !available_stock_small ||
            !available_stock_medium ||
            !available_stock_large ||
            !available_stock_extra_large ||
            !req.files ||
            req.files.length !== 4
        ) {
            req.flash('error', 'All fields are required, including 4 images.');
            return res.redirect('/admin/products-add');
        }

        const colorsArray = req.body.colors || [];
        const filenames = req.files.map((file) => file.filename);

        const product = new Products({
            brandName,
            productName,
            gender,
            colors: colorsArray,
            category,
            description,
            initialPrice: parseFloat(price),
            discountPercentage: parseFloat(discount),
            sizes: {
                small: {
                    availableStock: parseInt(available_stock_small),
                },
                medium: {
                    availableStock: parseInt(available_stock_medium),
                },
                large: {
                    availableStock: parseInt(available_stock_large),
                },
                extraLarge: {
                    availableStock: parseInt(available_stock_extra_large),
                },
            },
            images: {
                image1: { name: filenames[0] },
                image2: { name: filenames[1] },
                image3: { name: filenames[2] },
                image4: { name: filenames[3] },
            },
        });

        // Save the new product to the database
        const productData = await product.save();

        if (productData) {
            req.flash('success', 'You have successfully added a new product.');
            return res.redirect('/admin/products-add');
        }
    } catch (error) {
        console.log(error.message)
        req.flash('error', 'An error occurred. Please try again.');
        res.redirect('/admin/products-add');
    }
};





const singleProductDeletionHandler = async (req, res) => {
    try {
        const productId = req.params.productId;

        // Check if the provided productId is a valid ObjectId
        if (!mongoose.Types.ObjectId.isValid(productId)) {
            req.flash('error', 'Invalid product ID.');
            return res.redirect('/admin/products-list');
        }

        // Update the product's status to "soft deleted" in the database
        const result = await Products.findByIdAndUpdate(productId, { $set: { isDeleted: true } });

        if (result) {
            req.flash('success', 'Product removed.');
            return res.redirect('/admin/products-list');
        } else {
            req.flash('error', 'An error occurred while trying to remove the product');
            return res.redirect('/admin/products-list');
        }
    } catch (error) {
        console.error(error.message);
        req.flash('error', 'An error occurred while trying to remove the product');
        res.redirect('/admin/products-list');
    }
};

const multipleProductDeletionHandler = async (req, res) => {
    try {
        const productIds = req.body.productIds;

        // Update the status of selected products to "soft deleted" in the database
        const result = await Products.updateMany({ _id: { $in: productIds } }, { $set: { isDeleted: true } });

        if (result.modifiedCount > 0) {
            req.flash('success', 'Selected products removed successfully');
            res.redirect('/admin/products-list'); // Redirect to the product list page
        } else {
            req.flash('error', 'No products found for bulk delete');
            res.redirect('/admin/products-list');
        }
    } catch (error) {
        console.error('Error bulk deleting products:', error);
        req.flash('error', 'Internal Server Error');
        res.redirect('/admin/products-list');
    }
};


const productEditLoader = async (req, res) => {
    try {

        const productId = req.params.productId;

        if (!mongoose.Types.ObjectId.isValid(productId)) {
            req.flash('error', 'Invalid product ID');
            res.redirect('/admin/products-list');
            return;
        }
        const productData = await Products.findById(productId);
        if (productData) {
            res.render('./admin/product-edit.ejs', { product: productData });
        } else {
            req.flash('error', 'Invalid user details');
            res.redirect('/admin/products-list');
        }
    } catch (error) {
        console.log(error.message);
        req.flash('error', 'An error occured');
        res.redirect('/admin/products-list');
    }
}

const productEditHandler = async (req, res) => {
    try {
        const productId = req.params.productId;
        const product = await Products.findById(productId, { images: 1 });
        const {
            brandName,
            productName,
            gender,
            colors,
            category,
            description,
            price,
            discount,
            available_stock_small,
            available_stock_medium,
            available_stock_large,
            available_stock_extra_large,
            sold_stock_small,
            sold_stock_medium,
            sold_stock_large,
            sold_stock_extra_large,
        } = req.body;

        // Check if required fields are present
        if (
            !brandName ||
            !productName ||
            !gender ||
            !colors ||
            !category ||
            !description ||
            !price ||
            !discount ||
            !available_stock_small ||
            !available_stock_medium ||
            !available_stock_large ||
            !available_stock_extra_large ||
            !sold_stock_small ||
            !sold_stock_medium ||
            !sold_stock_large ||
            !sold_stock_extra_large
        ) {
            req.flash('error', 'All fields are required.');
            return res.redirect('/admin/products-edit/' + productId);
        }






        const colorsArray = req.body.colors || [];
        const filenames = req.files.map(file => file.filename);




        //code to insert images to collection
        const images = {};

        for (let i = 1; i <= 4; i++) {
            // Check if there are filenames left
            if (filenames.length > 0) {
                // Check if the current image is modified
                const isModified = req.body[`imageModified${i}`] === 'true';

                if (isModified) {
                    // Use the first filename for the modified image
                    images[`image${i}`] = { name: filenames.shift() };
                } else {
                    // If not modified, use the original image name
                    images[`image${i}`] = { name: product.images[`image${i}`].name };
                }
            } else {
                // If no filenames left, use the original image name
                images[`image${i}`] = { name: product.images[`image${i}`].name };
            }
        }



        const productUpdate = {
            brandName,
            productName,
            gender,
            colors: colorsArray,
            category,
            description,
            initialPrice: parseFloat(price),
            discountPercentage: parseFloat(discount),
            finalPrice: parseFloat(price) * (1 - parseFloat(discount) / 100),
            sizes: {
                small: {
                    availableStock: parseInt(available_stock_small),
                    soldStock: parseInt(sold_stock_small),
                },
                medium: {
                    availableStock: parseInt(available_stock_medium),
                    soldStock: parseInt(sold_stock_medium),
                },
                large: {
                    availableStock: parseInt(available_stock_large),
                    soldStock: parseInt(sold_stock_large),
                },
                extraLarge: {
                    availableStock: parseInt(available_stock_extra_large),
                    soldStock: parseInt(sold_stock_extra_large),
                },
            },
            images: images,
        };

        // Update the product in the database
        const updatedProduct = await Products.findByIdAndUpdate(
            productId,
            productUpdate,
            { new: true }
        );

        if (updatedProduct) {
            req.flash('success', 'Product updated successfully.');
            return res.redirect('/admin/products-list/');
        }
    } catch (error) {
        console.error(error);
        req.flash('error', 'An error occurred. Please try again.');
        res.redirect('/admin/products-list/');
    }
};

const userListLoader = async (req, res) => {
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
    }
};

const singleUserBlockHandler = async (req, res) => {
    try {
        const userId = req.params.userId;

        // Check if the provided productId is a valid ObjectId
        if (!mongoose.Types.ObjectId.isValid(userId)) {
            req.flash('error', 'Invalid user ID.');
            return res.redirect('/admin/user-list');
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
        req.flash('error', 'An error occurred while trying to block the user');
        return res.redirect('/admin/users-list');
    }
};

const singleUserUnblockHandler = async (req, res) => {
    try {
        const userId = req.params.userId;

        // Check if the provided productId is a valid ObjectId
        if (!mongoose.Types.ObjectId.isValid(userId)) {
            req.flash('error', 'Invalid user ID.');
            return res.redirect('/admin/user-list');
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
        req.flash('error', 'An error occurred while trying to unblock the user');
        return res.redirect('/admin/users-list');
    }
};

const multipleUsersBlockHandler = async (req, res) => {
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
        req.flash('error', 'Internal Server Error');
        res.redirect('/admin/users-list');
    }
};

const multipleUsersUnblockHandler = async (req, res) => {
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
        req.flash('error', 'Internal Server Error');
        res.redirect('/admin/users-list');
    }
};

const CategoryListLoader = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const pageSize = 10; // Set the number of categories to display per page

        const aggregationPipeline = [
            {
                $group: {
                    _id: '$category',
                    productsCount: { $sum: 1 },
                },
            },
            {
                $project: {
                    _id: 0,
                    name: '$_id',
                    productsCount: 1,
                    ordersCount: 'To be calculated after order model is created',
                    ordersCountIn30Days: 'To be calculated after order model is created',
                },
            },
        ];

        const categoriesData = await Products.aggregate(aggregationPipeline);


        // Manually handle pagination
        const startIdx = (page - 1) * pageSize;
        const endIdx = startIdx + pageSize;
        const paginatedCategories = categoriesData.slice(startIdx, endIdx);

        res.render('./admin/categoryList.ejs', {
            categories: paginatedCategories,
            currentPage: page,
            totalPages: Math.ceil(categoriesData.length / pageSize),
        });



    } catch (error) {
        console.error(error.message);
        req.flash('error', 'Internal Server Error');
        res.redirect('/admin/dashboard');
    }
};



module.exports = {
    productListLoader,
    productAddLoader,
    loginLoader,
    loginHandler,
    dashboardLoader,
    productAddHandler,
    singleProductDeletionHandler,
    multipleProductDeletionHandler,
    productEditLoader,
    productEditHandler,
    userListLoader,
    singleUserBlockHandler,
    singleUserUnblockHandler,
    multipleUsersBlockHandler,
    multipleUsersUnblockHandler,
    CategoryListLoader,
    adminRootHandler,
    logoutHandler,
}
