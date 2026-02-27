const express = require('express');
const router = express.Router();
const {
  getAllGroups,
  getGroup,
  createGroup,
  updateGroup,
  deleteGroup,
} = require('../controllers/groupController');

router.get('/', getAllGroups);
router.get('/:id', getGroup);
router.post('/', createGroup);
router.put('/:id', updateGroup);
router.delete('/:id', deleteGroup);

module.exports = router;
