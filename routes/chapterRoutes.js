const express = require('express');
const router = express.Router();
const {
  getAllChapters,
  getChapter,
  createChapter,
  updateChapter,
  deleteChapter,
} = require('../controllers/chapterController');

router.get('/', getAllChapters);
router.get('/:id', getChapter);
router.post('/', createChapter);
router.put('/:id', updateChapter);
router.delete('/:id', deleteChapter);

module.exports = router;
