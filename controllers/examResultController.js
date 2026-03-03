const ExamResult = require('../models/ExamResult');
const Exam = require('../models/Exam');

// @desc    Submit/save an exam result
// @route   POST /api/exam-results
// @access  Private (student)
exports.submitResult = async (req, res) => {
  try {
    const { examId, answers, score, totalMarks, percentage, timeTaken, pendingEvaluation, attachments } = req.body;
    const studentId = req.user.id || req.user._id;
    if (!examId || !answers || totalMarks == null || timeTaken == null) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    // If not pending manual evaluation, require score and percentage
    if (!pendingEvaluation && (score == null || percentage == null)) {
      return res.status(400).json({ error: 'Missing score/percentage for auto-evaluated submission' });
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
    const update = { answers, totalMarks, timeTaken, submittedAt: new Date() };
    if (pendingEvaluation) update.pendingEvaluation = true;
    if (score != null) update.score = score;
    if (percentage != null) update.percentage = percentage;
    if (attachments) update.attachments = attachments;

    const result = await ExamResult.findOneAndUpdate(
      { examId, studentId },
      update,
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    res.status(201).json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// @desc    Grade a pending exam result (admin/teacher)
// @route   PUT /api/exam-results/:id/grade
// @access  Private (admin/teacher)
exports.gradeResult = async (req, res) => {
  try {
    const { id } = req.params;
    const { cqMarks } = req.body; // { questionId: marks }
    if (!id) return res.status(400).json({ error: 'Missing result id' });

    const result = await ExamResult.findById(id);
    if (!result) return res.status(404).json({ error: 'Result not found' });

    // Load exam and questions to compute MCQ score
    const exam = await Exam.findById(result.examId).lean();
    const Question = require('../models/Question');
    // questions may be stored as objects or ids; fetch questions by ids
    const qIds = (exam.questionIds || []).map(q => (typeof q === 'string' ? q : (q._id || q.id))).filter(Boolean);
    const questions = await Question.find({ _id: { $in: qIds } }).lean();

    // Compute MCQ score from stored answers
    let mcqScore = 0;
    const answers = result.answers || {};
    const marksPerQuestion = exam.marksPerQuestion ?? 1;
    const negativeMarking = exam.negativeMarking;
    const negativeValue = exam.negativeMarkValue || 0;

    for (const q of questions) {
      if (q.subQuestions && q.subQuestions.length > 0) continue; // skip CQs
      if (q.questionType !== 'MCQ') continue;
      const studentAns = answers[q._id] || answers[q.id];
      // determine correct option text
      const correctOpt = (q.options || []).find(o => o.isCorrect);
      const correctText = correctOpt ? correctOpt.text : null;
      const isCorrect = studentAns != null && (studentAns === correctText || String(studentAns).toUpperCase() === String((q.options || []).findIndex(o=>o.isCorrect) >=0 ? String.fromCharCode(65 + (q.options || []).findIndex(o=>o.isCorrect)) : ''));
      if (isCorrect) mcqScore += marksPerQuestion;
      else if (studentAns && negativeMarking) mcqScore -= negativeValue;
    }

    // Sum CQ marks provided by admin
    let cqTotal = 0;
    if (cqMarks && typeof cqMarks === 'object') {
      Object.values(cqMarks).forEach((m) => {
        const val = Number(m) || 0;
        cqTotal += val;
      });
    }

    const finalScore = Math.max(0, mcqScore + cqTotal);
    const totalMarks = exam.totalMarks || (qIds.length * marksPerQuestion);
    const percentage = totalMarks > 0 ? (finalScore / totalMarks) * 100 : 0;

    result.cqMarks = cqMarks || {};
    result.score = finalScore;
    result.percentage = percentage;
    result.pendingEvaluation = false;
    result.gradedAt = new Date();
    await result.save();

    res.json({ success: true, data: result });
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

// @desc    Recompute (regrade) a single stored result using current question keys
// @route   PUT /api/exam-results/:id/regrade
// @access  Private (admin/teacher)
exports.regradeResult = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) return res.status(400).json({ error: 'Missing result id' });

    const result = await ExamResult.findById(id);
    if (!result) return res.status(404).json({ error: 'Result not found' });

    // Load exam and questions
    const exam = await Exam.findById(result.examId).lean();
    const Question = require('../models/Question');
    const qIds = (exam.questionIds || []).map(q => (typeof q === 'string' ? q : (q._id || q.id))).filter(Boolean);
    const questions = await Question.find({ _id: { $in: qIds } }).lean();

    // Compute MCQ score from stored answers using current correct answers
    let mcqScore = 0;
    const answers = result.answers || {};
    const marksPerQuestion = exam.marksPerQuestion ?? 1;
    const negativeMarking = exam.negativeMarking;
    const negativeValue = exam.negativeMarkValue || 0;

    for (const q of questions) {
      if (q.subQuestions && q.subQuestions.length > 0) continue; // skip CQs
      if (q.questionType !== 'MCQ') continue;
      const studentAns = answers[q._id] || answers[q.id];
      const correctOpt = (q.options || []).find(o => o.isCorrect);
      const correctText = correctOpt ? correctOpt.text : null;
      const correctIndex = (q.options || []).findIndex(o => o.isCorrect);
      const isCorrect = studentAns != null && (
        studentAns === correctText ||
        String(studentAns).toUpperCase() === (correctIndex >= 0 ? String.fromCharCode(65 + correctIndex) : '')
      );
      if (isCorrect) mcqScore += marksPerQuestion;
      else if (studentAns && negativeMarking) mcqScore -= negativeValue;
    }

    // Sum CQ marks from stored result.cqMarks
    let cqTotal = 0;
    if (result.cqMarks && typeof result.cqMarks === 'object') {
      Object.values(result.cqMarks).forEach((m) => {
        const val = Number(m) || 0;
        cqTotal += val;
      });
    }

    const finalScore = Math.max(0, mcqScore + cqTotal);
    const totalMarks = exam.totalMarks || (qIds.length * marksPerQuestion);
    const percentage = totalMarks > 0 ? (finalScore / totalMarks) * 100 : 0;

    result.score = finalScore;
    result.percentage = percentage;
    result.pendingEvaluation = false;
    result.gradedAt = new Date();
    await result.save();

    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// @desc    Recompute (regrade) all results for an exam using current question keys
// @route   POST /api/exam-results/exam/:examId/regrade
// @access  Private (admin/teacher)
exports.regradeResultsForExam = async (req, res) => {
  try {
    const { examId } = req.params;
    if (!examId) return res.status(400).json({ error: 'Missing exam id' });

    const exam = await Exam.findById(examId).lean();
    if (!exam) return res.status(404).json({ error: 'Exam not found' });

    const results = await ExamResult.find({ examId });
    const Question = require('../models/Question');
    const qIds = (exam.questionIds || []).map(q => (typeof q === 'string' ? q : (q._id || q.id))).filter(Boolean);
    const questions = await Question.find({ _id: { $in: qIds } }).lean();

    const marksPerQuestion = exam.marksPerQuestion ?? 1;
    const negativeMarking = exam.negativeMarking;
    const negativeValue = exam.negativeMarkValue || 0;

    const updated = [];
    for (const result of results) {
      let mcqScore = 0;
      const answers = result.answers || {};
      for (const q of questions) {
        if (q.subQuestions && q.subQuestions.length > 0) continue;
        if (q.questionType !== 'MCQ') continue;
        const studentAns = answers[q._id] || answers[q.id];
        const correctOpt = (q.options || []).find(o => o.isCorrect);
        const correctText = correctOpt ? correctOpt.text : null;
        const correctIndex = (q.options || []).findIndex(o => o.isCorrect);
        const isCorrect = studentAns != null && (
          studentAns === correctText ||
          String(studentAns).toUpperCase() === (correctIndex >= 0 ? String.fromCharCode(65 + correctIndex) : '')
        );
        if (isCorrect) mcqScore += marksPerQuestion;
        else if (studentAns && negativeMarking) mcqScore -= negativeValue;
      }

      let cqTotal = 0;
      if (result.cqMarks && typeof result.cqMarks === 'object') {
        Object.values(result.cqMarks).forEach((m) => { cqTotal += Number(m) || 0; });
      }

      const finalScore = Math.max(0, mcqScore + cqTotal);
      const totalMarks = exam.totalMarks || (qIds.length * marksPerQuestion);
      const percentage = totalMarks > 0 ? (finalScore / totalMarks) * 100 : 0;

      result.score = finalScore;
      result.percentage = percentage;
      result.pendingEvaluation = false;
      result.gradedAt = new Date();
      await result.save();
      updated.push(result._id);
    }

    res.json({ success: true, updatedCount: updated.length, updatedIds: updated });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// @desc    Recompute (regrade) a single stored result using current question keys
// @route   PUT /api/exam-results/:id/regrade
// @access  Private (admin/teacher)
exports.regradeResult = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) return res.status(400).json({ error: 'Missing result id' });

    const result = await ExamResult.findById(id);
    if (!result) return res.status(404).json({ error: 'Result not found' });

    // Load exam and questions
    const exam = await Exam.findById(result.examId).lean();
    const Question = require('../models/Question');
    const qIds = (exam.questionIds || []).map(q => (typeof q === 'string' ? q : (q._id || q.id))).filter(Boolean);
    const questions = await Question.find({ _id: { $in: qIds } }).lean();

    // Compute MCQ score from stored answers using current correct answers
    let mcqScore = 0;
    const answers = result.answers || {};
    const marksPerQuestion = exam.marksPerQuestion ?? 1;
    const negativeMarking = exam.negativeMarking;
    const negativeValue = exam.negativeMarkValue || 0;

    for (const q of questions) {
      if (q.subQuestions && q.subQuestions.length > 0) continue; // skip CQs
      if (q.questionType !== 'MCQ') continue;
      const studentAns = answers[q._id] || answers[q.id];
      const correctOpt = (q.options || []).find(o => o.isCorrect);
      const correctText = correctOpt ? correctOpt.text : null;
      const isCorrect = studentAns != null && (studentAns === correctText || String(studentAns).toUpperCase() === String((q.options || []).findIndex(o=>o.isCorrect) >=0 ? String.fromCharCode(65 + (q.options || []).findIndex(o=>o.isCorrect)) : ''));
      if (isCorrect) mcqScore += marksPerQuestion;
      else if (studentAns && negativeMarking) mcqScore -= negativeValue;
    }

    // Sum CQ marks from stored result.cqMarks
    let cqTotal = 0;
    if (result.cqMarks && typeof result.cqMarks === 'object') {
      Object.values(result.cqMarks).forEach((m) => {
        const val = Number(m) || 0;
        cqTotal += val;
      });
    }

    const finalScore = Math.max(0, mcqScore + cqTotal);
    const totalMarks = exam.totalMarks || (qIds.length * marksPerQuestion);
    const percentage = totalMarks > 0 ? (finalScore / totalMarks) * 100 : 0;

    result.score = finalScore;
    result.percentage = percentage;
    result.pendingEvaluation = false;
    result.gradedAt = new Date();
    await result.save();

    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// @desc    Recompute (regrade) all results for an exam using current question keys
// @route   POST /api/exam-results/exam/:examId/regrade
// @access  Private (admin/teacher)
exports.regradeResultsForExam = async (req, res) => {
  try {
    const { examId } = req.params;
    if (!examId) return res.status(400).json({ error: 'Missing exam id' });

    const exam = await Exam.findById(examId).lean();
    if (!exam) return res.status(404).json({ error: 'Exam not found' });

    const results = await ExamResult.find({ examId });
    const Question = require('../models/Question');
    const qIds = (exam.questionIds || []).map(q => (typeof q === 'string' ? q : (q._id || q.id))).filter(Boolean);
    const questions = await Question.find({ _id: { $in: qIds } }).lean();

    const marksPerQuestion = exam.marksPerQuestion ?? 1;
    const negativeMarking = exam.negativeMarking;
    const negativeValue = exam.negativeMarkValue || 0;

    const updated = [];
    for (const result of results) {
      let mcqScore = 0;
      const answers = result.answers || {};
      for (const q of questions) {
        if (q.subQuestions && q.subQuestions.length > 0) continue;
        if (q.questionType !== 'MCQ') continue;
        const studentAns = answers[q._id] || answers[q.id];
        const correctOpt = (q.options || []).find(o => o.isCorrect);
        const correctText = correctOpt ? correctOpt.text : null;
        const isCorrect = studentAns != null && (studentAns === correctText || String(studentAns).toUpperCase() === String((q.options || []).findIndex(o=>o.isCorrect) >=0 ? String.fromCharCode(65 + (q.options || []).findIndex(o=>o.isCorrect)) : ''));
        if (isCorrect) mcqScore += marksPerQuestion;
        else if (studentAns && negativeMarking) mcqScore -= negativeValue;
      }

      let cqTotal = 0;
      if (result.cqMarks && typeof result.cqMarks === 'object') {
        Object.values(result.cqMarks).forEach((m) => { cqTotal += Number(m) || 0; });
      }

      const finalScore = Math.max(0, mcqScore + cqTotal);
      const totalMarks = exam.totalMarks || (qIds.length * marksPerQuestion);
      const percentage = totalMarks > 0 ? (finalScore / totalMarks) * 100 : 0;

      result.score = finalScore;
      result.percentage = percentage;
      result.pendingEvaluation = false;
      result.gradedAt = new Date();
      await result.save();
      updated.push(result._id);
    }

    res.json({ success: true, updatedCount: updated.length, updatedIds: updated });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
