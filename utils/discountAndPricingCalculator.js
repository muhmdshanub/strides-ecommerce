
const mongoose = require('mongoose');
const { ObjectId } = require('mongoose').Types;
const Offer = require('../models/offerModel');

async function updateProductDataWithPricing(productData) {
    try {
        const initialPrice = productData.initialPrice;
        const categoryId = getProductCategoryId(productData.category);
        const maxDiscountPercentage = await getMaxDiscountPercentage(productData._id, categoryId);

        const finalPrice = calculateFinalPrice(initialPrice, maxDiscountPercentage);

        // Update productData with maxDiscountPercentage and finalPrice
        productData.maxDiscountPercentage = maxDiscountPercentage;
        productData.finalPrice = finalPrice;

        return productData;
    } catch (error) {
        console.error('Error updating product data with pricing:', error.message);
        throw error;
    }
}

async function getMaxDiscountPercentage(productId, categoryId) {
    const currentDate = new Date();
    const productIdUpdated = new ObjectId(productId);
    const categoryIdUpdated = new ObjectId(categoryId);

    const pipeline = [
        {
            $match: {
                $or: [
                    { product: productIdUpdated },
                    { category: categoryIdUpdated  },
                ],
                validFrom: { $lte: currentDate },
                validUpto: { $gte: currentDate },
                isActive: true,
            },
        },
        {
            $group: {
                _id: null,
                maxDiscount: { $max: '$percentageDiscount' },
            },
        },
    ];

    const result = await Offer.aggregate(pipeline);

    return result.length > 0 ? result[0].maxDiscount : 0;
}

function calculateFinalPrice(initialPrice, maxDiscountPercentage) {
    const discountMultiplier = 1 - maxDiscountPercentage / 100;
    return initialPrice * discountMultiplier;
}

// Helper function to get the category ID from the product.category field
function getProductCategoryId(category) {
    return category && category._id ? category._id : category;
}

module.exports={
    updateProductDataWithPricing,
}
