const express = require('express')
const dotenv = require('dotenv')
const cors = require('cors')
const employeeRoutes = require('./routes/jobMatching.route')
const recruiterRoutes = require('./routes/jobs.route')
const cookieParser = require('cookie-parser')

const app = express()

dotenv.config()

//middlewares
app.use(express.json())
app.use(cookieParser())
app.use(cors({
    origin: process.env.ALLOWED_ORIGIN || "*"
}))


//employee routes
app.use('/job-matching', employeeRoutes)

//recruters routes
app.use('/jobs', recruiterRoutes)


module.exports = app