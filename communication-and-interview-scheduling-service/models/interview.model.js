const mongoose = require("mongoose");

// Minimal schema
const userSchema = new mongoose.Schema({}, { strict: false });
mongoose.model('User', userSchema, 'users');

const jobSchema = new mongoose.Schema({}, { strict: false });
mongoose.model('Job', jobSchema, 'jobs');

const interview = mongoose.Schema({
    applicantId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    jobId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Job',
        required: true,
        index: true

    },
    recruiterId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true

    },
    scheduledDate: {
        type: Date,
        required: [true, 'scheduledDate is required'],
        index: true

    },
    scheduledTime: {
        type: String,
        required: [true, 'scheduledTime is required'],
        index: true

    },
    status: {
        type: String, enum: ['pending', 'accepted', 'rejected', 'scheduled', 'completed', 'cancelled','expired'],
        required: [true, 'status is required'],
        index: true
    },
    applicantStatus: {
        type: String,
        enum: ['accepted', 'rejected', 'postponed']
    }
}, { timestamps: true });

const interviewModel = mongoose.model("Interview", interview);
module.exports = interviewModel;