//these handlers for the recruters who are seeking for an good employees

const ApiError = require('../utils/apiError');
const ApiResponse = require('../utils/apiResponse');
const asyncHandler = require('../utils/asyncHandler');
const redisClient = require('../redis/redisClient');
const Job = require('../models/jobs.model');
const { default: mongoose } = require('mongoose');
const { publishToQueue } = require('../rabbitMQ/rabbit.js');
const { getStructeredData, getEmbeddings } = require('../gemini/gemini.js');

//completed
const createJob = asyncHandler(async (req, res) => {
    console.log("creating job");

    const { title, jobField, company, location, description, salary, jobType, experience, education, requiredSkills, jobExpiryDate } = req.body;

    console.log("req.body", req.body);
    if ([title, jobField, company, location, description, salary, jobType, experience, education, requiredSkills].some((field) => field === "")) {
        throw new ApiError(400, 'All fields are required');
    }

    //prompt for the cohere AI model to extract the job details
    const aiFormatedJobDetails = await getStructeredData(req.body)

    if (!aiFormatedJobDetails) {
        throw new ApiError(500, 'Failed to extract structured information from the job description');
    }

    console.log("response from gemini", aiFormatedJobDetails.formatedAnswer);

    console.log("getting text embeddings... using lanchain model");
    const textEmbeddings = await getEmbeddings(aiFormatedJobDetails.formatedAnswer)

    if (!textEmbeddings) {
        throw new ApiError(500, 'Failed to generate text embeddings');
    }

    console.log("embeddings created ", textEmbeddings[0]);
    const skills = requiredSkills.split(/[\s,]+/).map((skill) => skill.trim());

    try {
        const newJob = await Job.create({
            recruiterId: req.user._id,
            title,
            jobField,
            company,
            location,
            description,
            salary,
            jobType,
            experience,
            education,
            jobEmbedding: textEmbeddings,
            requiredSkills: skills,
            jobExpiryDate: jobExpiryDate ?? new Date('9999-12-31T23:59:59Z'),
        })

        if (!newJob) {
            throw new ApiErrorpiError(500, 'Failed to create job');
        }

        console.log("new job created",);

        //1.store the job in redis with an expiration time of 1 hour 
        await redisClient.set(`job:${newJob._id}`, JSON.stringify(newJob))
        redisClient.expire(`job:${newJob._id}`, 3600)

        //2.add updated job to cached jobsBykeyword hash
        const cachedKeywords = await redisClient.smembers(`jobKeywords:${newJob._id}`);
        for (const keyword of cachedKeywords) {
            await redisClient.hset(`jobsByKeyword:${keyword}`, newJob._id, JSON.stringify(newJob));
        }

        //3.add updated job to recruiter-all-jobs hash --not working
        await redisClient.hset(`recruiter-all-jobs:${newJob.recruiterId}`, newJob._id, JSON.stringify(newJob));

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
    console.log("getJobById")
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

//completed
const updateJobDetails = asyncHandler(async (req, res) => {
    console.log("updateJobDetails")
    const { jobField, company, location, description, salary, jobType, experience, education, jobExpiryDate, jobStatus } = req.body;
    const jobId = req.query.jobId


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

        const aiFormatedJobDetails = await getStructeredData(updatedJob)

        if (!aiFormatedJobDetails) {
            throw new ApiError(500, 'Failed to extract structured information from the job description');
        }

        console.log("ai formated job details");

        const textEmbeddings = await getEmbeddings(aiFormatedJobDetails.formatedAnswer)

        if (!textEmbeddings) {
            throw new ApiError(500, 'Failed to generate text embeddings');
        }

        console.log("new embeddings", textEmbeddings[0]);

        updatedJob.jobEmbedding = textEmbeddings
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

//completed
const getRecrutersAllJobs = asyncHandler(async (req, res) => {
    console.log("getRecrutersAllJobs")
    const recruiterId = req.user._id || req.query.recruiterId;

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
                    jobs: cachedJobs,
                    page,
                    limit
                }, "jobs fetched sucessfully"))
            }
        }

        //  Get jobs for this recruiter with pagination
        const jobs = await Job.find({ recruiterId })
            .select('-__v -updatedAt -jobEmbedding')
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

//COMPLETED
const deleteJob = asyncHandler(async (req, res) => {
    console.log("deleteJob")
    const jobId = req.query.jobId
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
    console.log("deleteManyJobs")
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

//completed
const toggleJobStatus = asyncHandler(async (req, res) => {
    console.log("toggleJobStatus")
    const jobId = req.query.jobId
    const status = req.query.status

    try {
        const job = await Job.findById(jobId);

        if (!job) {
            return res.json(new ApiResponse(404, null, "No job found with this ID"));
        }

        job.jobStatus = status; // Toggle the job status
        await job.save();

        //update in redis
        await redisClient.setex(`job:${jobId}`, 3600, JSON.stringify(job));

        //update in recruiter-all-jobs hash
        await redisClient.hset(`recruiter-all-jobs:${job.recruiterId}`, jobId, JSON.stringify(job));

        //update in jobsByKeyword hash
        const cachedKeywords = await redisClient.smembers(`jobKeywords:${jobId}`);
        for (const keyword of cachedKeywords) {
            await redisClient.hset(`jobsByKeyword:${keyword}`, jobId, JSON.stringify(updatedJob));
        }

        await redisClient.expire(`recruiter-all-jobs:${job.recruiterId}`, 3600);

        res.json(new ApiResponse(200, job, "Job status updated successfully"));
    } catch (error) {
        throw new ApiError(500, "Internal server error: " + error.message);
    }
})

//completed
const getAllAplicantsForJob = asyncHandler(async (req, res) => {
    console.log("getAllAplicantsForJob")
    const jobId = req.query.jobId
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
            return res.json(new ApiResponse(400, null, "No job found with this ID"));
        }

        const applicants = job.jobApplicants

        if (!applicants || applicants.length === 0) {
            return res.json(new ApiResponse(400, null, "No applicants found with this ID"));
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
    console.log("getApplicantsProfile")
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

//completed
const rejectApplicant = asyncHandler(async (req, res) => {
    console.log("rejectApplicant")
    const applicantId = req.query.applicantId
    const jobId = req.query.jobId

    console.log("rejecting applicant");

    if (!applicantId || !jobId || mongoose.Types.ObjectId.isValid(applicantId) === false || mongoose.Types.ObjectId.isValid(jobId) === false) {
        throw new ApiError(400, "Invalid applicant ID")
    }

    try {
        const job = await Job.findById(jobId).select("-jobEmbedding")


        if (!job) {
            return res.json(new ApiResponse(400, null, "No job found with this ID"));
        }

        const applicants = job.jobApplicants

        if (!applicants || applicants.length === 0) {
            return res.json(new ApiResponse(400, null, "No applicants found for this job"));
        } else {
            job.jobApplicants = applicants.filter(applicant => applicant.toString() !== applicantId)
            await job.save()

            //update the reids
            await redisClient.setex(`job:${jobId}`, 3600, JSON.stringify(job))

            //update in jobsByKeyword hash
            const cachedKeywords = await redisClient.smembers(`jobKeywords:${jobId}`);
            for (const keyword of cachedKeywords) {
                await redisClient.hset(`jobsByKeyword:${keyword}`, jobId, JSON.stringify(job));
            }

            //add to the job update queue - remaining
            // publishToQueue("job-status-update", JSON.stringify(job));

            await redisClient.expire(`recruiter-all-jobs:${job.recruiterId}`, 3600);

            res.json(new ApiResponse(200, job, "Applicant rejected sucessfully"))
        }
    } catch (error) {
        throw new ApiError(500, "internal server error: " + error.message)
    }


})

const getAllJobApplicantions = asyncHandler(async (req, res) => {
    console.log("getAllJobApplicantions")
    const userId = req.user._id

    try {
        const jobs = await Job.find({ jobApplicants: { $in: [userId] } }).select("-jobEmbedding").populate("recruiterId")

        if (!jobs || jobs.length === 0) {
            return res.json(new ApiResponse(400, null, "No job found with this userId"));
        }

        await redisClient.setex(`my-applications:${userId}`, 3600, JSON.stringify(jobs))

        res.json(new ApiResponse(200, jobs, "Job applicants fetched sucessfully"))
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
    getApplicantsProfile,
    rejectApplicant,
    getAllJobApplicantions
}