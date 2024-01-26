const otpGenerator = require('otp-generator');
const mongoose = require('mongoose');
const { ObjectId } = require('mongoose').Types;
const User = require('../models/userModel');
const OTP = require('../models/otpModel');
const Address = require('../models/addressModel');
const Category = require('../models/categoryModel');
const Products = require('../models/productModel');
const Cart = require('../models/cartModel');
const Wishlist = require('../models/wishlistModel');
const Order = require('../models/orderModel');
const sendOtpEmail = require('../utils/sendEmail'); // Your function to send OTP via email
const discountAndPricingUtils = require('../utils/discountAndPricingCalculator');


const bcrypt = require('bcrypt');


async function getAllCategories() {
    try {
        const categories = await Category.find();
        return categories;
    } catch (error) {
        throw error;
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

    }
};

const productListLoader = async (req, res, next) => {
    try {
        const userId = req.session.userId;
        const page = parseInt(req.query.page) || 1;
        const pageSize = 10; // Set the number of products to display per page

        // Extracting the search query from the request
        const searchQuery = req.query.search || '';


        // Extracting filter parameters from the query
        //const genderFilter = req.query.gender || [];

        const temp_genderFilter = req.query.gender ? (Array.isArray(req.query.gender) ? req.query.gender : [req.query.gender]) : [];
        const genderFilter = temp_genderFilter.length === 1 ? temp_genderFilter[0].split(',') : temp_genderFilter;


        //const categoryFilter = req.query.category || [];
        const temp_categoryFilter = req.query.category ? (Array.isArray(req.query.category) ? req.query.category : [req.query.category]) : [];
        const categoryFilter = temp_categoryFilter.length === 1 ? temp_categoryFilter[0].split(',') : temp_categoryFilter;
        // Convert all category ids to ObjectId format
        const objectIdCategoryFilter = categoryFilter.map((categoryId) => new ObjectId(categoryId));


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
        if (objectIdCategoryFilter.length > 0) {
            filterObject.category= { $in: objectIdCategoryFilter };
        }

        

        //for the second filter based on percentage and finalPrice

        let secondFilterObject = {};

        // Add discount filter if not null
        if (!isNaN(discountFilter) && discountFilter !== null) {
            secondFilterObject.maxDiscountPercentage = { $gte: discountFilter };
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
            secondFilterObject.finalPrice = {}; // Initialize finalPrice as an empty object

            if (!isNaN(minPriceFilter)) {
                secondFilterObject.finalPrice.$gte = minPriceFilter;
            }
            if (!isNaN(maxPriceFilter)) {
                secondFilterObject.finalPrice.$lte = maxPriceFilter;
            }
        }

        // Extracting sorting parameter from the query
        const sortOption = req.query.sort || 'Latest Products'; // Default to sorting by creation date if not provided

        // Constructing the sort object based on the query parameter
        const sortObject = {};
        if (sortOption === 'Latest Products') {
            sortObject.createdAt = -1; // Sort by creation date in descending order (latest first)
        } else if (sortOption === 'Popularity') {
            sortObject.popularity = -1;
        } else if (sortOption === 'Price, low to high') {
            sortObject.finalPrice = 1; // Sort by final price in ascending order
        } else if (sortOption === 'Price, high to low') {
            sortObject.finalPrice = -1; // Sort by final price in descending order
        }

        //search logic
        if (typeof searchQuery === 'string' && searchQuery.trim().length > 0) {
            const searchWords = searchQuery.trim().split(/\s+/); // Split the search query into words

            // Construct an array of regex conditions for each word
            const regexConditions = searchWords.map(word => ({
                $or: [
                    { brandName: { $regex: new RegExp(word, 'i') } }, // Case-insensitive brandName match
                    { productName: { $regex: new RegExp(word, 'i') } }, // Case-insensitive productName match
                    { colors: { $elemMatch: { $in: [new RegExp(word, 'i')] } } }, // Case-insensitive color match
                    { description: { $regex: new RegExp(word, 'i') } }, // Case-insensitive description match
                    { gender: { $regex: new RegExp(word, 'i') } }, // Case-insensitive gender match
                ],
            }));

            // Combine the regex conditions with $and
            filterObject.$and = regexConditions;
        }

        //aggregation pipline logic

        const currentDate = new Date();

        const pipeline = [
            // Match stage to filter products based on isDeleted
            {
                $match: filterObject,
            },
            // Lookup stage to populate the category field
            {
                $lookup: {
                    from: 'categories',
                    localField: 'category',
                    foreignField: '_id',
                    as: 'category',
                },
            },
            // Unwind stage to destructure the array created by $lookup
            {
                $unwind: '$category',
            },
            // Lookup stage to join with the offers collection
            {
                $lookup: {
                    from: 'offers',
                    let: { categoryId: '$category._id', productId: '$_id' },
                    pipeline: [
                        {
                            $match: {
                                $expr: {
                                    $and: [
                                        { $or: [{ $eq: ['$product', '$$productId'] }, { $eq: ['$category', '$$categoryId'] }] },
                                        { $lte: ['$validFrom', currentDate] },
                                        { $gte: ['$validUpto', currentDate] },
                                        { $eq: ['$isActive', true] },
                                    ],
                                },
                            },
                        },
                        {
                            $group: {
                                _id: null,
                                maxDiscount: { $max: '$percentageDiscount' },
                            },
                        },
                    ],
                    as: 'offersData',
                },
            },
            // Add fields stage to calculate max discount
            {
                $addFields: {
                    maxDiscountPercentage: {
                        $ifNull: [{ $max: '$offersData.maxDiscount' }, 0],
                    },
                },
            },
            // // Add fields stage to calculate final price
            {
                $addFields: {
                    finalPrice: {
                        $cond: {
                            if: { $gt: ['$maxDiscountPercentage', 0] },
                            then: {
                                $multiply: [
                                    '$initialPrice',
                                    { $subtract: [1, { $divide: ['$maxDiscountPercentage', 100] }] },
                                ],
                            },
                            else: '$initialPrice',
                        },
                    },
                },
            },
            // Project stage to remove unnecessary fields
            {
                $project: {
                    offersData: 0,
                    // Add other fields that you want to keep
                },
            },
            // Match stage to filter based on maxDiscountPercentage and finalPrice
            {
                $match: secondFilterObject,
            },
            // Count stage to get the total number of documents
            {
                $count: 'totalDocuments',
            },
            // Sorting and Pagination stages
            { $sort: sortObject },
            { $skip: (page - 1) * pageSize },
            { $limit: pageSize },
        ];

        //to get the products and total page count
        // Separate pipelines for paginated result and count
        const paginatedPipeline = [...pipeline.slice(0, -4), ...pipeline.slice(-3)]; // Remove the 4th stage from the end
        const countPipeline = [...pipeline.slice(0, -3)]; // Remove the last 3 stages for count

        // Execute both promises concurrently
        const [result, countResult] = await Promise.all([
            Products.aggregate(paginatedPipeline),
            Products.aggregate(countPipeline),
        ]);

        
        
        

        const totalDocuments = countResult.length > 0 ? countResult[0].totalDocuments : 0;

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
        const categories = await getAllCategories();

        res.render('./user/productList.ejs', {
            products: result,
            currentPage: page,
            totalPages: Math.ceil(totalDocuments / pageSize),
            filterOptions: filterOptions,
            selectedFilters: selectedFilters,
            userWishlist: userWishlist,
            sortOption: sortOption,
            searchQuery: searchQuery,
            categories,
        });
    } catch (error) {
        console.log(error.message);
        next(error)
    }
}

