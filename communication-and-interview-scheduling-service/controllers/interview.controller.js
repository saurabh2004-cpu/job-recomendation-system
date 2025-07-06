const interViewModel = require("../models/interview.model");
const ApiError = require("../utils/apiError");
const asyncHandler = require("../utils/asyncHandler");
const ApiResponse = require("../utils/apiResponse");
const redisClient = require("../redis/redisClient");
const { publishToQueue } = require("../rabbitMQ/rabbit");
const io = require("../soket/soket.io");



//schedule a interview = 
//recruiter functions ⬇️
const scheduleInterview = asyncHandler(async (req, res) => {
    const { scheduledDate, scheduledTime } = req.body;
    const recruiterId = req.user._id;
    const applicantId = req.query.applicantId
    const jobId = req.query.jobId

    if (!applicantId || !jobId || !recruiterId || !scheduledDate || !scheduledTime) {
        throw new ApiError(400, "All fields are required");
    }

    const createdInterview = await interViewModel.create({
        applicantId,
        jobId,
        recruiterId,
        scheduledDate,
        scheduledTime,
        status: "pending"
    });

    if (!createdInterview) {
        throw new ApiError(500, "Failed to schedule interview");
    }

    const interview = await interViewModel.findById(createdInterview._id).populate("jobId recruiterId applicantId");

    // console.log("inter",interview)

    //store interview in redis
    await redisClient.setex(`interview:${interview._id}`, 3600, JSON.stringify(interview));

    //publish to queue for email
    publishToQueue("job-status-update", JSON.stringify(interview));

    res.status(201).json(new ApiResponse(201, interview, "interview scheduled successfully"));
});

const createCommunicationRoom = asyncHandler(async (req, res) => {
    const roomId = req.query.roomId;
    try {

        //make a connnection
        io.on("connection", (socket) => {
            const userIdTosocketMapping = new Map()
            const socketToUserIdMapping = new Map()

            socket.on('chat', (data) => {
                const { userId } = data

                userIdTosocketMapping.set(userId, socket.id)
                socketToUserIdMapping.set(socket.id, userId)

                console.log("New Connection")
                console.log(`New user joined - ${senderId} }`)

                socket.join(roomId)
                socket.emit('joined-room', roomId)   //send member room id that he is joined the room

                socket.broadcast.to(roomId).emit('user-joined', { senderId })   //send meassage to all members of the room
                console.log("joined room", roomId)

                socket.on('message', data => {
                    const { senderId, content, receiverId, roomId } = data
                    const socketId = userIdTosocketMapping.get(receiverId)
                    socket.to(socketId).emit('message', data)
                })

            })
        })

    } catch (error) {
        throw new ApiError(500, "Internal server error: " + error.message);
    }
})

//recruiter and cadidates functions ⬇️
const getAllInterviews = asyncHandler(async (req, res) => {
    console.log("get allinterviews triggered")
    const userId = req.user._id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;


    try {
        const interviews = await interViewModel.find(
            {
                $or: [
                    { recruiterId: userId },
                ]
            })
            .populate("applicantId jobId recruiterId")
            .limit(limit)
            .skip(skip);

        const total = await interViewModel.countDocuments({
            $or: [
                { recruiterId: userId },
                // { applicantId: userId }
            ]
        });

        // console.log("interviews", interviews);

        if (!interviews || interviews.length === 0) {
            return res.json(new ApiResponse(400, null, "No interviews found"));
        }

        await redisClient.setex(`users-interviews:${userId}`, 3600, JSON.stringify(interviews));

        res.json(new ApiResponse(200, { interviews, total }, "All interviews fetched successfully"));
    } catch (error) {
        throw new ApiError(500, "Internal server error: " + error.message);
    }
})

const getApplicantsAllInterviews = asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;


    try {
        const interviews = await interViewModel.find(
            {
                $or: [
                    { applicantId: userId }
                ]
            })
            .populate("applicantId jobId recruiterId")
            .limit(limit)
            .skip(skip);

        const total = await interViewModel.countDocuments({
            $or: [
                { recruiterId: userId },
                { applicantId: userId }
            ]
        });

        // console.log("interviews", interviews);

        if (!interviews || interviews.length === 0) {
            return res.json(new ApiResponse(400, null, "No interviews found"));
        }

        await redisClient.setex(`users-interviews:${userId}`, 3600, JSON.stringify(interviews));

        res.json(new ApiResponse(200, { interviews, total }, "All interviews fetched successfully"));
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
    const status = req.query.status


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

        res.json(new ApiResponse(200, interviews, `All jobs with status ${status} interviews deleted successfully`));
    } catch (error) {
        throw new ApiError(500, "Internal server error: " + error.message);
    }
})

const deleteSingleInterview = asyncHandler(async (req, res) => {
    const interviewId = req.query.interviewId

    try {
        const interview = await interViewModel.findOneAndDelete({ _id: interviewId });

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
        const interview = await interViewModel.find({ status: status }).populate("applicantId jobId recruiterId");

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
    const interviewId = req.query.interviewId
    const status = req.query.status

    console.log("status", status)

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
        await redisClient.del(`interviewsByStatus:${interview.status}`);
        await redisClient.del(`users-interviews:${interview.applicantId || interview.recruiterId}`);

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

//remaining - add route 
const acceptOrRejectScheduledInterview = asyncHandler(async (req, res) => {
    const { recruiterId, jobId, applicantId } = req.query
    const { answer } = req.body

    try {
        const interview = await interViewModel.findOne({ jobId: jobId }).populate('recruiterId')

        if (!interview) {
            throw new ApiError(400, "Interview with the joibId not found")
        }

        interViewModel.applicantStatus = answer
        await interViewModel.save()


        //publish to queue
        await publishToQueue('scheduled-interview-answer', JSON.stringify(
            {
                interviewId: interview._id,
                recruiterEmailId: interview.recruiterId.email,
                answer: answer
            }
        ))

        res.json(
            new ApiResponse(200, interview, `Interview ${answer} `)
        )


    } catch (error) {

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
    createCommunicationRoom,
    getApplicantsAllInterviews,
    acceptOrRejectScheduledInterview
}