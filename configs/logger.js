const winston = require('winston');

const logger = winston.createLogger({
  transports: [
    new winston.transports.Console(), // Log to the console
    new winston.transports.File({ filename: '../winston_logs/error.log', level: 'error' }), // Log errors to a file
    new winston.transports.File({ filename: '../winston_logs/combined.log' }) // Log everything to another file
  ]
});

module.exports = logger;