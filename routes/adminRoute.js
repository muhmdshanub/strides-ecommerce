const express = require('express');
const session = require('express-session');
const adminController = require('../controllers/adminController');
const productController = require('../controllers/productController');
const orderController = require('../controllers/orderController');
const categoryController = require('../controllers/categoryController');
const couponController = require('../controllers/couponController')
const offerController = require('../controllers/offerController')
const upload = require('../configs/multerConfig');
const auth = require('../middlewares/adminAuth')

const adminRoute = express();

adminRoute.use(session({
    name: 'adminSession',
    secret: process.env.adminSessionSecret,
    resave: false,
    saveUninitialized: false,
  }));


adminRoute.get('/',adminController.adminRootHandler);

adminRoute.get('/login',auth.isLogOut,adminController.loginLoader);
adminRoute.post('/login',adminController.loginHandler);

adminRoute.get('/logout',auth.isLogin,adminController.logoutHandler);

adminRoute.get('/dashboard',auth.isLogin,adminController.dashboardLoader);
adminRoute.get('/user-creation-statistics',auth.isLogin,adminController.userCreationStatisticsgraphLoader)
adminRoute.get('/monthly-spend-statistics',auth.isLogin,adminController.userMonthlySpendStatisticsGraphLoader)

adminRoute.get('/category-wise-order-statistics',auth.isLogin,adminController.categoryWiseOrderStatisticsLoader)

adminRoute.get('/products-list',auth.isLogin,productController.productListLoaderAdmin);
adminRoute.get('/products-add',auth.isLogin,productController.productAddLoaderAdmin);
adminRoute.post('/products-add',auth.isLogin,upload.array('images',4),productController.productAddHandlerAdmin);
adminRoute.get('/products-delete/:productId',auth.isLogin,productController.singleProductDeletionHandlerAdmin);
adminRoute.post('/products-bulk-delete',auth.isLogin,productController.multipleProductDeletionHandlerAdmin);
adminRoute.get('/products-edit/:productId',auth.isLogin,productController.productEditLoaderAdmin);
adminRoute.post('/products-edit/:productId',auth.isLogin,upload.array('images',4),productController.productEditHandlerAdmin);

adminRoute.get('/users-list',auth.isLogin,adminController.userListLoader);
adminRoute.get('/users-block/:userId',auth.isLogin,adminController.singleUserBlockHandler);
adminRoute.get('/users-unblock/:userId',auth.isLogin,adminController.singleUserUnblockHandler);
adminRoute.post('/users-bulk-block',auth.isLogin,adminController.multipleUsersBlockHandler);
adminRoute.post('/users-bulk-unblock',auth.isLogin,adminController.multipleUsersUnblockHandler);

adminRoute.get('/category-list',auth.isLogin,categoryController.CategoryListLoaderAdmin);

adminRoute.get('/category-add',auth.isLogin,categoryController.categoryAddLoaderAdmin);
adminRoute.post('/category-add',auth.isLogin,categoryController.categoryAddHandlerAdmin);

adminRoute.get('/category-edit/:categoryId',auth.isLogin,categoryController.categoryEditLoaderAdmin);
adminRoute.post('/category-edit/:categoryId',auth.isLogin,categoryController.categoryEditHandlerAdmin);

adminRoute.get('/coupon-list',auth.isLogin,couponController.couponListLoaderAdmin);
adminRoute.get('/coupon-add',auth.isLogin,couponController.couponAddLoaderAdmin);
adminRoute.post('/coupon-add',auth.isLogin,couponController.couponAddHandlerAdmin);
adminRoute.get('/coupon-edit/:couponId',auth.isLogin,couponController.couponEditLoaderAdmin);
adminRoute.post('/coupon-edit/:couponId',auth.isLogin,couponController.couponEditHandlerAdmin);

adminRoute.get('/orders-list',auth.isLogin,orderController.ordersListLoaderAdmin);
adminRoute.post('/order-status-update',auth.isLogin,orderController.orderStatusUpdateHandlerAdmin);

adminRoute.get('/offers-list',auth.isLogin,offerController.offerListLoader)
adminRoute.get('/offers-add',auth.isLogin,offerController.offersAddLoader)
adminRoute.post('/offers-add',auth.isLogin,offerController.offerAddHandlerAdmin);
adminRoute.get('/autocomplete-products',auth.isLogin,productController.autoCompleteProductsHandler)
adminRoute.get('/generate-sales-report',auth.isLogin,orderController.generateSalesReportHandler)


  module.exports =adminRoute;