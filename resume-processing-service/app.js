const express = require('express')
const dotenv = require('dotenv')
const cors = require('cors')
const resumeRoutes = require('./routes/resume-processing.route')
const cookieParser = require('cookie-parser')

const app = express()

dotenv.config()

//middlewares
app.use(express.json())
app.use(cors({
    origin: process.env.ALLOWEED_ORIGINS 
}))
app.use(cookieParser())


//routes
app.use('/resume', resumeRoutes)



module.exports = app