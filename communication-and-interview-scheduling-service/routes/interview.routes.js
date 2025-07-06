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
    createCommunicationRoom,
    getApplicantsAllInterviews
} = require('../controllers/interview.controller')

router.route('/schedule-interview').post(verifyUser, scheduleInterview) //complted

router.route('/get-all-interviews').get(verifyUser, getAllInterviews)  //complted

router.route('/get-applicants-all-interviews').get(verifyUser, getApplicantsAllInterviews)  //complted

router.route('/get-single-interview').get(verifyUser, getSingleInterview) //not

router.route('/update-interview-status').patch(verifyUser, updateInterviewStatus) //completed

router.route('/delete-interviews-by-status').delete(verifyUser, deleteInterviewByStatus) //completed

router.route('/delete-interview-by-id').delete(verifyUser, deleteSingleInterview) //completed

router.route('/get-interviews-by-status').get(verifyUser, getInterViewByStatus) //completed

router.route('/search-interview-by-keyword').get(verifyUser, searchInterviewsByKeyword) //not

router.route('/join-communication-room').post(verifyUser, createCommunicationRoom) //not

module.exports = router