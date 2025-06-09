const express = require('express')
const dotenv = require('dotenv')
const cors = require('cors')
const app = express()
const userRoutes = require('./routes/user.routes')
const cookieParser = require('cookie-parser');


dotenv.config()

//middlewares
app.use(express.json())
app.use(cors({
    origin: process.env.ALLOWED_ORIGIN || "*"
}))
app.use(cookieParser());


//routes
app.use('/user', userRoutes)



module.exports = app