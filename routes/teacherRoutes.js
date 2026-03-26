const express = require('express');
const router = express.Router();
const { authenticate, requireTeacher } = require('../middleware/auth');
const teacherController = require('../controllers/teacherController');

router.get('/students', authenticate, requireTeacher, teacherController.listStudents);
router.post('/students', authenticate, requireTeacher, teacherController.createStudent);
router.put('/students/:id', authenticate, requireTeacher, teacherController.updateStudent);
router.patch('/students/:id/status', authenticate, requireTeacher, teacherController.changeStudentStatus);
router.delete('/students/:id', authenticate, requireTeacher, teacherController.deleteStudent);

module.exports = router;
