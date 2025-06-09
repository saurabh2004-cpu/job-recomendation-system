//these handlers for the recruters who are seeking for an good employees

const ApiError = require('../utils/apiError');
const ApiResponse = require('../utils/apiResponse');
const asyncHandler = require('../utils/asyncHandler');
const { getEmbedding, extractStructuredInformation, testQueue } = require('../utils/helper');
const redisClient = require('../redis/redisClient');
const Job = require('../models/jobs.model');
const { default: mongoose } = require('mongoose');
const { publishToQueue } = require('../rabbitMQ/rabbit.js');
const { getStructeredData, getEmbeddings } = require('../gemini/gemini.js');


const createJob = asyncHandler(async (req, res) => {
    console.log("creating job");

    // testQueue();
    // return 'completed test'

    const { jobField, company, location, description, salary, jobType, experience, education, requiredSkills, jobExpiryDate } = req.body;

    if ([jobField, company, location, description, salary, jobType, experience, education, requiredSkills].some((field) => field === "")) {
        throw new ApiError(400, 'All fields are required');
    }

    //prompt for the cohere AI model to extract the job details
    const aiFormatedJobDetails = await getStructeredData(req.body)

    if (!aiFormatedJobDetails) {
        throw new ApiError(500, 'Failed to extract structured information from the job description');
    }

    console.log("response from gemini",aiFormatedJobDetails.formatedAnswer);

    console.log("getting text embeddings... using lanchain model");
    const textEmbeddings = await getEmbeddings(aiFormatedJobDetails.formatedAnswer)

    if (!textEmbeddings) {
        throw new ApiError(500, 'Failed to generate text embeddings');
    }

    console.log("embeddings created ", textEmbeddings);

    try {
        const newJob = await Job.create({
            recruiterId: req.user._id,
            jobField,
            company,
            location,
            description,
            salary,
            jobType,
            experience,
            education,
            jobEmbedding: textEmbeddings,
            requiredSkills,
            jobExpiryDate: jobExpiryDate ?? new Date('9999-12-31T23:59:59Z'),
        })

        if (!newJob) {
            throw new ApiErrorpiError(500, 'Failed to create job');
        }

        console.log("new job created",);

        //store the job in redis with an expiration time of 1 hour 
        await redisClient.set(`job:${newJob._id}`, JSON.stringify(newJob))
        redisClient.expire(`job:${newJob._id}`, 3600)

        //publish the job to the queue

        publishToQueue("job_Queue", JSON.stringify(newJob))

        console.log("job published to the queue");
        res
            .status(201)
            .json(new ApiResponse(200, newJob, "job created sucessfully"))


    } catch (error) {
        throw new ApiError(500, error.message || "internal server error")
    }
})

const getJobById = asyncHandler(async (req, res) => {
    const jobId = req.query.jobId || req.params.jobId

    if (!jobId || mongoose.Types.ObjectId.isValid(jobId) === false) {
        throw new ApiError(400, "Invalid job ID")
    }

    const cachedJob = await redisClient.get(`job:${jobId}`)

    if (cachedJob) {
        return res.json(new ApiResponse(200, JSON.parse(cachedJob), "Job fetched sucessfully from cache"))
    }

    try {

        const job = await Job.findById(new mongoose.Types.ObjectId(jobId))

        if (!job) {
            throw new ApiError(400, "No Job found !")
        }

        //Sets a key in Redis with an expiration time.
        await redisClient.setex(`job:${jobId}`, 3600, JSON.stringify(job))

        res.json(new ApiResponse(200, job, "Job fetched sucessfully"))
    } catch (error) {
        throw new ApiError(500, "internal server error: " + error.message)
    }
})

const updateJobDetails = asyncHandler(async (req, res) => {
    const { jobField, company, location, description, salary, jobType, experience, education, jobExpiryDate, jobStatus } = req.body;
    const jobId = req.params.jobId || req.query.jobId


    const fieldsToUpdate = [
        { jobField },
        { company },
        { location },
        { description },
        { salary },
        { jobType },
        { experience },
        { education },
        { jobExpiryDate },
        { jobStatus }
    ]
        .filter(field => Object.values(field)[0] !== undefined && Object.values(field)[0] !== null && Object.values(field)[0] !== "");

    if (fieldsToUpdate.length === 0) {
        throw new ApiError(400, 'At least one field is required to update');
    }

    console.log("fields to update", fieldsToUpdate);

    const updateData = fieldsToUpdate.reduce((acc, obj) => ({ ...acc, ...obj }), {});

    try {
        const updatedJob = await Job.findByIdAndUpdate(jobId,
            {
                $set: updateData,
            },
            { new: true }
        ).select('-__v -createdAt -updatedAt -jobEmbedding') // Exclude __v, createdAt, updatedAt, and jobEmbedding fields

        if (!updatedJob) {
            throw new ApiError(400, 'Failed to update job details');
        }

        const aiFormatedJobDetails = await extractStructuredInformation(updatedJob)

        if (!aiFormatedJobDetails) {
            throw new ApiError(500, 'Failed to extract structured information from the job description');
        }

        console.log("ai formated job details", aiFormatedJobDetails);

        const textEmbeddings = await getEmbedding(aiFormatedJobDetails)

        if (!textEmbeddings) {
            throw new ApiError(500, 'Failed to generate text embeddings');
        }

        console.log("new embeddings", textEmbeddings);

        updatedJob.jobEmbedding = textEmbeddings[0]
        await updatedJob.save()

        //1.add jobs to cached job
        await redisClient.setex(`job:${jobId}`, 3600, JSON.stringify(updatedJob)) // Cache the updated job

        //add updated job to cached jobsBykeyword hash
        const cachedKeywords = await redisClient.smembers(`jobKeywords:${jobId}`);
        for (const keyword of cachedKeywords) {
            await redisClient.hset(`jobsByKeyword:${keyword}`, jobId, JSON.stringify(updatedJob));
        }

        //3.add updated job to recruiter-all-jobs hash
        await redisClient.hset(`recruiter-all-jobs:${updatedJob.recruiterId}`, jobId, JSON.stringify(updatedJob));

        res.json(new ApiResponse(200, updatedJob, "job updated sucessfully"))

    } catch (error) {
        throw new ApiError(500, "internal server error :-" + error.message)
    }
})