const productSingleLoader = async (req, res, next) => {
    try {
        const productId = req.params.productId;

        if (!mongoose.Types.ObjectId.isValid(productId)) {
            const genericErrorMessage = 'Invalid product ID: ';
            const genericError = new Error(genericErrorMessage);
            genericError.status = 500;
            throw genericError;
        }

        const currentDate = new Date();

        const pipeline = [
            // Match stage to filter products based on productId
            {
                $match: {
                    _id: new ObjectId(productId),
                },
            },
            // Lookup stage to populate the category field
            {
                $lookup: {
                    from: 'categories',
                    localField: 'category',
                    foreignField: '_id',
                    as: 'category',
                },
            },
            // Unwind stage to destructure the array created by $lookup
            {
                $unwind: '$category',
            },
            // Lookup stage to join with the offers collection
            {
                $lookup: {
                    from: 'offers',
                    let: { categoryId: '$category._id', productId: '$_id' },
                    pipeline: [
                        {
                            $match: {
                                $expr: {
                                    $and: [
                                        { $or: [{ $eq: ['$product', '$$productId'] }, { $eq: ['$category', '$$categoryId'] }] },
                                        { $lte: ['$validFrom', currentDate] },
                                        { $gte: ['$validUpto', currentDate] },
                                        { $eq: ['$isActive', true] },
                                    ],
                                },
                            },
                        },
                        {
                            $group: {
                                _id: null,
                                maxDiscount: { $max: '$percentageDiscount' },
                            },
                        },
                    ],
                    as: 'offersData',
                },
            },
            // Add fields stage to calculate max discount and final price
            // Add fields stage to calculate max discount
            {
                $addFields: {
                    maxDiscountPercentage: {
                        $ifNull: [{ $max: '$offersData.maxDiscount' }, 0],
                    },
                },
            },

            // Add fields stage to calculate final price
            {
                $addFields: {
                    finalPrice: {
                        $cond: {
                            if: { $gt: ['$maxDiscountPercentage', 0] },
                            then: {
                                $multiply: [
                                    '$initialPrice',
                                    { $subtract: [1, { $divide: ['$maxDiscountPercentage', 100] }] },
                                ],
                            },
                            else: '$initialPrice',
                        },
                    },
                },
            },
            // Project stage to remove unnecessary fields
            {
                $project: {
                    offersData: 0,
                    // Add other fields that you want to keep
                },
            },
        ];

        const productData = await Products.aggregate(pipeline);



        const categories = await getAllCategories();
        if (productData) {

            await Products.updateOne({ _id: productId }, { $inc: { popularity: 0.01 } });



            res.render('./user/product-single.ejs', { product: productData[0], categories });
        } else {
            const genericErrorMessage = 'Invalid user details:';
            const genericError = new Error(genericErrorMessage);
            genericError.status = 500;
            throw genericError;
        }
    } catch (error) {
        console.log(error.message);
        next(error);
    }
};

