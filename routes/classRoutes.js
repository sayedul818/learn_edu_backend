const express = require('express');
const router = express.Router();
const {
  getAllClasses,
  getClass,
  createClass,
  updateClass,
  deleteClass,
} = require('../controllers/classController');

router.get('/', getAllClasses);
router.get('/:id', getClass);
router.post('/', createClass);
router.put('/:id', updateClass);
router.delete('/:id', deleteClass);

module.exports = router;
