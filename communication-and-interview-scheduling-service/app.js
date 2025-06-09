const express = require('express')
const cors = require('cors')
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const interviewRoutes = require('./routes/interview.routes')

require('./soket/soket.io')

const app = express()

//middlewares
app.use(express.json())
app.use(cookieParser());
app.use(cors({
    origin: process.env.ALLOWED_ORIGIN || "*"
}))
app.use(bodyParser.json())
app.use(cookieParser());

app.use('/interviews',interviewRoutes)


module.exports = app



