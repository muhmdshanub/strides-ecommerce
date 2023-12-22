const isLogin = async (req, res, next) => {
    try {
        if (req.session.userId) {
            next(); 
        } else {
            res.redirect('/login');
            
        }
        
    } catch (error) {
        console.log(error.message);
    }
};

const isLogOut = async (req, res, next) => {
    try {
        if (req.session.userId) {
            res.redirect('/home'); // User is logged in, redirect to '/home'
        } else{
            next();
        }
        
    } catch (error) {
        console.log(error.message);
    }
};

module.exports = {
    isLogOut,
    isLogin
}