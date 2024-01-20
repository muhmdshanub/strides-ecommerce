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

        // Extracting sorting parameter from the query
        const sortOption = req.query.sort || 'craetedAt'; // Default to sorting by creation date if not provided

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


        const result = await Products.paginate(filterObject, { page: page, limit: pageSize, sort: sortObject });

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
        const categories = await  getAllCategories();

        res.render('./user/productList.ejs', {
            products: result.docs,
            currentPage: result.page,
            totalPages: result.totalPages,
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

        const productData = await Products.findById(productId).populate('category');
        const categories = await getAllCategories();
        if (productData) {

            await Products.updateOne({ _id: productId }, { $inc: { popularity: 0.01 } });

            res.render('./user/product-single.ejs', { product: productData, categories });
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

        const options = {
            page: page,
            limit: pageSize,
            populate: {
                path: 'category',
                select: 'name', // Specify the fields to populate (only 'name' in this case)
            },
        };

        const productsData = await Products.paginate({ isDeleted: false }, options);

        res.render('./admin/productList.ejs', {
            products: productsData.docs,
            currentPage: productsData.page,
            totalPages: productsData.totalPages,
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
            discount,
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

        if (!discount) {
            req.flash('error', 'Discount is required');
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
        next(error)
    }
};


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
}