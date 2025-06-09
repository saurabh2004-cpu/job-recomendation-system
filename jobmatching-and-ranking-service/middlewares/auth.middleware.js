const redisClient = require("../redis/redisClient");
const ApiError = require("../utils/apiError");
const asyncHandler = require("../utils/asyncHandler");
const axios = require("axios");
const jwt = require("jsonwebtoken");

const verifyUser = asyncHandler(async (req, res, next) => {
    const token = req.cookies?.accessToken || req.header("Authorization")?.replace("Bearer ", "")

    if (!token) {
        throw new ApiError(401, "Unauthorized request")
    }

    const decodedToken = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET)
    // console.log("decodedToken", decodedToken)

    //find in redis
    const cachedUserData = await redisClient.get(`current-user:${decodedToken._id}`)
    // console.log("cachedUserData", JSON.parse(cachedUserData))

    if (cachedUserData) {
        req.user = JSON.parse(cachedUserData)

        console.log("req.user", req.user._id)
        next()
    } else {

        try {
            console.log("making http request")
            const user = await axios.get('http://localhost:7000/user/get-current-user', {
                headers: {
                    authorization: req.headers.authorization
                },
                Credentials: true
            })

            if (!user) {
                return new ApiError(401, "User not found")
            }

            //store user in redis
            await redisClient.setex(`current-user:${user.data._id}`, 86400, JSON.stringify(user.data));

            req.user = user.data

            next()
        } catch (error) {
            throw new ApiError(401, "Unauthorized")
        }
    }

})

module.exports = verifyUser
