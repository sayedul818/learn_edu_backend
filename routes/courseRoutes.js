const express = require('express');
const router = express.Router();
const { authenticate, requireTeacher } = require('../middleware/auth');
const courseController = require('../controllers/courseController');

router.get('/', authenticate, requireTeacher, courseController.listCourses);
router.get('/:id', authenticate, requireTeacher, courseController.getCourse);
router.post('/', authenticate, requireTeacher, courseController.createCourse);
router.put('/:id', authenticate, requireTeacher, courseController.updateCourse);
router.delete('/:id', authenticate, requireTeacher, courseController.deleteCourse);

router.get('/:id/students', authenticate, requireTeacher, courseController.listCourseStudents);
router.post('/:id/students', authenticate, requireTeacher, courseController.addCourseStudent);
router.delete('/:id/students/:studentId', authenticate, requireTeacher, courseController.removeCourseStudent);

router.post('/:id/exams', authenticate, requireTeacher, courseController.linkCourseExam);
router.delete('/:id/exams/:examId', authenticate, requireTeacher, courseController.unlinkCourseExam);

router.post('/:id/materials', authenticate, requireTeacher, courseController.addMaterial);
router.delete('/:id/materials/:materialId', authenticate, requireTeacher, courseController.removeMaterial);

router.post('/:id/announcements', authenticate, requireTeacher, courseController.addAnnouncement);
router.delete('/:id/announcements/:announcementId', authenticate, requireTeacher, courseController.removeAnnouncement);

module.exports = router;
