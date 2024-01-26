const multer = require('multer');
const path = require('path');
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, path.join(__dirname, '../public/images/productImages/')); // Destination folder for uploaded files
    },
    filename: function (req, file, cb) {
        const sanitizedBrandName = req.body.brandName.replace(/[^\w]/g, '');
        const sanitizedProductName = req.body.productName.replace(/[^\w]/g, '');
        
        const newName = `${sanitizedBrandName}_${sanitizedProductName}_${file.originalname}_${Date.now()}`;
        cb(null, newName); // Use the original file name as the new file name
    }

})

const fileFilter = (req, file, cb) => {
    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/jpg', 'image/webp']; // Add more mime types if needed

    if (allowedMimeTypes.includes(file.mimetype)) {
        cb(null, true); // Accept the file
    } else {
        cb(new Error('Invalid file type. Only JPEG, PNG, and GIF are allowed.'), false); // Reject the file
    }
};

const limits = {
    fileSize: 1024 * 1024 * 20, // 20 MB (adjust the size limit as needed)
};


const upload = multer({ storage: storage ,fileFilter: fileFilter, limits: limits,});

module.exports = upload;