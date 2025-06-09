const User = require('../models/user.model')

const generateAccessAndRefreshTokens = async (userId) => {
    try {
        const user = await User.findById(userId)
        const accessToken = user.generateAccessToken()
        const refreshToken = user.generateRefreshToken()

        user.refreshToken = refreshToken
        await user.save({ validateBeforeSave: false })   //without validation save to database because password is not modified
        return { accessToken, refreshToken }

    } catch (error) {
        throw new ApiError(500, "someonething went wrong while generating refresh and access token")
    }


}

module.exports = { generateAccessAndRefreshTokens }
