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

module.exports = app;