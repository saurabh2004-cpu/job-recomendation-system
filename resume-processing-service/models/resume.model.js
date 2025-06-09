const mongoose = require('mongoose');

const resumeSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        required: [true, 'userId is required'],

    },
    resumeText: {
        type: String,
        required: [true, 'resume text is required'],
    },
    resumeEmbedding: {
        type: [Number], // Storing 512-dimensional vector
        required: true,
    },
    resumeScore: {
        type: Number,
        required: true,
    },
    resumeUrl: {
        type: String,
        required: false,
    },
}, { timestamps: true });

const Resume = mongoose.model("Resume", resumeSchema);
module.exports = Resume;
