
const app = require('./app');
const connectDb = require('./DB');
const port  = process.env.PORT || 7000

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

// app.listen(process.env.PORT || 4000, () => {
//     console.log(`Server is running at PORt: ${port}`);
// })