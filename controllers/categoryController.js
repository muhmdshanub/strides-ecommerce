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




const CategoryListLoaderAdmin = async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const pageSize = 10; // Set the number of categories to display per page

        const aggregationPipeline = [
            {
                $lookup: {
                    from: 'products', // Use the actual collection name for products
                    localField: '_id',
                    foreignField: 'category',
                    as: 'products',
                },
            },
            {
                $project: {
                    _id: 1,
                    name: 1,
                    description: 1,
                    addedDate: 1,
                    productsCount: { $size: '$products' }, // Count the number of products
                    ordersCount: 'To be calculated after order model is created',
                    ordersCountIn30Days: 'To be calculated after order model is created',
                },
            },
        ];

        const categoriesData = await Category.aggregate(aggregationPipeline);

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
        next(error)
    }
};

const categoryAddLoaderAdmin = async (req, res, next) => {
    try {


        res.render('./admin/category-add.ejs');
    } catch (error) {
        console.log(error.message);
        next(error)
    }
}


const categoryAddHandlerAdmin = async (req, res, next) => {
    try {
        const { name, description, } = req.body;




        // Check if required fields are present
        if (!name || !description) {

            req.flash('error', 'All fields are required.');
            return res.redirect('/admin/category-add');
        }

        const isCategoryExist = await Category.findOne({ name: name });

        if (isCategoryExist) {
            req.flash('error', 'Category already exists.');
            return res.redirect('/admin/category-add');
        }



        const category = new Category({
            name,
            description,
        });

        // Save the new product to the database
        const categoryData = await category.save();

        if (categoryData) {
            req.flash('success', 'You have successfully added a new category.');
            return res.redirect('/admin/category-list');
        }
    } catch (error) {
        console.log(error.message)
        next(error)
    }
};

const categoryEditLoaderAdmin = async (req, res, next) => {
    try {

        const categoryId = req.params.categoryId;

        if (!mongoose.Types.ObjectId.isValid(categoryId)) {
            const genericErrorMessage = 'Invalid category ID: ';
            const genericError = new Error(genericErrorMessage);
            genericError.status = 500;
            throw genericError;
        }
        const categoryData = await Category.findById(categoryId);
        if (categoryData) {
            res.render('./admin/category-edit.ejs', { category: categoryData });
        } else {
            req.flash('error', 'Invalid category details');
            res.redirect('/admin/category-list');
        }
    } catch (error) {
        console.log(error.message);
        next(error)
    }
}

const categoryEditHandlerAdmin = async (req, res, next) => {
    try {
        const categoryId = req.params.categoryId;

        if (!mongoose.Types.ObjectId.isValid(categoryId)) {
            const genericErrorMessage = 'Invalid category ID: ';
            const genericError = new Error(genericErrorMessage);
            genericError.status = 500;
            throw genericError;
        }

        const product = await Category.findById(categoryId);
        const { name, description } = req.body;

        // Check if required fields are present
        if (!name || !description) {
            req.flash('error', 'All fields are required.');
            return res.redirect('/admin/category-edit/' + categoryId);
        }

        const categoryUpdate = {
            name, description
        };

        // Update the product in the database
        const updatedCategory = await Category.findByIdAndUpdate(
            categoryId,
            categoryUpdate,
            { new: true }
        );

        if (updatedCategory) {
            req.flash('success', 'Category updated successfully.');
            return res.redirect('/admin/category-list/');
        }
    } catch (error) {
        console.error(error);
        next(error)
    }
};



module.exports = {
    CategoryListLoaderAdmin,
    categoryAddLoaderAdmin,
    categoryAddHandlerAdmin,
    categoryEditLoaderAdmin,
    categoryEditHandlerAdmin,
}