//problem - not finding all jobs based on userid
const getRecrutersAllJobs = asyncHandler(async (req, res) => {
    const recruiterId = req.query.recruiterId;

    // Get pagination info from query 
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;


    try {
        // Check if jobs are cached in Redis
        const jobIds = await redisClient.smembers(`recruiter-all-jobs:${recruiterId}:${page}:${limit}`);

        let cachedJobs = [];
        if (jobIds && jobIds.length > 0) {
            for (const jobId of jobIds) {
                let jobData = await redisClient.hget(`recruiter-all-jobs:${recruiterId}`, JSON.parse(jobId));

                if (jobData) {
                    cachedJobs.push(JSON.parse(jobData));
                } else {
                    await redisClient.srem(`recruiter-all-jobs:${recruiterId}:${page}:${limit}`, JSON.parse(jobId))
                }
            }

            if (cachedJobs && cachedJobs.length > 0) {
                return res.json(new ApiResponse(200, {
                    cachedJobs,
                    page,
                    limit
                }, "jobs fetched sucessfully"))
            }
        }

        //  Get jobs for this recruiter with pagination
        const jobs = await Job.find({ recruiterId })
            .select('-__v -createdAt -updatedAt -jobEmbedding')
            .skip(skip)
            .limit(limit)

        const totalJobs = await Job.countDocuments({ recruiterId });

        //  Cache the jobs data in Redis with an expiration time of 1 hour
        for (const job of jobs) {
            await redisClient.hset(`recruiter-all-jobs:${recruiterId}`, job._id.toString(), JSON.stringify(job));

            await redisClient.sadd(`recruiter-all-jobs:${recruiterId}:${page}:${limit}`, JSON.stringify(job._id));
        }

        // Set expiration for the cached jobs
        redisClient.expire(`recruiter-all-jobs:${recruiterId}`, 3600);
        redisClient.expire(`recruiter-all-jobs:${recruiterId}:${page}:${limit}`, 3600);

        //send the response to the client
        res.json(new ApiResponse(200, {
            jobs,
            page,
            totalPages: Math.ceil(totalJobs / limit),
            totalJobs,
        }, "Jobs fetched successfully"));

    } catch (error) {
        throw new ApiError(500, "Internal server error :" + error.message);
    }
})

const deleteJob = asyncHandler(async (req, res) => {
    const jobId = req.params.jobId || req.query.jobId
    const recruiterId = req.user._id

    //delete from jobs cache string
    await redisClient.del(`job:${jobId}`) // Delete the cached job

    // delet from cachedByKeyword hash
    const cachedKeywords = await redisClient.smembers(`jobKeywords:${jobId}`);  //get alll keyword that match jobId
    for (const keyword of cachedKeywords) {
        await redisClient.hdel(`jobsByKeyword:${keyword}`, jobId); //delete job from hash based on jobId
    }

    //delete keyword from cache set for the job
    await redisClient.del(`jobKeywords${jobId}`)

    //delete from cachedRecrutersAllJobs
    await redisClient.hdel(`recruiter-all-jobs:${recruiterId}`, jobId)

    //delete from topJobMatches hash
    const topJobMatchesUsers = await redisClient.smembers(`topJobMatchesUsers:${jobId}`)
    for (const userId of topJobMatchesUsers) {
        await redisClient.hdel(`topJobMatches:${userId}`, jobId)
    }
    await redisClient.del(`topJobMatchesUsers:${jobId}`)


    try {
        const deletedJob = await Job.findOneAndDelete({ _id: jobId })

        if (!deletedJob) {
            return res.status(404).json(new ApiResponse(404, null, "No job found with this ID"));
        }

        res.json(new ApiResponse(200, deletedJob, "job deleted sucessfully"))
    } catch (error) {
        throw new ApiError(500, "internal server error: " + error.message)
    }
})

