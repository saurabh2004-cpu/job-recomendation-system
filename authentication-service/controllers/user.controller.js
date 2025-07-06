// const redisClient = require('../redis/redisClient')
const User = require('../models/user.model')
const ApiError = require('../utils/apiError')
const ApiResponse = require('../utils/apiResponse')
const asyncHandler = require('../utils/asyncHandler')
const { generateAccessAndRefreshTokens } = require('../utils/helper')
const jwt = require("jsonwebtoken");
const redisClient = require('../redis/redisClient')


//signup
const registerUser = asyncHandler(async (req, res) => {

    const { fullName, email, username, password } = req.body

    if ([fullName, email, username, password].some((field) => field?.trim() === "")) {
        return new Api(400, "all fields are required")
    }

    const existedUser = await User.findOne({
        $or: [{ username }, { email }]
    })

    if (existedUser) {
        return res.json(new ApiResponse(400, null, "user already exists"))
    }

    const user = await User.create({
        fullName,
        email,
        password,
        username: username.toLowerCase(),
    })

    const createdUser = await User.findById(user._id).select(
        "-password -refreshToken"
    )

    if (!createdUser) {
        throw new ApiError(500, "something Went wrong while registering a user")
    }

    //store user in redis
    await redisClient.setex(`current-user:${user._id}`, 86400, JSON.stringify(user));

    return res.status(200).json(
        new ApiResponse(200, createdUser, "User registered successfully")
    )
})

// login 
const loginUser = asyncHandler(async (req, res) => {

    const { email, username, password } = req.body

    if (!username && !email) {
        throw new ApiError(400, "username or email is required")
    }

    const user = await User.findOne({
        $or: [{ username }, { email }]
    })

    if (!user) {
        throw new ApiError(404, "user does not exist !")
    }
    const isPasswordValid = await user.isPasswordCorrect(password)

    if (!isPasswordValid) {
        throw new ApiError(401, "Incorrect Password !")
    }

    //5. access and refresh token
    const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(user._id)

    //6. send cookie
    const loggedInUser = await User.findById(user._id).
        select("-password -refreshToken")

    const options = {
        httpOnly: true,
        secure: true,
        maxAge: 1000 * 60 * 60 * 24,
        
    }

    //store user in redis
    await redisClient.setex(`current-user:${user._id}`, 86400, JSON.stringify(user))

    return res
        .status(200)
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken", refreshToken, options)
        .json(
            new ApiResponse(
                200, {
                user: loggedInUser, accessToken, refreshToken
            },
                "User LoggedIn Successfully"
            )
        )

})

//get current user
const getCurrentUser = asyncHandler(async (req, res) => {
    await redisClient.setex(`current-user:${req.user._id}`, 86400, JSON.stringify(req.user))
    return res
        .status(200)
        .json(new ApiResponse(200, req.user, "current user fetched succusssfully"))
})

// logout
const logoutUser = asyncHandler(async (req, res) => {

    //delete userdata from redis
    redisClient.del(`current-user:${req.user._id}`)

    await User.findByIdAndUpdate(
        req.user._id,
        {
            $unset: {
                refreshToken: 1   //removes the field from document
            }
        },
        {
            new: true
        }
    )
    const options = {
        httpOnly: true,
        secure: true,
    }
    return res
        .status(200)
        .clearCookie("accessToken", options)
        .clearCookie("refreshToken", options)
        .json(new ApiResponse(200, {}, "User Logged Out"))


})


//refres Access token - remaining
const refreshAccessToken = asyncHandler(async (req, res) => {

    try {
        const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken

        if (!incomingRefreshToken) {
            throw new ApiError(401, "unauthorized request")
        }

        const decodedToken = jwt.verify(
            incomingRefreshToken,
            process.env.REFRESH_TOKEN_SECRET
        )

        const user = await User.findById(decodedToken?._id)

        if (!user) {
            throw new ApiError(401, "invalid refresh token")
        }

        if (incomingRefreshToken !== user?.refreshToken) {
            throw new ApiError(401, "Refresh token is expired or used")
        }

        const options = {
            httpOnly: true,
            secure: true
        }

        const { accessToken, newRefreshToken } = await generateAccessAndRefreshTokens(user._id)

        return res
            .status(200)
            .cookie("accessToken", accessToken, options)
            .cookie("refreshToken", newRefreshToken, options)
            .json(
                new ApiResponse(
                    200,
                    { accessToken, newRefreshToken },
                    "Access token refreshed"
                )
            )

    } catch (error) {
        throw new ApiError(401, error?.message || "invalid refresh token")
    }


})


//change password -remaining
const changeCurrentPassword = asyncHandler(async (req, res) => {

    const { oldPassword, newPassword } = req.body //confpassword

    const user = await User.findById(req.user?._id)
    const isPasswordCorrect = await user.isPasswordCorrect(oldPassword)

    if (!isPasswordCorrect) {
        throw new ApiError(400, "Invalid old password")
    }

    user.password = newPassword

    //store user in redis
    await redisClient.setex(`current-user:${user._id}`, 86400, JSON.stringify(user));

    await user.save({ validateBeforeSave: false })

    return res
        .status(200)
        .json(new ApiResponse(200, {}, "password changed successfully"))

})

//update account details 
const updateAccountDetails = asyncHandler(async (req, res) => {

    const { fullName, username,phone,location,professionalTitle,bio,experience,skills,portfolio } = req.body

    console.log("update user details req.body", req.body)
    console.log("skills",skills)

    if (!fullName || !username || !phone || !location || !professionalTitle || !bio || !experience || !skills || !portfolio) {
        throw new ApiError(400, "all field are required")
    }
    
    const skillsArray = skills.filter((skill) => skill.trim() !== "");

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                fullName: fullName,
                username: username,
                phone: phone,
                location: location,
                professionalTitle: professionalTitle,
                bio: bio,
                experience: experience,
                skills: skillsArray,
                portfolio: portfolio
            }
        },
        {
            new: true
        }
    ).select("-password")

    if (!user) {
        throw new ApiError(404, "user not found")
    }

    console.log("user", user)

    //store user in redis
    await redisClient.setex(`current-user:${user._id}`, 86400, JSON.stringify(user));

    return res
        .status(200)
        .json(new ApiResponse(200, user, "account details updated successfully"))

})


module.exports = {
    registerUser,
    loginUser,
    logoutUser,
    refreshAccessToken,
    changeCurrentPassword,
    getCurrentUser,
    updateAccountDetails,
}

