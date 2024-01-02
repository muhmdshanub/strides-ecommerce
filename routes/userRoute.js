const express = require('express');
const session = require('express-session');
const userController = require('../controllers/userController')
const wishlistController = require('../controllers/wishlistController')
const userProfileController = require('../controllers/user/profileController.js')
const auth = require('../middlewares/loginAuth')

const userRoute = express();

userRoute.use(session({
    name: 'userSession',
    secret: process.env.userSessionSecret,
    resave: false,
    saveUninitialized: false,
  }));

userRoute.get('/',auth.isLogOut,auth.isLogin);
userRoute.get('/signup',auth.isLogOut,userController.signupLoader);
userRoute.post('/signup',userController.signupHandler);
userRoute.get('/resend-otp',userController.resendOtpHandler);
userRoute.get('/signup-verify',auth.isLogOut,userController.loadsignupVerify);
userRoute.post('/signup-verify',userController.signupVerificationHandler);
userRoute.get('/login',auth.isLogOut,userController.loginLoader);
userRoute.get('/home',auth.isLogin,userController.homeLoader);
userRoute.post('/login',userController.loginHandler);
userRoute.get('/logout',auth.isLogin,userController.logoutHandler);
userRoute.get('/products',auth.isLogin,userController.productListLoader);
userRoute.get('/products/:productId',auth.isLogin,userController.productSingleLoader);
userRoute.post('/add-to-cart/:productId',auth.isLogin,userController.addToCartHandler);

userRoute.get('/cart',auth.isLogin,userController.cartLoader);
userRoute.delete('/cart-item-delete/:itemId',auth.isLogin,userController.cartItemDeleteHandler);

userRoute.get('/cart-item-quantity-update',auth.isLogin,userController.cartItemQuantityUpdateHandler);
userRoute.get('/cart-item-size-update',auth.isLogin,userController.cartItemSizeUpdateHandler);
userRoute.get('/cart-to-address',auth.isLogin,userController.cartToAddressHandler);

userRoute.get('/address',auth.isLogin,userController.addressLoader);

userRoute.post('/address-add',auth.isLogin,userController.addressAddLoader);

userRoute.put('/address-edit/:addressId',auth.isLogin,userController.addressEditLoader);
userRoute.delete('/address-delete/:addressId',auth.isLogin,userController.addressDeleteHandler);
userRoute.get('/address-to-payment/:addressId',auth.isLogin,userController.addressToPaymentHandler);

userRoute.get('/payment-selection',auth.isLogin,userController.paymentSelectionLoader);

userRoute.get('/cod-place-order/:addressId',auth.isLogin,userController.codPlaceOrderHandler);



userRoute.get('/profile',auth.isLogin,userProfileController.profileLoader);
userRoute.post('/profile-user-edit',auth.isLogin,userProfileController.profileUserEditHandler);
userRoute.get('/list-profile-addresses',auth.isLogin,userProfileController.profileaddressesLoader);

userRoute.post('/profile-primary-address-update/:addressId',auth.isLogin,userProfileController.updateUserPrimaryAddress);
userRoute.post('/profile-user-password-change',auth.isLogin,userProfileController.passwordChangeHandler);

userRoute.get('/list-profile-orders',auth.isLogin,userProfileController.profileOrdersLoader);
userRoute.post('/profile-orders-cancel/:orderId',auth.isLogin,userProfileController.profileOrdersCancelHandler);
userRoute.post('/profile-orders-return/:orderId',auth.isLogin,userProfileController.profileOrdersReturnHandler);

userRoute.get('/wishlist',auth.isLogin,wishlistController.wishlistLoader);
userRoute.post('/add-to-wishlist/:productId',auth.isLogin,wishlistController.addToWishlistHandler);
userRoute.post('/remove-from-wishlist/:productId',auth.isLogin,wishlistController.removeFromWishlistHandler);
userRoute.post('/move-from-wishlist-to-cart/:productId',auth.isLogin,wishlistController.moveFromWishlistToCartHandler);


module.exports =userRoute;