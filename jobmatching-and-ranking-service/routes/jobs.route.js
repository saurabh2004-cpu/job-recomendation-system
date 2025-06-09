const express = require('express')
const router = express.Router()
const verifyUser = require('../middlewares/auth.middleware')
const {
    createJob,
    getJobById,
    updateJobDetails,
    deleteJob,
    getRecrutersAllJobs,
    deleteManyJobs,
    toggleJobStatus,
    getAllAplicantsForJob,
    getApplicantsProfile
} = require('../controllers/jobs.controller')

//recruters routes

router.route('/create-job').post(
    verifyUser,
    createJob
);

router.route('/get-Job-By-Id').get(
    verifyUser,
    getJobById
);

router.route('/update-job-details').patch(
    verifyUser,
    updateJobDetails
);

router.route('/get-requiters-all-jobs').get(
    verifyUser,
    getRecrutersAllJobs
);

router.route('/delete-job').delete(
    verifyUser,
    deleteJob
);

router.route('/delete-many-jobs').delete(
    verifyUser,
    deleteManyJobs
);

router.route('/toggle-job-status').patch(
    verifyUser,
    toggleJobStatus
)

router.route('/get-all-applicants').get(
    verifyUser,
    getAllAplicantsForJob
)

router.route('/get-applicants-profile').get(
    verifyUser,
    getApplicantsProfile
)





module.exports = router;
