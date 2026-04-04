require("dotenv").config();
const express = require("express");
const cors = require("cors");


const connectDB = require("./config/db");
const { log } = require('console');

const app = express();
const PORT = process.env.PORT || 5000;

connectDB()


app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});