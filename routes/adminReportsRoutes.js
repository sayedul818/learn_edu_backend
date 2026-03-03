const express = require('express');
const router = express.Router();
const { authenticate, requireAdmin } = require('../middleware/auth');
const { getStudentsSummary, getStudentDetail } = require('../controllers/adminReportsController');

router.get('/students', authenticate, requireAdmin, getStudentsSummary);
router.get('/students/:id', authenticate, requireAdmin, getStudentDetail);

module.exports = router;
