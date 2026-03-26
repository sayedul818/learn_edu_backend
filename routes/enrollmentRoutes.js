const express = require('express');
const router = express.Router();
const { authenticate, requireTeacher } = require('../middleware/auth');
const enrollmentController = require('../controllers/enrollmentController');

router.get('/', authenticate, requireTeacher, enrollmentController.listEnrollments);
router.put('/:id', authenticate, requireTeacher, enrollmentController.updateEnrollment);
router.delete('/:id', authenticate, requireTeacher, enrollmentController.deleteEnrollment);

module.exports = router;
