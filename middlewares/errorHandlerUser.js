module.exports.userErrorHandler = (err, req, res, next) => {
    const statusCode = err.status || 500;
    console.error(err.stack);
    res.status(statusCode).render('./user/error', {
        status: statusCode,
        message: err.message || 'Internal Server Error',
    });
};