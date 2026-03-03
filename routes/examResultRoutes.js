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
// Admin grades a result
router.put('/:id/grade', authenticate, examResultController.gradeResult);
// Admin regrade a single stored result (recompute using current question keys)
router.put('/:id/regrade', authenticate, examResultController.regradeResult);
// Admin regrade all results for an exam
router.post('/exam/:examId/regrade', authenticate, examResultController.regradeResultsForExam);

module.exports = router;
