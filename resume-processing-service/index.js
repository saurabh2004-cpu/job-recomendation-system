
const app = require('./app');
const connectDb = require('./DB');
const port  = process.env.PORT || 4000
require('./notification/email');

connectDb()
    .then(() => {

        app.listen(port, () => {
            console.log(`Server is running at PORt: ${process.env.PORT}`);
        })

        app.on("error", (error) => {
            console.log("error", error)
            throw error
        })

    })
    .catch((error) => {
        console.log("MONGO db connection failed !!", error)
    })

