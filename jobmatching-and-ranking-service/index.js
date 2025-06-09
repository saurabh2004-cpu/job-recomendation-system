const app = require("./app");
const port = process.env.PORT || 5000
const connectDb = require("./DB/index");
require("./utils/cron.sheduleJobs");

connectDb()
    .then(async () => {

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
