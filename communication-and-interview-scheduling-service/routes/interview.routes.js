const router = require('express').Router()
const verifyUser = require('../middlewares/auth.middleware')

const {
    scheduleInterview,
    getAllInterviews,
    getSingleInterview,
    updateInterviewStatus,
    deleteInterviewByStatus,
    deleteSingleInterview,
    getInterViewByStatus,
    searchInterviewsByKeyword,
    createCommunicationRoom
} = require('../controllers/interview.controller')

router.route('/schedule-interview').post(verifyUser, scheduleInterview)

router.route('/get-all-interviews').get(verifyUser, getAllInterviews)

router.route('/get-single-interview').get(verifyUser, getSingleInterview)

router.route('/update-interview-status').patch(verifyUser, updateInterviewStatus)

router.route('/delete-interviews-by-status').delete(verifyUser, deleteInterviewByStatus)

router.route('/delete-interview-by-id').delete(verifyUser, deleteSingleInterview)

router.route('/get-interviews-by-status').get(verifyUser, getInterViewByStatus)

router.route('/search-interview-by-keyword').get(verifyUser, searchInterviewsByKeyword)

router.route('/create-room').post(verifyUser, createCommunicationRoom)

module.exports = router