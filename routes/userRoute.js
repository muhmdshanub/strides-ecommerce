const express = require('express');
const session = require('express-session');
const userController = require('../controllers/userController')
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
userRoute.post('/add-to-cart/:productId',auth.isLogin,userController.addToCArtHandler);


module.exports =userRoute;