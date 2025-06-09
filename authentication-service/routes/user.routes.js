// import { generateAccessAndRefreshTokens } from '../controllers/user.controller.js'
const { Router } = require('express')
const {
    loginUser,
    logoutUser,
    registerUser,
    refreshAccessToken,
    changeCurrentPassword,
    getCurrentUser,
    updateAccountDetails,

} = require('../controllers/user.controller.js')

const { verifyJwt } = require('../middlewares/auth.middleware.js')
// const passport = require('passport');

const router = Router()

router.route("/register").post(registerUser)

router.route("/login").post(loginUser)

// secured routes
router.route("/logout").post(verifyJwt, logoutUser)
router.route("/refresh-access-token").post(refreshAccessToken)
router.route("/change-password").patch(verifyJwt, changeCurrentPassword)
router.route("/get-current-user").get(verifyJwt, getCurrentUser)
router.route("/update-account-details").patch(verifyJwt, updateAccountDetails)



//passsport authenticate

// Initiates Google OAuth login
// router.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

// // Callback route for Google OAuth
// router.get(
//     '/oauth2/redirect/google',
//     passport.authenticate('google', { session: false, failureRedirect: '/login' }),
//     async (req, res) => {
//         // Once authenticated with Google, generate JWT tokens
//         const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(req.user._id);

//         const options = {
//             httpOnly: true,
//             secure: true, // Use `true` if you're using HTTPS
//         };

//         // Send tokens via cookies or JSON response
//         res
//             .cookie('accessToken', accessToken, options)
//             .cookie('refreshToken', refreshToken, options)
//             .redirect('http://localhost:5173/dashboard')
//     }
// );




module.exports =  router




