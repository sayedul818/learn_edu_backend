const express = require('express');
const router = express.Router();
const { authenticate, requireTeacher } = require('../middleware/auth');
const courseController = require('../controllers/courseController');
const assignmentController = require('../controllers/assignmentController');
const { uploadAssignmentFiles } = require('../middleware/upload');

router.get('/', authenticate, requireTeacher, courseController.listCourses);
router.get('/my/assignments', authenticate, assignmentController.listMyAssignments);
router.get('/my/assignments/:assignmentId', authenticate, assignmentController.getMyAssignment);
router.get('/my/materials', authenticate, courseController.listMyMaterials);
router.get('/my/enrolled', authenticate, courseController.listMyEnrolledCourses);
router.get('/my/announcements', authenticate, courseController.listMyAnnouncements);
router.post('/my/announcements/:courseId/:announcementId/seen', authenticate, courseController.markMyAnnouncementSeen);
router.post('/my/announcements/:courseId/:announcementId/like', authenticate, courseController.toggleMyAnnouncementLike);
router.post('/join/:token', authenticate, courseController.joinCourseByToken);
router.get('/:id/leaderboard', authenticate, courseController.getCourseLeaderboard);
router.get('/:id', authenticate, requireTeacher, courseController.getCourse);
router.get('/:id/students/:studentId/performance', authenticate, requireTeacher, courseController.getCourseStudentPerformance);
router.post('/', authenticate, requireTeacher, courseController.createCourse);
router.put('/:id', authenticate, requireTeacher, courseController.updateCourse);
router.delete('/:id', authenticate, requireTeacher, courseController.deleteCourse);
router.post('/:id/invite-link', authenticate, requireTeacher, courseController.generateCourseInviteLink);

router.get('/:id/students', authenticate, requireTeacher, courseController.listCourseStudents);
router.post('/:id/students', authenticate, requireTeacher, courseController.addCourseStudent);
router.patch('/:id/students/:studentId/status', authenticate, requireTeacher, courseController.updateCourseStudentStatus);
router.delete('/:id/students/:studentId', authenticate, requireTeacher, courseController.removeCourseStudent);

router.post('/:id/exams', authenticate, requireTeacher, courseController.linkCourseExam);
router.delete('/:id/exams/:examId', authenticate, requireTeacher, courseController.unlinkCourseExam);

router.get('/:id/assignments', authenticate, assignmentController.listAssignments);
router.post('/:id/assignments', authenticate, requireTeacher, assignmentController.createAssignment);
router.post('/:id/assignments/:assignmentId/attachments', authenticate, uploadAssignmentFiles.array('files', 5), assignmentController.uploadAssignmentAttachments);
router.post('/:id/assignments/:assignmentId/submit', authenticate, assignmentController.submitAssignment);
router.put('/:id/assignments/:assignmentId', authenticate, requireTeacher, assignmentController.updateAssignment);
router.patch('/:id/assignments/:assignmentId/publish', authenticate, requireTeacher, assignmentController.publishAssignment);
router.patch('/:id/assignments/:assignmentId/close', authenticate, requireTeacher, assignmentController.closeAssignment);
router.delete('/:id/assignments/:assignmentId', authenticate, requireTeacher, assignmentController.deleteAssignment);

router.get('/:id/assignments/:assignmentId/submissions', authenticate, requireTeacher, assignmentController.getAssignmentSubmissions);
router.get('/:id/assignments/:assignmentId/submissions/:studentId', authenticate, requireTeacher, assignmentController.getStudentSubmission);
router.put('/:id/assignments/:assignmentId/submissions/:studentId/grade', authenticate, requireTeacher, assignmentController.gradeStudentSubmission);

router.post('/:id/materials', authenticate, requireTeacher, courseController.addMaterial);
router.put('/:id/materials/:materialId', authenticate, requireTeacher, courseController.updateMaterial);
router.delete('/:id/materials/:materialId', authenticate, requireTeacher, courseController.removeMaterial);

router.post('/:id/announcements', authenticate, requireTeacher, courseController.addAnnouncement);
router.put('/:id/announcements/:announcementId', authenticate, requireTeacher, courseController.updateAnnouncement);
router.post('/:id/announcements/:announcementId/duplicate', authenticate, requireTeacher, courseController.duplicateAnnouncement);
router.delete('/:id/announcements/:announcementId', authenticate, requireTeacher, courseController.removeAnnouncement);

module.exports = router;
