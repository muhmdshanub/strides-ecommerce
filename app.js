const express = require('express');
const path = require('path');
const flash = require('express-flash');
const {cacheBlock} = require('./middlewares/cacheBlock');
const userRoute = require('./routes/userRoute');
const adminRoute = require('./routes/adminRoute');

const app = express ();

app.set('view engine', 'ejs');

app.use(express.static(path.join(__dirname, 'public')));
app.use('/node_modules', express.static(path.join(__dirname, 'node_modules')));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(flash());
app.use(cacheBlock);


app.use('/',userRoute);
app.use('/admin',adminRoute);

app.use('*', (req, res, next) => {
    const err = new Error('Not Found');
    err.status = 404;
    next(err);
  });

app.use((err, req, res, next) => {
    const statusCode = err.status || 500;
    
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