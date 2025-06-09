const express = require('express')
const router = express.Router()
const resumeController = require('../controllers/resume-processing.controller')
const verifyUser = require('../middlewares/auth.middleware')
const upload = require('../middlewares/multer.middleware')

router.route('/analyze-resume')
    .post(
        verifyUser,
        upload.single('resume'),
        resumeController.uploadAndAnalyzeResume
    )

router.route('/delete-resume-by-id').delete(
    verifyUser,
    resumeController.deleteResumeById
)

router.route('/get-resume-by-id').get(
    verifyUser,
    resumeController.getResumeById
)

module.exports = router