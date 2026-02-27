const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const examResultController = require('../controllers/examResultController');

// Student submits result
router.post('/', authenticate, examResultController.submitResult);
// Student fetches their own results
router.get('/mine', authenticate, examResultController.getMyResults);
// Admin/teacher fetches all results for an exam
router.get('/exam/:examId', authenticate, examResultController.getResultsByExam);

module.exports = router;
