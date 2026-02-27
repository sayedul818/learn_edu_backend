const express = require('express');
const {
  getAllExamTypes,
  getExamType,
  createExamType,
  updateExamType,
  deleteExamType,
} = require('../controllers/examTypeController');

const router = express.Router();

// Public routes
router.get('/', getAllExamTypes);
router.get('/:id', getExamType);

// Private routes
router.post('/', createExamType);
router.put('/:id', updateExamType);
router.delete('/:id', deleteExamType);

module.exports = router;
