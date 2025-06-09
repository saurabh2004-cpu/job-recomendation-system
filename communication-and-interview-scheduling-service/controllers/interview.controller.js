const interViewModel = require("../models/interview.model");
const ApiError = require("../utils/apiError");
const asyncHandler = require("../utils/asyncHandler");
const ApiResponse = require("../utils/apiResponse");
const redisClient = require("../redis/redisClient");
const { publishToQueue } = require("../rabbitMQ/rabbit");
const joinRoom = require("../soket/soket.io");


//schedule a interview = 
//recruiter functions ⬇️
const scheduleInterview = asyncHandler(async (req, res) => {
    const { candidateId, jobId, scheduledDate, scheduledTime } = req.body;
    const recruiterId = req.user._id;

    if (!candidateId || !jobId || !recruiterId || !scheduledDate || !scheduledTime) {
        throw new ApiError(400, "All fields are required");
    }

    const interview = await interViewModel.create({
        candidateId,
        jobId,
        recruiterId,
        scheduledDate,
        scheduledTime,
        status: "pending"
    });

    if (!interview) {
        throw new ApiError(500, "Failed to schedule interview");
    }

    //store interview in redis
    await redisClient.setex(`interview:${interview._id}`, 3600, JSON.stringify(interview));

    //publish to queue for email
    publishToQueue("interview_Queue", JSON.stringify(interview));

    res.status(201).json(new ApiResponse(201, interview, "interview scheduled successfully"));
});

const createCommunicationRoom = asyncHandler(async (req, res) => {
    const roomId = req.query.roomId || req.params.roomId;
    try {
        await joinRoom();

        res.json(new ApiResponse(200, null, ` room with id:${roomId} created successfully ,Share roomId with candidate`));
    } catch (error) {
        throw new ApiError(500, "Internal server error: " + error.message);
    }
})

//recruiter and cadidates functions ⬇️
const getAllInterviews = asyncHandler(async (req, res) => {

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    try {
        const interviews = await interViewModel.find().populate("candidateId jobId recruiterId").limit(limit).skip(skip);

        if (!interviews || interviews.length === 0) {
            throw new ApiError(404, "No interviews found");
        }

        res.json(new ApiResponse(200, interviews, "All interviews fetched successfully"));
    } catch (error) {
        throw new ApiError(500, "Internal server error: " + error.message);
    }
})

const getSingleInterview = asyncHandler(async (req, res) => {
    const interviewId = req.query.interviewId || req.params.interviewId;

    const cachedData = await redisClient.get(`interview:${interviewId}`);

    try {
        const interview = cachedData ? JSON.parse(cachedData) : await interViewModel.findOne({ _id: interviewId }).populate("candidateId jobId recruiterId");

        if (!interview) {
            throw new ApiError(404, "Interview not found");
        }

        await redisClient.setex(`interview:${interview._id}`, 3600, JSON.stringify(interview));

        res.json(new ApiResponse(200, interview, "Single interview fetched successfully"));
    } catch (error) {
        throw new ApiError(500, "Internal server error: " + error.message);
    }

})

const deleteInterviewByStatus = asyncHandler(async (req, res) => {
    const status = req.query.status || req.params.status;
    try {
        const interviews = await interViewModel.find({ status: status });

        const deletedInterviews = await interViewModel.deleteMany({ status: status });

        if (deletedInterviews.deletedCount === 0) {
            throw new ApiError(404, "No cancelled interviews found");
        }

        interviews.map(async (interview) => {
            await redisClient.del(`interview:${interview._id}`);
        })


        //delete from interviewsByKeyword hash in redis
        const keys = await redisClient.keys('interviewsByKeyword:*');
        if (keys.length > 0) {
            await redisClient.del(keys);
        }

        //delete from interviewsByStatus string
        await redisClient.del(`interviewsByStatus:${status}`);

        res.json(new ApiResponse(200, null, `All jobs with status ${status} interviews deleted successfully`));
    } catch (error) {
        throw new ApiError(500, "Internal server error: " + error.message);
    }
})

const deleteSingleInterview = asyncHandler(async (req, res) => {
    const interviewId = req.params.id || req.query.id;

    try {
        const interview = await interViewModel.findByIdAndDelete(interviewId);

        if (!interview) throw new ApiError(404, "Interview not found");


        //delete from redis
        await redisClient.del(`interview:${interviewId}`);

        //delete from interviewsByKeyword hash in redis
        const keys = await redisClient.keys('interviewsByKeyword:*');
        if (keys.length > 0) {
            await redisClient.del(keys);
        }

        //delete from interviewsByStatus string
        await redisClient.del(`interviewsByStatus:${interview.status}`);

        res.json(new ApiResponse(200, null, "Interview deleted successfully"));
    } catch (error) {
        throw new ApiError(500, "Internal server error: " + error.message);
    }
});