const productListLoaderAdmin = async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const pageSize = 10; // Set the number of products to display per page



        const currentDate = new Date();

        const pipeline = [
            // Match stage to filter products based on isDeleted
            {
                $match: { isDeleted: false },
            },
            // Lookup stage to populate the category field
            {
                $lookup: {
                    from: 'categories',
                    localField: 'category',
                    foreignField: '_id',
                    as: 'category',
                },
            },
            // Unwind stage to destructure the array created by $lookup
            {
                $unwind: '$category',
            },
            // Lookup stage to join with the offers collection
            {
                $lookup: {
                    from: 'offers',
                    let: { categoryId: '$category._id', productId: '$_id' },
                    pipeline: [
                        {
                            $match: {
                                $expr: {
                                    $and: [
                                        { $or: [{ $eq: ['$product', '$$productId'] }, { $eq: ['$category', '$$categoryId'] }] },
                                        { $lte: ['$validFrom', currentDate] },
                                        { $gte: ['$validUpto', currentDate] },
                                        { $eq: ['$isActive', true] },
                                    ],
                                },
                            },
                        },
                        {
                            $group: {
                                _id: null,
                                maxDiscount: { $max: '$percentageDiscount' },
                            },
                        },
                    ],
                    as: 'offersData',
                },
            },
            // Add fields stage to calculate max discount
            {
                $addFields: {
                    maxDiscountPercentage: {
                        $ifNull: [{ $max: '$offersData.maxDiscount' }, 0],
                    },
                },
            },
            // Add fields stage to calculate final price
            {
                $addFields: {
                    finalPrice: {
                        $cond: {
                            if: { $gt: ['$maxDiscountPercentage', 0] },
                            then: {
                                $multiply: [
                                    '$initialPrice',
                                    { $subtract: [1, { $divide: ['$maxDiscountPercentage', 100] }] },
                                ],
                            },
                            else: '$initialPrice',
                        },
                    },
                },
            },
            // Project stage to remove unnecessary fields
            {
                $project: {
                    offersData: 0,
                    // Add other fields that you want to keep
                },
            },
            // Sorting and Pagination stages
            { $sort: { createdAt: -1 } },
            { $skip: (page - 1) * pageSize },
            { $limit: pageSize },
        ];

        const countPipeline = [
            {
                $match: { isDeleted: false },
            },
            {
                $count: 'totalCount',
            },
        ];

        // Execute the count pipeline and main pipeline in parallel
        const [countResult, productsData] = await Promise.all([
            Products.aggregate(countPipeline),
            Products.aggregate(pipeline),
        ]);

        const totalCount = countResult.length > 0 ? countResult[0].totalCount : 0;
        
        res.render('./admin/productList.ejs', {
            products: productsData,
            currentPage: page,
            totalPages:Math.ceil(totalCount / pageSize),
        });
    } catch (error) {
        console.log(error.message);
        next(error)
    }
};




