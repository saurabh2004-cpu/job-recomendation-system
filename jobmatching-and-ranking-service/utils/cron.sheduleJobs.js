const cron = require('node-cron');
const Job = require('../models/jobs.model');
const redisClient = require('../redis/redisClient');


// Schedule a cron job to delete expired jobs every day at midnight
const deleteExpiredJobs = cron.schedule('0 0 * * *', async () => {
    const currentDate = new Date();
    console.log("current date", currentDate);

    try {
        //return jobs where expiryDate is less than the current time 
        const expiredJobs = await Job.find({ expiryDate: { $lt: currentDate } });

        //delete expired jobs from redis and db
        if (expiredJobs.length > 0) {

            for (const job of expiredJobs) {

                //1. Delete the job from Redis
                await redisClient.del(`job:${job._id}`);

                //2. delete from recruters all jobs hash
                redisClient.hdel(`recruiter-all-jobs:${job.recruiterId}`, job._id)

                //3.delete from jobsByKeyword hash
                const jobKeywords = await redisClient.smembers(`jobKeywords:${job._id}`);

                for (const keyword of jobKeywords) {
                    await redisClient.hdel(`jobsByKeyword:${keyword}`, job._id); //delete job from hash based on jobId
                    await redisClient.srem(`jobKeywords:${job._id}`, keyword)  //delete keyword from jobKeywords set
                }
            }

            //4. delete from db
            await Job.deleteMany({ expiryDate: { $lt: currentDate } });
            console.log(`Deleted ${expiredJobs.length} expired jobs`);
        }
    } catch (error) {
        console.error('Error deleting expired jobs:', error);
    }
});

module.exports = { deleteExpiredJobs };