const getInterViewByStatus = asyncHandler(async (req, res) => {
    const status = req.query.status || req.params.status;

    const cachedData = await redisClient.get(`interviewsByStatus:${status}`);

    if (cachedData) {
        return res.json(new ApiResponse(200, JSON.parse(cachedData), `All interviews with status ${status} fetched successfully`));
    }

    try {
        const interview = await interViewModel.find({ status: status }).populate("candidateId jobId recruiterId");

        if (!interview) {
            res.json(new ApiResponse(404, null, "No interviews found with this status"));
        }

        //store in redis
        await redisClient.setex(`interviewsByStatus:${status}`, 3600, JSON.stringify(interview));

        res.json(new ApiResponse(200, interview, `All interviews with status ${status} fetched successfully`));

    } catch (error) {
        throw new ApiError(500, "Internal server error: " + error.message);
    }
})

// candidate functions⬇️
const updateInterviewStatus = asyncHandler(async (req, res) => {
    const interviewId = req.query.interviewId || req.params.interviewId;
    const status = req.query.status || req.params.status;

    if (!interviewId || !status) {
        throw new ApiError(400, "All fields are required");
    }

    try {
        const interview = await interViewModel.findOne({ _id: interviewId });

        if (!interview) {
            throw new ApiError(404, "Interview not found");
        }

        interview.status = status;
        await interview.save();

        await redisClient.setex(`interview:${interview._id}`, 3600, JSON.stringify(interview));

        res.json(new ApiResponse(200, interview, "Interview status updated successfully"));
    } catch (error) {
        throw new ApiError(500, "Internal server error: " + error.message);
    }
})

const searchInterviewsByKeyword = asyncHandler(async (req, res) => {
    const keyword = req.query.keyword || req.params.keyword;

    if (!keyword) {
        throw new ApiError(400, "keyword is required");
    }

    const cachedHash = await redisClient.hgetall(`interviewsByKeyword:${keyword}`);

    if (cachedHash && Object.keys(cachedHash).length > 0) {
        return res.json(new ApiResponse(200, Object.values(cachedHash), "searchedInterviews interviews fetched sucesssfully"))
    }

    const parsedInterviews = Object.entries(cachedHash).map(([id, interviewStr]) => ({
        _id: id,
        ...JSON.parse(interviewStr)
    }));

    if (parsedInterviews && parsedInterviews.length > 0) {
        console.log("cached data", parsedInterviews);
        return res.json(new ApiResponse(200, parsedInterviews, "searchedInterviews interviews fetched sucesssfully"))
    }

    try {
        const interviews = await interViewModel.aggregate([
            {
                $lookup: {
                    from: "users",
                    localField: "candidateId",
                    foreignField: "_id",
                    as: "candidate"
                }
            },

            {
                $lookup: {
                    from: "jobs",
                    localField: "jobId",
                    foreignField: "_id",
                    as: "job"
                }
            },

            // Unwind arrays for easier matching
            { $unwind: "$candidate" },
            { $unwind: "$job" },

            // Match by keyword in candidate name, job title, or job description
            {
                $match: {
                    $or: [
                        { "candidate.username": { $regex: keyword, $options: "i" } },
                        { "candidate.fullName": { $regex: keyword, $options: "i" } },
                        { "job.jobField": { $regex: keyword, $options: "i" } },
                        { "job.description": { $regex: keyword, $options: "i" } },
                        { "job.company": { $regex: keyword, $options: "i" } },
                        { "job.location": { $regex: keyword, $options: "i" } },
                        { "job.jobType": { $regex: keyword, $options: "i" } },
                        { "job.requiredSkills": { $regex: keyword, $options: "i" } },
                        { "job.jobStatus": { $regex: keyword, $options: "i" } }
                    ]
                }
            },
            {
                $project: {
                    "job.jobEmbedding": 0, // Exclude embeddings
                }
            }
        ]);

        console.log("interviews", interviews);

        if (!interviews || interviews.length === 0) {
            throw new ApiError(404, "No interviews found");
        }

        await Promise.all(interviews.map(interview =>
            redisClient.hset(`interviewsByKeyword:${keyword}`, interview._id, JSON.stringify(interview))
        ));

        await redisClient.expire(`interviewsByKeyword:${keyword}`, 3600);

        res.json(new ApiResponse(200, interviews, "searchedInterviews interviews fetched sucesssfully"));
    } catch (error) {
        throw new ApiError(500, "Internal server error: " + error.message);
    }



})






module.exports = {
    scheduleInterview,
    getAllInterviews,
    getSingleInterview,
    updateInterviewStatus,
    deleteInterviewByStatus,
    deleteSingleInterview,
    getInterViewByStatus,
    searchInterviewsByKeyword,
    createCommunicationRoom
}