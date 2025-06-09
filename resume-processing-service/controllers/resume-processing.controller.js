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

const uploadAndAnalyzeResume = asyncHandler(async (req, res, next) => {

    if (!req.file) {
        return next(new ApiError(400, "Resume file and job field are required"));
    }

    if (!req.user._id) {
        return new ApiError(400, "User ID not found")
    }

    const localFilePath = path.normalize(req.file.path);

    console.log("localFilePath", localFilePath)

    // //  Get buffer from the saved file
    // const pdfData = fs.readFileSync(localFilePath);

    // // Parse the PDF content to extract text
    // const parsedData = await pdfParse(pdfData);  // Using the buffer content from the file on disk

    const resumeText = await getPdfText(localFilePath);  // Extracted text from the PDF

    if (!resumeText || resumeText == '') {
        return next(new ApiError(400, "Failed to extract text from resume"));
    }

    //upload resume pdf on cloudinary
    const cloudinaryResponse = await uploadOnCloudinary(localFilePath);

    if (!cloudinaryResponse) {
        throw new ApiError(500, "Failed to upload resume on cloudinary")
    }

    //get sturctured data from resume text bu using cohere
    // const prompt = `
    //     You are a professional parser for job-related data. Your job is to extract clean, structured information from the following unstructured text, which could be either a **job description** or a **resume excerpt**.

    //     ### Step 1: Fix the formatting
    //     - Insert missing spaces and punctuation.
    //     - Ensure clear, readable formatting.
    //     - Keep the original meaning exactly the same.
    //     - Do **not** add or invent any information.

    //     ### Step 2: Extract only the following structured fields:

    //     - job_field: main job domain or specialization (e.g., Software Engineering, Data Science, Backend Developer)
    //     - description: a short summary of what the job or experience entails
    //     - experience: years or level of experience mentioned (e.g., 3 years, Fresher, Senior-level)
    //     - education: degrees or certifications (e.g., B.Tech in CS, Master of Data Science)
    //     - skills: list of technical and soft skills (e.g., JavaScript, Python, Communication)
    //     - keywords: relevant domain-specific terms or technologies (e.g., MERN Stack, REST APIs, Leadership)

    //     ### Strict Rules:
    //     - Do not infer or fabricate anything — use only what is **explicitly stated** in the text
    //     - Do not provide any explanation, just return the structured data
    //     - Output must be clean and consistently formatted

    //     Here is the raw text to process:
    //     """
    //     ${resumeText}
    //     """
    //     Return only the structured data in the specified format.
    //     dont return data in json format, return it in a clean and readable format.
    //     for example:
    //     job_field: Software Engineering
    //     description: Full Stack Developer with expertise in React, Node.js, and Express.
    //     experience: 3 years
    //     education: B.Tech in Computer Science
    //     skills: JavaScript, Python, Communication
    //     keywords: MERN Stack, REST APIs, Leadership
    // `;

    // console.log("analyzing resume... using Cohere's Generate API");
    // // Call Cohere's Generate API
    // const aiFormatedResumeText = await cohere.chat({
    //     model: "command-xlarge-nightly",
    //     max_tokens: 1000,
    //     temperature: 0.3,
    //     message: prompt
    // });

    const aiFormatedResumeText = await getStructeredData(resumeText);

    if (!aiFormatedResumeText) {
        return next(new ApiError(500, "Failed to extract structured information from the resume"));
    }

    console.log("resume analyzed successfully", aiFormatedResumeText.formatedAnswer);


    console.log("getting text embeddings... using lanchain model");
    // const textEmbeddings = await getEmbedding(aiFormatedResumeText?.text);
    const textEmbeddings = await getEmbeddings(aiFormatedResumeText.formatedAnswer);

    if (!textEmbeddings) {
        return next(new ApiError(500, "Failed to generate text embeddings"));
    }

    console.log("embeddings",textEmbeddings,);
    console.log("embedding length",textEmbeddings.length);

    try {

        const newResume = await Resume.create({
            userId: req.user._id,
            resumeText: resumeText,
            resumeEmbedding: textEmbeddings,
            resumeScore: 0,
            resumeUrl: cloudinaryResponse?.secure_url,
        });


        if (!newResume) {
            return next(new ApiError(400, "Failed to save resume"));
        }

        console.log("newResume", newResume)

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

const getResumeById = asyncHandler(async (req, res) => {
    const { resumeId } = req.query || req.params;

    console.log("resumeId", resumeId)

    if (!resumeId) {
        res.json(new ApiResponse(400, null, "Resume ID Not Found"))
    }

    if (!resumeId || !mongoose.Types.ObjectId.isValid(resumeId)) {
        return res.status(400).json(new ApiResponse(400, null, "Invalid or missing Resume ID"));
    }

    const cachedResume = await redisClient.get(`resume:${req.user._id}`)

    if (cachedResume) {
        res.json(new ApiResponse(200, JSON.parse(cachedResume), "Resume Fetched Sucessfully"))
    }

    try {
        const resume = await Resume.findById(resumeId);

        if (!resume) {
            res.json(new ApiResponse(400, "Resume Not Found"))
        }

        await redisClient.setex(`resume:${req?.user._id}`, 3600, JSON.stringify(resume))


        res.json(new ApiResponse(200, resume, "Resume Fetched Sucessfully"))

    } catch (error) {
        throw new ApiError(500, error?.message)
    }
})


module.exports = { uploadAndAnalyzeResume, deleteResumeById, getResumeById };
