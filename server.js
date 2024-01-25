require('dotenv').config();
const app = require('./app');

const { connectToDatabase } = require('./configs/dbConnection');
  
  async function startServer() {
    await connectToDatabase();
  
    const port = parseInt(process.env.PORT, 10) || 8000;
    app.listen(port, () => {
      console.log(`Server is running on port ${port}`);
    });
  }
  
  startServer();