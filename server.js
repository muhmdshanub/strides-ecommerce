require('dotenv').config();
const app = require('./app');
const http = require('http').createServer(app);
const initializeSocket = require('./configs/socket');

// Initialize Socket.IO and attach it to the app
app.set('io', initializeSocket(http));

const { connectToDatabase } = require('./configs/dbConnection');

async function startServer() {
    await connectToDatabase();

    const port = parseInt(process.env.PORT, 10) || 8000;
    http.listen(port, () => {
        console.log(`Server is running on port ${port}`);
    });
}

startServer();
