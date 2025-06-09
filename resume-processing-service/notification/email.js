const { subscribeToQueue } = require('../rabbitMQ/rabbit');
const { Resend } = require('resend');
const dotenv = require('dotenv');
const { cosineSimilarity, createEmailHtmlTemplate, getCurrentUser } = require('../utils/helper');
const redisClient = require('../redis/redisClient');
const cron = require('node-cron');
const Resume = require('../models/resume.model');

dotenv.config();

const resend = new Resend(process.env.RESEND_API_KEY || 're_MnLGECL2_HJeMX1vRjye5wFXehLLCsKke');


//subscribe for job Queue
subscribeToQueue("job_Queue", async (message) => {
    const allResumes = await Resume.find({})
    if (!allResumes || allResumes.length === 0) {
        console.log("no resumes found")
        return
    }

    console.log("all resumes", allResumes)

    console.log("Received message from job queue", message);
    const jobData = JSON.parse(message);
    console.log("Parsed data:", jobData);

    for (const resume of allResumes) {
        const userId = resume.userId
        const cachedUserData = await redisClient.get(`current-user:${userId}`);
        if (!cachedUserData) continue;
        const user = JSON.parse(cachedUserData);

        const jobsHash = await redisClient.hgetall(`topJobs:${userId}`)
        let topJobs = jobsHash ? Object.values(jobsHash).map(str => JSON.parse(str)) : []

        //check ig the job is already present
        const jobIndex = topJobs.findIndex(j => j.jobData._id === jobData._id)

        //get cosine similarity
        const matchPercentage = cosineSimilarity(jobData.jobEmbedding, resume.resumeEmbedding)

        // Add the new job if it's not already present
        if (jobIndex === -1) {

            // Less than 10 jobs, just add
            if (topJobs.length < 10) {
                topJobs.push({ jobData, matchPercentage });
            } else {
                // Sort ascending to get the lowest at index 0
                topJobs.sort((a, b) => a.matchPercentage - b.matchPercentage);
                if (matchPercentage > topJobs[0].matchPercentage) {
                    topJobs[0] = { jobData, matchPercentage };
                }
            }
        } else {
            //update percentage if job already present
            topJobs[jobIndex].matchPercentage = cosineSimilarity(jobData.jobEmbedding, resume.resumeEmbedding)
        }
        topJobs.sort((a, b) => b.matchPercentage - a.matchPercentage)
        topJobs = topJobs.slice(0, 10)

        console.log("topJobs", topJobs);

        // Store back in Redis
        await redisClient.del(`topJobs:${userId}`)
        for (const job of topJobs) {
            await redisClient.hset(`topJobs:${userId}`, job.jobData._id, JSON.stringify(job));
        }
        await redisClient.expire(`topJobs:${userId}`, 86400);

        // send email
        // const html = createEmailHtmlTemplate(topJobs)
        // await sendMail("New Job Available", html, user.email)
    }


});

//function to send email
const sendMail = async (subject, html, email) => {
    console.log("sending email to ", email);

    await resend.emails.send({
        from: 'Acme <onboarding@resend.dev>',
        to: email,
        subject: subject,
        html: html,
    }).then((res) => {
        console.log("email sent successfully to", email);
    }).catch((err) => {
        console.log("error in sending email", err);
    });
}

//schedule sending email every moring  8 AM
cron.schedule('0 8 * * *', async () => {
    const allResumes = await Resume.find({})
    console.log("Cron job triggered at", new Date().toISOString());
    if (!allResumes || allResumes.length === 0) {
        console.log("No resumes to process in cron job");
        return;
    }
    // if (!allResumes || allResumes.length === 0) return;

    for (const resume of allResumes) {
        const userId = resume.userId
        const userData = await redisClient.get(`current-user:${userId}`);
        if (!userData) continue;
        const user = JSON.parse(userData);

        //get top jobs for a user from redis
        const topJobs = await redisClient.hgetall(`topJobs:${userId}`)
        if (!topJobs || Object.keys(topJobs).length === 0) continue;

        //parse the jobsdata
        const toJobsForUser = Object.values(topJobs).map(job => JSON.parse(job));

        //create html template for top jobs to send mail
        const htmlTemplate = createEmailHtmlTemplate(toJobsForUser)

        //finally send the email to the user 
        try {
            await sendMail("Top new jobs where your resume matches", htmlTemplate, user.email)
        } catch (error) {
            console.log("error in sending email", error);
        } finally {
            await redisClient.del(`topJobs:${userId}`)
        }

    }
}, {
    scheduled: true,
    timezone: "Asia/Kolkata"
})


