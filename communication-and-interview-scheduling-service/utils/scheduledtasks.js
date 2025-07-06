const cron = require('node-cron');
const interview = require('../models/interview.model');


cron.schedule('0 * * * *', async () => {
    console.log("Cron job triggered at", new Date().toISOString());

    const interviews = await interview.find();

    interview.map(async (interview) => {
        if (Date.now > interview.scheduledTime) {
            interview.status = "expired";
        }

        await interview.save();
    })

});