const express = require('express');
const session = require('express-session');
const userController = require('../controllers/userController')
const productController = require('../controllers/productController')
const cartController = require('../controllers/cartController')
const wishlistController = require('../controllers/wishlistController')
const orderController = require('../controllers/orderController.js')
const addressController = require('../controllers/addressController.js')
const auth = require('../middlewares/loginAuth')

const userRoute = express();

userRoute.use(session({
    name: 'userSession',
    secret: process.env.userSessionSecret,
    resave: false,
    saveUninitialized: false,
  }));

userRoute.get('/',auth.isLogOut,auth.isLogin);
userRoute.get('/forgot-password',auth.isLogOut,userController.forgotPasswordFormLoader);
userRoute.post('/forgot-password',auth.isLogOut,userController.forgotPasswordFormHandler);
userRoute.get('/forgot-password-otp-verify',auth.isLogOut,userController.forgotPasswordOtpVerifyLoader);  
userRoute.get('/resend-otp-forgot-password',auth.isLogOut,userController.forgotPasswordResendOtpHandler);
userRoute.post('/forgotten-password-otp-verify',auth.isLogOut,userController.forgotPasswordOtpVerifyHandler);
userRoute.get('/forgot-password-update-password',auth.isLogOut,userController.forgotPasswordUpdateLoader);
userRoute.post('/forgot-password-update-password',auth.isLogOut,userController.forgotPasswordUpdateHandler);

userRoute.get('/signup',auth.isLogOut,userController.signupLoader);
userRoute.post('/signup',userController.signupHandler);
userRoute.get('/resend-otp',userController.resendOtpHandler);
userRoute.get('/signup-verify',auth.isLogOut,userController.loadsignupVerify);
userRoute.post('/signup-verify',userController.signupVerificationHandler);
userRoute.get('/login',auth.isLogOut,userController.loginLoader);
userRoute.get('/home',auth.isLogin,userController.homeLoader);
userRoute.post('/login',userController.loginHandler);
userRoute.get('/logout',auth.isLogin,userController.logoutHandler);
userRoute.get('/products',auth.isLogin,productController.productListLoader);
userRoute.get('/products/:productId',auth.isLogin,productController.productSingleLoader);
userRoute.post('/add-to-cart/:productId',auth.isLogin,cartController.addToCartHandler);

userRoute.get('/cart',auth.isLogin,cartController.cartLoader);
userRoute.delete('/cart-item-delete/:itemId',auth.isLogin,cartController.cartItemDeleteHandler);

userRoute.get('/cart-item-quantity-update',auth.isLogin,cartController.cartItemQuantityUpdateHandler);
userRoute.get('/cart-item-size-update',auth.isLogin,cartController.cartItemSizeUpdateHandler);
userRoute.get('/cart-to-address',auth.isLogin,cartController.cartToAddressHandler);

userRoute.get('/address',auth.isLogin,addressController.addressLoader);

userRoute.post('/address-add',auth.isLogin,addressController.addressAddLoader);

userRoute.put('/address-edit/:addressId',auth.isLogin,addressController.addressEditLoader);
userRoute.delete('/address-delete/:addressId',auth.isLogin,addressController.addressDeleteHandler);
userRoute.get('/address-to-payment/:addressId',auth.isLogin,addressController.addressToPaymentHandler);

userRoute.get('/payment-selection',auth.isLogin,userController.paymentSelectionLoader);

userRoute.get('/cod-place-order/:addressId',auth.isLogin,orderController.codPlaceOrderHandler);



userRoute.get('/profile',auth.isLogin,userController.profileLoader);
userRoute.post('/profile-user-edit',auth.isLogin,userController.profileUserEditHandler);
userRoute.get('/list-profile-addresses',auth.isLogin,addressController.profileaddressesLoader);

userRoute.post('/profile-primary-address-update/:addressId',auth.isLogin,addressController.updateUserPrimaryAddress);
userRoute.post('/profile-user-password-change',auth.isLogin,userController.passwordChangeHandler);

userRoute.get('/list-profile-orders',auth.isLogin,orderController.profileOrdersLoader);
userRoute.post('/profile-orders-cancel/:orderId',auth.isLogin,orderController.profileOrdersCancelHandler);
userRoute.post('/profile-orders-return/:orderId',auth.isLogin,orderController.profileOrdersReturnHandler);

userRoute.get('/wishlist',auth.isLogin,wishlistController.wishlistLoader);
userRoute.post('/add-to-wishlist/:productId',auth.isLogin,wishlistController.addToWishlistHandler);
userRoute.post('/remove-from-wishlist/:productId',auth.isLogin,wishlistController.removeFromWishlistHandler);
userRoute.post('/move-from-wishlist-to-cart/:productId',auth.isLogin,wishlistController.moveFromWishlistToCartHandler);


module.exports =userRoute;