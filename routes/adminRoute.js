const express = require('express');
const session = require('express-session');
const adminController = require('../controllers/adminController');
const upload = require('../configs/multerConfig');
const auth = require('../middlewares/adminAuth')

const adminRoute = express();

adminRoute.use(session({
    name: 'adminSession',
    secret: process.env.adminSessionSecret,
    resave: false,
    saveUninitialized: false,
  }));



adminRoute.get('/login',auth.isLogOut,adminController.loginLoader);
adminRoute.post('/login',adminController.loginHandler);
adminRoute.get('/dashboard',auth.isLogin,adminController.dashboardLoader);


adminRoute.get('/products-list',auth.isLogin,adminController.productListLoader);
adminRoute.get('/products-add',auth.isLogin,adminController.productAddLoader);
adminRoute.post('/products-add',auth.isLogin,upload.array('images',4),adminController.productAddHandler);
adminRoute.get('/products-delete/:productId',auth.isLogin,adminController.singleProductDeletionHandler);
adminRoute.post('/products-bulk-delete',auth.isLogin,adminController.multipleProductDeletionHandler);
adminRoute.get('/products-edit/:productId',auth.isLogin,adminController.productEditLoader);
adminRoute.post('/products-edit/:productId',auth.isLogin,upload.array('images',4),adminController.productEditHandler);

adminRoute.get('/users-list',auth.isLogin,adminController.userListLoader);
adminRoute.get('/users-block/:userId',auth.isLogin,adminController.singleUserBlockHandler);
adminRoute.get('/users-unblock/:userId',auth.isLogin,adminController.singleUserUnblockHandler);
adminRoute.post('/users-bulk-block',auth.isLogin,adminController.multipleUsersBlockHandler);
adminRoute.post('/users-bulk-unblock',auth.isLogin,adminController.multipleUsersUnblockHandler);

adminRoute.get('/categories-list',auth.isLogin,adminController.CategoryListLoader);

  module.exports =adminRoute;