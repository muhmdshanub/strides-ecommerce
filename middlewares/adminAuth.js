const isLogin = async (req, res, next) => {
    try {
        if (req.session.adminId) {
            next(); 
        } else {
            res.redirect('/admin/login');
            
        }
        
    } catch (error) {
        console.log(error.message);
    }
};

const isLogOut = async (req, res, next) => {
    try {
        if (req.session.adminId) {
            res.redirect('/admin/dashboard'); // User is logged in, redirect to '/home'
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