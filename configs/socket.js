// socket.js

const socketIO = require('socket.io');

function initializeSocket(http) {
    return socketIO(http);
}

module.exports = initializeSocket;