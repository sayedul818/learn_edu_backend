const express = require('express');
const router = express.Router();
const {
  getAllExams,
  getExam,
  createExam,
  updateExam,
  publishExam,
  unpublishExam,
  deleteExam,
  getMyExams,
} = require('../controllers/examController');
const { authenticate } = require('../middleware/auth');

router.get('/', getAllExams);
router.get('/mine', authenticate, getMyExams);
router.get('/:id', getExam);
router.post('/', createExam);
router.put('/:id', updateExam);
router.patch('/:id/publish', publishExam);
router.patch('/:id/unpublish', unpublishExam);
router.delete('/:id', deleteExam);

module.exports = router;
