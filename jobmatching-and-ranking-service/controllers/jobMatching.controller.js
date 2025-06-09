//these handlers are for employees who seeking for job


const redisClient = require("../redis/redisClient");
const ApiResponse = require("../utils/apiResponse");
const asyncHandler = require("../utils/asyncHandler");
const { cosineSimilarity } = require("../utils/helper");
const Job = require('../models/jobs.model');
const ApiError = require("../utils/apiError");
const { default: mongoose } = require("mongoose");


const findJobBasedOnResume = asyncHandler(async (req, res) => {
    const userId = req.user._id

    // Check top job matches available in cache
    const cachedData = await redisClient.hgetall(`topJobMatches:${req.user}`);

    console.log("cachedData", cachedData);

    if (cachedData != {} && cachedData.length > 0) {
        res.json(new ApiResponse(200, JSON.parse(cachedData), "top mached jobs fetched sucessfully"))
    }

    const cachedResumeData = await redisClient.get(`resume:${userId}`)

    let resumeEmbedding = cachedResumeData ? JSON.parse(cachedResumeData)?.resumeEmbedding : req.body?.resumeEmbedding

    if (!resumeEmbedding) {
        throw new ApiError(400, "Resume embedding is required");
    }

    try {
        const topMatchingJobs = await Job.aggregate([
            {
                $vectorSearch: {
                    index: "vector_index",
                    path: "jobEmbedding",
                    queryVector: resumeEmbedding,
                    numCandidates: 100,
                    limit: 10
                }
            },
            {
                $project: {
                    jobEmbedding: 0, // Exclude embeddings
                    __v: 0,          // Exclude Mongoose version key
                    score: { $meta: "vectorSearchScore" },
                }
            }
        ]);

        if (!topMatchingJobs || topMatchingJobs.length === 0) {
            return res.status(404).json({ message: "No jobs found" });
        }

        // Sort by similarity score, descending
        const scoredJobs = topMatchingJobs.map(job => ({
            ...job,
            matchPercentage: Math.round((job.score ?? 0) * 100)
        })).sort((a, b) => b.matchPercentage - a.matchPercentage);

        console.log("scoredJobs", scoredJobs);

        // Store top matches in Redis
        scoredJobs.forEach(async (job) => {
            await redisClient.hset(`topJobMatches:${req.user._id}`, job._id, JSON.stringify(job));
            await redisClient.sadd(`topJobMatchesUsers:${job._id}`, req.user._id);

            await redisClient.expire(`topJobMatches:${req.user._id}`, 3600);
            await redisClient.expire(`topJobMatchesUsers:${job._id}`, 3600);

        })
        res.json(new ApiResponse(200, scoredJobs, "Jobs ranked by resume matchfetched sucessfully"));

    } catch (error) {
        throw new Error("Error finding jobs based on resume: " + error.message);
    }


});

const findJobBykeyword = asyncHandler(async (req, res) => {

    const keyword = req.query.keyword || req.body.keyword

    if (!keyword) {
        throw new ApiError(400, "keyword is required")
    }

    const cachedHash = await redisClient.hgetall(`jobsByKeyword:${keyword}`);

    const parsedJobs = Object.entries(cachedHash).map(([id, jobStr]) => ({
        _id: id,
        ...JSON.parse(jobStr)
    }));

    if (parsedJobs && parsedJobs.length > 0) {
        return res.json(new ApiResponse(200, parsedJobs, "searchedJobs jobs fetched sucesssfully"))
    }

    try {

        let searchedJobs = await Job.find(
            {
                $text: {
                    $search: keyword
                }
            }
        ).collation({ locale: 'en', strength: 2 });

        if (!searchedJobs || searchedJobs.length === 0) {
            searchedJobs = await Job.find(
                {
                    $or: [
                        { jobField: { $regex: keyword, $options: 'i' } },
                        { description: { $regex: keyword, $options: 'i' } },
                        { company: { $regex: keyword, $options: 'i' } },
                        { jobType: { $regex: keyword, $options: 'i' } },
                        { location: { $regex: keyword, $options: 'i' } },
                        { experience: { $regex: keyword, $options: 'i' } },
                        { education: { $regex: keyword, $options: 'i' } },
                        { requiredSkills: { $regex: keyword, $options: 'i' } }
                    ]
                }
            );
        }

        if (!searchedJobs || searchedJobs.length === 0) {
            return res.status(404).json({ message: "No jobs found" });
        }

        for (const job of searchedJobs) {
            await redisClient.hset(`jobsByKeyword:${keyword}`, job._id.toString(), JSON.stringify(job));

            await redisClient.sadd(`jobKeywords:${job._id}`, keyword); // Track keyword for job
            await redisClient.expire(`jobKeywords:${job._id}`, 3600); // Optional expiry
        }

        await redisClient.expire(`jobsByKeyword:${keyword}`, 3600); // Optional expiry

        res.json(new ApiResponse(200, searchedJobs, "searchedJobs jobs fetched sucesssfully"))
    } catch (error) {
        throw new ApiError(500, error.message)
    }
})


const getAllJobs = asyncHandler(async (req, res) => {
    try {
        const options = {
            page: parseInt(req.query.page) || 1,
            limit: parseInt(req.query.limit) || 10,
            sort: { createdAt: -1 }, // Sort by createdAt in descending order
            collation: { locale: 'en', strength: 2 } // Case-insensitive sorting
        };

        const paginatedJobs = await Job.find()
            .limit(options.limit)
            .skip((options.page - 1) * options.limit)
            .sort(options.sort)
            .collation(options.collation);

        if (!paginatedJobs || paginatedJobs.length === 0) {
            return res.status(404).json({ message: "No jobs found" });
        }


        res.json(new ApiResponse(200, paginatedJobs, "all jobs fetched sucesssfully"))
    } catch (error) {
        throw new ApiError(500, error.message)
    }
})

const applyForJob = asyncHandler(async (req, res) => {
    const jobId = req.params.jobId || req.query.jobId

    if (!jobId || mongoose.Types.ObjectId.isValid(jobId) === false) {
        throw new ApiError(400, "Invalid job ID")
    }

    try {
        const job = await Job.findById(jobId)

        if (!job) {
            throw new ApiError(400, "No Job found !")
        }

        job.jobApplicants.push(req.user._id)
        await job.save()

        res.json(new ApiResponse(200, job, "Job applied sucessfully"))
    } catch (error) {
        throw new ApiError(500, "internal server error: " + error.message)
    }
})

module.exports = { findJobBasedOnResume, findJobBykeyword, getAllJobs, applyForJob };