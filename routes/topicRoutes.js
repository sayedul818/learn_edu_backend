const express = require('express');
const router = express.Router();
const {
  getAllTopics,
  getTopic,
  createTopic,
  updateTopic,
  deleteTopic,
} = require('../controllers/topicController');

router.get('/', getAllTopics);
router.get('/:id', getTopic);
router.post('/', createTopic);
router.put('/:id', updateTopic);
router.delete('/:id', deleteTopic);

module.exports = router;