const productAddLoaderAdmin = async (req, res, next) => {
    try {
        // Fetch _id and name fields from all categories in the Category collection
        const categories = await Category.find({}, '_id name');

        res.render('./admin/product-add.ejs', { categories });
    } catch (error) {
        console.log(error.message);
        next(error)
    }
}

const productAddHandlerAdmin = async (req, res, next) => {
    try {
        const {
            brandName,
            productName,
            gender,
            colors,
            category,
            description,
            price,
            available_stock_small,
            available_stock_medium,
            available_stock_large,
            available_stock_extra_large,
        } = req.body;

        files = req.files;

        // Check individual fields
        if (!brandName) {
            req.flash('error', 'Brand name is required');
            return res.redirect('/admin/products-add');
        }

        if (!productName) {
            req.flash('error', 'Product name is required');
            return res.redirect('/admin/products-add');
        }

        if (!gender) {
            req.flash('error', 'Gender is required');
            return res.redirect('/admin/products-add');
        }

        if (!colors) {
            req.flash('error', 'Colors are required');
            return res.redirect('/admin/products-add');
        }

        if (!category) {
            req.flash('error', 'Category is required');
            return res.redirect('/admin/products-add');
        }

        if (!description) {
            req.flash('error', 'Description is required');
            return res.redirect('/admin/products-add');
        }

        if (!price) {
            req.flash('error', 'Price is required');
            return res.redirect('/admin/products-add');
        }

        

        if (!available_stock_small || !available_stock_medium || !available_stock_large || !available_stock_extra_large) {
            req.flash('error', 'All stock fields are required');
            return res.redirect('/admin/products-add');
        }

        // Check for images
        if (!files || files.length !== 4) {
            req.flash('error', 'Please upload exactly 4 images');
            return res.redirect('/admin/products-add');
        }

        // Fetch category information
        const categoryInfo = await Category.findById(category);

        if (!categoryInfo) {
            req.flash('error', 'Invalid category.');
            return res.redirect('/admin/products-add');
        }

        const colorsArray = req.body.colors || [];
        const filenames = req.files.map((file) => file.filename);

        const product = new Products({
            brandName,
            productName,
            gender,
            colors: colorsArray,
            category: categoryInfo._id,
            description,
            initialPrice: parseFloat(price),
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
        next(error)
    }
};





const singleProductDeletionHandlerAdmin = async (req, res, next) => {
    try {
        const productId = req.params.productId;

        if (!mongoose.Types.ObjectId.isValid(productId)) {
            const genericErrorMessage = 'Invalid product ID: ';
            const genericError = new Error(genericErrorMessage);
            genericError.status = 500;
            throw genericError;
        }

        // Update the product's status to "soft deleted" in the database
        const result = await Products.findByIdAndUpdate(productId, { $set: { isDeleted: true } });

        if (result) {
            req.flash('success', 'Product removed.');
            return res.redirect('/admin/products-list');
        } else {
            const genericErrorMessage = 'Invalid product ID: ';
            const genericError = new Error(genericErrorMessage);
            genericError.status = 404;
            throw genericError;
        }
    } catch (error) {
        console.error(error.message);
        next(error)
    }
};

const multipleProductDeletionHandlerAdmin = async (req, res, next) => {
    try {
        const productIds = req.body.productIds;

        // Update the status of selected products to "soft deleted" in the database
        const result = await Products.updateMany({ _id: { $in: productIds } }, { $set: { isDeleted: true } });

        if (result.modifiedCount > 0) {
            req.flash('success', 'Selected products removed successfully');
            res.redirect('/admin/products-list'); // Redirect to the product list page
        } else {
            const genericErrorMessage = 'No products found : ' + error.message;
            const genericError = new Error(genericErrorMessage);
            genericError.status = 404;
            throw genericError;
        }
    } catch (error) {
        console.error('Error bulk deleting products:', error);
        next(error)
    }
};


const productEditLoaderAdmin = async (req, res, next) => {
    try {
        const productId = req.params.productId;

        if (!mongoose.Types.ObjectId.isValid(productId)) {
            const genericErrorMessage = 'Invalid product ID: ';
            const genericError = new Error(genericErrorMessage);
            genericError.status = 500;
            throw genericError;
        }

        const productData = await Products.findById(productId);
        const categories = await Category.find({}, '_id name'); // Fetch categories

        if (productData) {
            res.render('./admin/product-edit.ejs', { product: productData, categories });
        } else {
            const genericErrorMessage = 'Invalid product details : ';
            const genericError = new Error(genericErrorMessage);
            genericError.status = 404;
            throw genericError;
        }
    } catch (error) {
        console.log(error.message);
        next(error)
    }
};


const productEditHandlerAdmin = async (req, res, next) => {
    try {
        const productId = req.params.productId;

        if (!mongoose.Types.ObjectId.isValid(productId)) {
            const genericErrorMessage = 'Invalid product ID: ';
            const genericError = new Error(genericErrorMessage);
            genericError.status = 500;
            throw genericError;
        }

        const product = await Products.findById(productId, { images: 1 });
        const {
            brandName,
            productName,
            gender,
            colors,
            category,
            description,
            price,
            available_stock_small,
            available_stock_medium,
            available_stock_large,
            available_stock_extra_large,
            sold_stock_small,
            sold_stock_medium,
            sold_stock_large,
            sold_stock_extra_large,
        } = req.body;

        files = req.files;

        // Check if required fields are present
        if (
            !brandName ||
            !productName ||
            !gender ||
            !colors ||
            !category ||
            !description ||
            !price ||
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




        // Fetch category information
        const categoryInfo = await Category.findById(category);



        if (!categoryInfo) {
            req.flash('error', 'Invalid category.');
            return res.redirect('/admin/products-add');
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
            category: categoryInfo._id,
            description,
            initialPrice: parseFloat(price),
            
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
        next(error)
    }
};

const autoCompleteProductsHandler = async (req, res, next) => {
    try {
        const term = req.query.term;

        // Use a MongoDB regex to perform a case-insensitive search
        const regex = new RegExp(term, 'i');

        // Query the products collection for matching products
        const products = await Products.find({
            $or: [
                { productName: { $regex: regex } },
                { brandName: { $regex: regex } },
            ],
        }).select('_id productName brandName images.image1.name'); // Specify the fields to return

        // Prepare the response data
        const suggestions = products.map(product => ({
            id: product._id,
            label: `${product.productName} - ${product.brandName}`,
            thumbnail: product.images.image1.name,
        }));

        // Send the suggestions as JSON response
        res.json(suggestions);
    } catch (error) {
        console.log(error.message);
        next(error)
    }
}

module.exports = {
    productListLoader,
    productSingleLoader,
    productListLoaderAdmin,
    productAddLoaderAdmin,
    productAddHandlerAdmin,
    singleProductDeletionHandlerAdmin,
    multipleProductDeletionHandlerAdmin,
    productEditLoaderAdmin,
    productEditHandlerAdmin,
    autoCompleteProductsHandler,
}