const deleteManyJobs = asyncHandler(async (req, res) => {
    const recruiterId = req.user._id;

    if (!recruiterId) {
        throw new ApiError(404, "Not authorized");
    }

    const jobIds = req.body.jobIds; // Array of job IDs to delete   

    if (!jobIds || jobIds.length === 0) {
        throw new ApiError(400, "No job IDs provided for deletion");
    }

    console.log("jobIds", jobIds);

    const deletedJobs = [];
    const notFoundJobs = [];

    for (const jobId of jobIds) {
        //1. delete from recruters all jobs
        await redisClient.hdel(`recruiter-all-jobs:${recruiterId}`, jobId);

        //2.delete from jobsByKeyword hash
        const jobKeywords = await redisClient.smembers(`jobKeywords:${jobId}`);

        for (const keyword of jobKeywords) {
            await redisClient.hdel(`jobsByKeyword:${keyword}`, jobId); //delete job from hash based on jobId
            await redisClient.srem(`jobKeywords:${jobId}`, keyword);  //delete keyword from jobKeywords set
        }

        //3.delete from job cache
        await redisClient.del(`job:${jobId}`); // Delete the cached job

        //4.delete from topJobMatches hash
        const topJobMatchesUsers = await redisClient.smembers(`topJobMatchesUsers:${jobId}`);
        for (const userId of topJobMatchesUsers) {
            await redisClient.hdel(`topJobMatches:${userId}`, jobId);
        }
        await redisClient.del(`topJobMatchesUsers:${jobId}`);

        //5. finally delete jobs from db
        try {
            const deletedJob = await Job.findByIdAndDelete(jobId);
            if (!deletedJob) {
                notFoundJobs.push(jobId);
            } else {
                deletedJobs.push(deletedJob);
            }
        } catch (error) {
            throw new ApiError(500, "Internal server error: " + error.message);
        }
    }

    res.json(new ApiResponse(200, { deletedJobs, notFoundJobs }, "Jobs deletion process completed"));
});

const toggleJobStatus = asyncHandler(async (req, res) => {
    const jobId = req.params.jobId || req.query.jobId

    try {
        const job = await Job.findById(jobId);

        if (!job) {
            return res.status(404).json(new ApiResponse(404, null, "No job found with this ID"));
        }

        job.jobStatus = !job.jobStatus; // Toggle the job status
        await job.save();

        res.json(new ApiResponse(200, job, "Job status updated successfully"));
    } catch (error) {
        throw new ApiError(500, "Internal server error: " + error.message);
    }
})

const getAllAplicantsForJob = asyncHandler(async (req, res) => {
    const jobId = req.params.jobId || req.query.jobId

    const cachedData = await redisClient.get(`job-applicants:${jobId}`);

    if (cachedData && !cachedData == {}) {
        res.json(new ApiResponse(200, JSON.parse(cachedData), "Job applicants fetched sucessfully from cache"))
    }

    if (!jobId || mongoose.Types.ObjectId.isValid(jobId) === false) {
        throw new ApiError(400, "Invalid job ID")
    }

    try {
        const job = await Job.findById(jobId).populate("jobApplicants")

        if (!job) {
            return res.status(404).json(new ApiResponse(404, null, "No job found with this ID"));
        }

        const applicants = job.jobApplicants

        if (!applicants || applicants.length === 0) {
            return res.status(404).json(new ApiResponse(404, null, "No applicants found with this ID"));
        } else {
            await redisClient.setex(`job-applicants:${jobId}`, 3600, JSON.stringify(applicants))

            res.json(new ApiResponse(200, applicants, "Job applicants fetched sucessfully"))
        }

    } catch (error) {
        throw new ApiError(500, "internal server error: " + error.message)
    }
})

//remaining task  = apply pagination for this ,when any candidat eapplies update the cache
const getApplicantsProfile = asyncHandler(async (req, res) => {
    const applicantsId = req.params.jobId || req.query.jobId

    if (!applicantsId || mongoose.Types.ObjectId.isValid(applicantsId) === false) {
        throw new ApiError(400, "Invalid job ID")
    }

    try {
        const applicant = await Job.aggregate([
            {
                $match: {
                    _id: applicantsId,
                },
            },
            {
                $lookup: {
                    from: "users",
                    localField: "jobApplicants",
                    foreignField: "_id",
                    as: "applicant",
                },
            },

        ])

        if (!applicant || applicant.length === 0) {
            res.json(new ApiResponse(204, null, "Applicant profile not found"))
        }

        res.json(new ApiResponse(200, applicant, "Applicants fetched sucessfully"))
    } catch (error) {
        throw new ApiError(500, "internal server error: " + error.message)
    }


})



module.exports = {
    createJob,
    getJobById,
    updateJobDetails,
    deleteJob,
    getRecrutersAllJobs,
    deleteManyJobs,
    toggleJobStatus,
    getAllAplicantsForJob,
    getApplicantsProfile
}