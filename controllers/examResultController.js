const ExamResult = require('../models/ExamResult');
const Exam = require('../models/Exam');

// @desc    Submit/save an exam result
// @route   POST /api/exam-results
// @access  Private (student)
exports.submitResult = async (req, res) => {
  try {
    const { examId, answers, score, totalMarks, percentage, timeTaken } = req.body;
    const studentId = req.user.id || req.user._id;
    if (!examId || !answers || score == null || totalMarks == null || percentage == null || timeTaken == null) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    // Verify exam exists and access control
    const exam = await Exam.findById(examId).select('accessType allowedStudents');
    if (!exam) return res.status(404).json({ error: 'Exam not found' });
    if (exam.accessType === 'specific') {
      const allowed = (exam.allowedStudents || []).map(String);
      if (!allowed.includes(String(studentId))) {
        return res.status(403).json({ error: 'You are not allowed to attempt this exam' });
      }
    }
    // Upsert: one result per student per exam
    const result = await ExamResult.findOneAndUpdate(
      { examId, studentId },
      { answers, score, totalMarks, percentage, timeTaken, submittedAt: new Date() },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    res.status(201).json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// @desc    Get all results for a student
// @route   GET /api/exam-results/mine
// @access  Private (student)
exports.getMyResults = async (req, res) => {
  try {
    const studentId = req.user.id || req.user._id;
    // populate examId and its subjectId so frontend can read subject info
    const results = await ExamResult.find({ studentId }).populate({ path: 'examId', populate: 'subjectId' });
    res.json({ success: true, data: results });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// @desc    Get all results for an exam (admin/teacher)
// @route   GET /api/exam-results/exam/:examId
// @access  Private (admin/teacher)
exports.getResultsByExam = async (req, res) => {
  try {
    const { examId } = req.params;
    const results = await ExamResult.find({ examId }).populate('studentId');
    res.json({ success: true, data: results });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
