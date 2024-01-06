module.exports.adminErrorHandler = (err, req, res, next) => {
    const statusCode = err.status || 500;
    console.error(err.stack);
    res.status(statusCode).render('./admin/error', {
        status: statusCode,
        message: err.message || 'Internal Server Error',
    });
};