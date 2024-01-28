const express = require('express');
const path = require('path');
const flash = require('express-flash');
const {cacheBlock} = require('./middlewares/cacheBlock');
const userRoute = require('./routes/userRoute');
const adminRoute = require('./routes/adminRoute');
const logger = require('./configs/logger');

const Category = require('./models/categoryModel')

const app = express ();

app.set('view engine', 'ejs');

app.set('logger', logger);

app.use(express.static(path.join(__dirname, 'public')));
app.use('/node_modules', express.static(path.join(__dirname, 'node_modules')));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(flash());
app.use(cacheBlock);

// Attach the io instance to the request object
app.use((req, res, next) => {
    req.io = app.get('io'); // Access the io instance set in server.js
    next();
});



app.use('/',userRoute);
app.use('/admin',adminRoute);

app.use('*', (req, res, next) => {
    const err = new Error('Not Found');
    err.status = 404;
    next(err);
  });

app.use( async (err, req, res, next) => {
    const statusCode = err.status || 500;

    const categories = await Category.find();
    
    if (req.session.adminId) {
        // Admin is logged in
        return res.status(statusCode).render('./admin/error.ejs', {
            status: statusCode,
            message: err.message || 'Internal Server Error',
        });
    } else if (req.session.userId) {
        // User is logged in
        return res.status(statusCode).render('./user/error', {
            status: statusCode,
            message: err.message || 'Internal Server Error',
            categories,
        });
    } else {
        // No login details
        return res.status(statusCode).render('./user/error-no-login', {
            status: statusCode,
            message: err.message || 'Internal Server Error',
        });
    }
})



module.exports = app;