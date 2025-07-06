const express = require('express');
const proxy = require("express-http-proxy");
const cors = require('cors')
const dotenv = require('dotenv')

dotenv.config()

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({
    origin: "http://localhost:3000" || process.env.ALLOWED_ORIGIN,
    credentials: true
}))

app.use('/resume-analyzer', proxy('http://localhost:4000'));

app.use('/job-matching-and-ranking', proxy('http://localhost:5000'));

app.use('/communication', proxy('http://localhost:6000'));

app.use('/auth', proxy('http://localhost:7000'))

app.listen(PORT, () => {
    console.log(`Server is running at PORT: ${PORT}`);
});