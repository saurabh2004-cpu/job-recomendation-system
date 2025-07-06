const { string } = require("@tensorflow/tfjs");
const { enum_ } = require("cohere-ai/core/schemas");
const mongoose = require("mongoose");

// Minimal schema
const userSchema = new mongoose.Schema({}, { strict: false });
mongoose.model('User', userSchema, 'users'); // 'users' is the collection name in MongoDB


const jobSchema = new mongoose.Schema({
    recruiterId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
    },
    title: {
        type: String,
        required: true,
        index: true,
    },
    jobField: {
        type: String,
        required: true,
        index: true, // Create an index on the jobField field for faster searches
    },
    company: {
        type: String,
        required: true,
        index: true,
    },
    location: {
        type: String,
        required: true,
        index: true,
    },
    description: {
        type: String,
        required: true,
        index: true,
    },
    salary: {
        type: String,
        required: true,
    },
    jobType: {
        type: String,
        enum: ['full-time', 'part-time', 'contract', 'remote','internship'],
        required: true,
        index: true,
    },
    experience: {
        type: String,
        required: true,
        index: true,
    },
    education: {
        type: String,
        index: true,
        enum: ['bachelors', 'masters', 'phd', 'b-tech', 'diploma', 'undergraduate', 'postgraduate', 'any']
    },
    jobEmbedding: {
        type: [Number], // Storing 512-dimensional vector as an array of numbers
        required: true,
    },
    requiredSkills: {
        type: [String],
        required: true,
        index: true,
    },
    jobExpiryDate: {
        type: Date,
    },
    jobStatus: {
        type: String,
        enum: ['open', 'closed', 'paused'],
        default: 'open'

    },
    jobApplicants: {
        type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
        default: [],
    }

}, { timestamps: true });

const Job = mongoose.model("Job", jobSchema);
module.exports = Job