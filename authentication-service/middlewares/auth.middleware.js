const ApiError = require("../utils/apiError.js");
const jwt = require("jsonwebtoken");
const asyncHandler = require('../utils/asyncHandler');
const User = require("../models/user.model.js");
const redisClient = require("../redis/redisClient.js");

const verifyJwt = asyncHandler(async (req, _, next) => {

    try {
        const token = req.cookies?.accessToken || req.header("Authorization")?.replace("Bearer ", "")

        // console.log("token",token)

        if (!token) {
            throw new ApiError(401, "Unauthorized request")
        }

        const decodedToken = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET)

        const cachedData = await redisClient.get(`current-user:${decodedToken._id}`)
        if (cachedData) {
            req.user = JSON.parse(cachedData)
            next()
            return
        }

        const user = await User.findById(decodedToken?._id).select("-password -refreshToken")

        if (!user) {
            throw new ApiError(401, "Invalid Access Token")
        }

        req.user = user;
        next()
    } catch (error) {
        throw new ApiError(401, error.message || "Invalid Access Token")
    }

})


module.exports = { verifyJwt }