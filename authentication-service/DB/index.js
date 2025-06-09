const mongoose = require('mongoose')


 const connectDb = async () => {
    try {
        const connetionInstance = await mongoose.connect(`${process.env.MONGODB_URL}`)
        console.log(`\n MongoDB connected: DB HOST: ${connetionInstance.connection.host}`)
        // console.log(connetionInstance)
    } catch (error) {
        console.log("MONGODB CONNECTION FAILED !!:", error)
        process.exit(1)
    }
}

module.exports = connectDb