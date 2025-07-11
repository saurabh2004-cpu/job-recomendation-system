const { Schema, mongoose } = require("mongoose");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const userSchema = new Schema({
    username: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true,
        index: true,
    },
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true,
        index: true,
    },
    fullName: {
        type: String,
        required: true,
        trim: true,
        index: true,
    },
    phone: {
        type: String,
        trim: true,
        index: true,
    },
    location: {
        type: String,
        trim: true,
        index: true,
    },
    professionalTitle: {
        type: String,
        trim: true,
        index: true,
    },
    bio: {
        type: String,
        trim: true,
        index: true,
    },
    experience: {
        type: String,
        enum: ['Fresher','mid-level', 'Senior', 'Expert'],
        trim: true,
        index: true,
    },
    skills: {
        type: [String],
        trim: true,
        index: true,
    },
    portfolio: {
        type: String,
        trim: true,
        index: true,
    },
    password: {
        type: String,
        required: [true, 'Password is required'],
    },
    education: {
        type: String,
        trim: true,
        index: true,
        enum: ['Bachelors', 'Masters', 'Btech', 'Diploma', 'None']
    },
    refreshToken: {
        type: String,
    },
    googleId: {
        type: String,
    }


}, { timestamps: true })

//before save 
userSchema.pre("save", async function (next) {

    if (!this.isModified("password")) return next();

    this.password = await bcrypt.hash(this.password, 10)
    next()
})

//custom methods
userSchema.methods.isPasswordCorrect = async function (password) {
    return await bcrypt.compare(password, this.password)
}

userSchema.methods.generateAccessToken = function () {
    return jwt.sign(
        {
            _id: this._id,
            email: this.email,
            username: this.username,
            fullName: this.fullName
        },
        process.env.ACCESS_TOKEN_SECRET,
        {
            expiresIn: process.env.ACCESS_TOKEN_EXPIRY
        }
    )
}
userSchema.methods.generateRefreshToken = function () {
    return jwt.sign(
        {
            _id: this._id,

        },
        process.env.REFRESH_TOKEN_SECRET,
        {
            expiresIn: process.env.REFRESH_TOKEN_EXPIRY
        }
    )
}

const User = mongoose.model("User", userSchema)
module.exports = User