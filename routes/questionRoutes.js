const express = require('express');
const router = express.Router();
const {
  getAllQuestions,
  getQuestion,
  createQuestion,
  bulkImportQuestions,
  updateQuestion,
  deleteQuestion,
} = require('../controllers/questionController');

router.get('/', getAllQuestions);
router.get('/:id', getQuestion);
router.post('/', createQuestion);
router.post('/bulk', bulkImportQuestions);
router.put('/:id', updateQuestion);
router.delete('/:id', deleteQuestion);

module.exports = router;
