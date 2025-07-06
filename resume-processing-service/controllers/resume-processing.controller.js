const Resume = require('../models/resume.model');
const ApiError = require('../utils/apiError');
const ApiResponse = require('../utils/apiResponse');
const asyncHandler = require('../utils/asyncHandler');
const pdfParse = require('pdf-parse');
const redisClient = require('../redis/redisClient')
const { getEmbedding } = require('../utils/helper');
const { CohereClient } = require('cohere-ai');
const { uploadOnCloudinary } = require('../utils/cloudinary');
const fs = require('fs');
const path = require('path');
const { default: mongoose } = require('mongoose');
const { getPdfText, getStructeredData, getEmbeddings } = require('../gemini/gemini')

//completed
const uploadAndAnalyzeResume = asyncHandler(async (req, res, next) => {
    console.log("upload resume")
    if (!req.file) {
        return next(new ApiError(400, "Resume file is required"));
    }

    if (!req.user._id) {
        return new ApiError(400, "User ID not found")
    }

    const localFilePath = path.normalize(req.file.path);

    const resumeText = await getPdfText(localFilePath);  // Extracted text from the PDF

    if (!resumeText || resumeText == '') {
        return next(new ApiError(400, "Failed to extract text from resume"));
    }

    //upload resume pdf on cloudinary
    const cloudinaryResponse = await uploadOnCloudinary(localFilePath);

    if (!cloudinaryResponse) {
        throw new ApiError(500, "Failed to upload resume on cloudinary")
    }

    return res.json(new ApiResponse(200, cloudinaryResponse, "Resume uploaded successfully")) ////////////////

    const aiFormatedResumeText = await getStructeredData(resumeText);

    if (!aiFormatedResumeText) {
        return next(new ApiError(500, "Failed to extract structured information from the resume"));
    }

    console.log("resume analyzed successfully");

    console.log("getting text embeddings... using lanchain model");
    const textEmbeddings = await getEmbeddings(aiFormatedResumeText.formatedAnswer);

    if (!textEmbeddings) {
        return next(new ApiError(500, "Failed to generate text embeddings"));
    }

    console.log("embeddings created");
    console.log("embedding length", textEmbeddings.length);

    
    try {

        const newResume = await Resume.create({
            userId: req.user._id,
            resumeText: resumeText,
            resumeEmbedding: textEmbeddings,
            resumeScore: 0,
            resumeUrl: cloudinaryResponse?.url,
        });


        if (!newResume) {
            return next(new ApiError(400, "Failed to save resume"));
        }

        // console.log("newResume", newResume)

        await redisClient.setex(`resume:${req.user._id}`, 3600, JSON.stringify(newResume));

        res
            .status(200)
            .json(new ApiResponse(200,
                {
                    message: "Resume analyzed successfully",
                    resume: newResume
                },
                "success"
            ));

    } catch (error) {
        throw new ApiError(500, error?.message)

    }

});


const deleteResumeById = asyncHandler(async (req, res) => {
    const { resumeId } = req.query;

    console.log("resumeId", resumeId)

    if (!resumeId) {
        res.json(new ApiResponse(400, null, "Resume ID Not Found"))
    }

    await redisClient.del(`resume:${req?.user}`)

    try {
        const deletedResume = await Resume.findOneAndDelete(resumeId);

        if (!deletedResume) {
            res.json(new ApiResponse(400, "Error while deleting the resume"))
        }

        res.json(new ApiResponse(200, deletedResume, "Resume Deleted Sucessfully"))
    } catch (error) {
        throw new ApiError(500, error?.message)
    }
})

//completed
const getResumeById = asyncHandler(async (req, res) => {
    const { resumeId } = req.query || req.params;

    console.log("resumeId", resumeId)

    if (!resumeId && !req?.user) {
        res.json(new ApiResponse(400, null, "Resume ID Not Found"))
    }


    const cachedResume = await redisClient.get(`resume:${req.user._id}`)

    if (!cachedResume && cachedResume !== null) {
        res.json(new ApiResponse(200, JSON.parse(cachedResume), "Resume Fetched Sucessfully"))
        return
    }

    try {
        const resume = await Resume.findOne({ $or: [{ _id: resumeId }, { userId: req?.user._id }] });
        console.log("resume", resume)
        if (!resume) {
            throw new ApiError(400, "No Resume found !")
        }

        await redisClient.setex(`resume:${req?.user._id}`, 3600, JSON.stringify(resume))

        res.json(new ApiResponse(200, resume, "Resume Fetched Sucessfully"))

    } catch (error) {
        throw new ApiError(500, error?.message)
    }
})


module.exports = { uploadAndAnalyzeResume, deleteResumeById, getResumeById };
