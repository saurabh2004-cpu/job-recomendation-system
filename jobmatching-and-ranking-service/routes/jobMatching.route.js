const express = require('express')
const router = express.Router()
const verifyUser = require('../middlewares/auth.middleware')
const { findJobBasedOnResume, findJobBykeyword, getAllJobs, applyForJob } = require('../controllers/jobMatching.controller')


router.route('/top-job-matches').get(
    verifyUser,
    findJobBasedOnResume
)

router.route('/get-job-by-keyword').get(
    verifyUser,
    findJobBykeyword
)

router.route('/get-all-jobs').get(
    verifyUser,
    getAllJobs
)

router.route('/apply-for-job').post(
    verifyUser,
    applyForJob
)

module.exports = router