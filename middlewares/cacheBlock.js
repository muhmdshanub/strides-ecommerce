
module.exports.cacheBlock = (req, res, next) => {
    res.header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
    next();
  }
