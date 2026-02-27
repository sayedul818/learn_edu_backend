const Exam = require('../models/Exam');
const ExamResult = require('../models/ExamResult');

// @desc    Get exams visible to current user (student-specific)
// @route   GET /api/exams/mine
// @access  Private (student/admin/teacher)
exports.getMyExams = async (req, res) => {
  try {
    const user = req.user;
    if (!user) return res.status(401).json({ success: false, error: 'Not authenticated' });

    // Admins/teachers can see all exams
    if (user.role === 'admin' || user.role === 'teacher') {
      const exams = await Exam.find()
        .populate('questionIds')
        .populate('classId groupId subjectId chapterId topicId')
        .sort({ createdAt: -1 });
      return res.status(200).json({ success: true, data: exams });
    }

    const uid = user._id || user.id;
    // Find exams where accessType != 'specific' OR user is in allowedStudents
    const exams = await Exam.find({ $or: [{ accessType: { $ne: 'specific' } }, { allowedStudents: uid }] })
      .populate('questionIds')
      .populate('classId groupId subjectId chapterId topicId')
      .sort({ createdAt: -1 });

    // Fetch this user's results once to mark completed exams
    const myResults = await ExamResult.find({ studentId: uid }).select('examId submittedAt');
    const completedSet = new Set((myResults || []).map(r => String(r.examId)));

    // Compute per-exam userStatus: upcoming | live | previous
    const now = Date.now();
    const transformed = exams.map((ex) => {
      // compute start/end similar to frontend
      let start = null;
      let end = null;
      try {
        if (ex.startDate) {
          start = ex.startTime ? new Date(`${ex.startDate.toISOString ? ex.startDate.toISOString().slice(0,10) : String(ex.startDate).split('T')[0]}T${ex.startTime}:00`) : new Date(ex.startDate);
        }
        if (ex.endDate) {
          end = ex.endTime ? new Date(`${ex.endDate.toISOString ? ex.endDate.toISOString().slice(0,10) : String(ex.endDate).split('T')[0]}T${ex.endTime}:00`) : new Date(ex.endDate);
        }
        if (!end && start && ex.duration) {
          end = new Date(start.getTime() + (ex.duration || 0) * 60000);
        }
      } catch (e) {
        // ignore parse errors
      }

      let userStatus = 'upcoming';
      const isCompleted = completedSet.has(String(ex._id));
      if (isCompleted) userStatus = 'previous';
      else if (start && now < start.getTime()) userStatus = 'upcoming';
      else if ((start && now >= start.getTime() && (!end || now <= end.getTime())) || (!start && !end && ex.status === 'live')) userStatus = 'live';
      else if (end && now > end.getTime()) userStatus = 'previous';

      return { ...ex.toObject(), userStatus };
    });

    res.status(200).json({ success: true, data: transformed });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// @desc    Get all exams
// @route   GET /api/exams
// @access  Public
exports.getAllExams = async (req, res) => {
  try {
    const exams = await Exam.find()
      .populate('questionIds')
      .populate('classId groupId subjectId chapterId topicId allowedStudents')
      .sort({ createdAt: -1 });
    
    res.status(200).json({
      success: true,
      count: exams.length,
      data: exams,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// @desc    Get single exam
// @route   GET /api/exams/:id
// @access  Public
exports.getExam = async (req, res) => {
  try {
    const exam = await Exam.findById(req.params.id)
      .populate('questionIds')
      .populate('classId groupId subjectId chapterId topicId allowedStudents');
    
    if (!exam) {
      return res.status(404).json({
        success: false,
        error: 'Exam not found',
      });
    }
    
    res.status(200).json({
      success: true,
      data: exam,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// @desc    Create exam
// @route   POST /api/exams
// @access  Private
exports.createExam = async (req, res) => {
  try {
    const {
      title,
      duration,
      totalMarks,
      questionIds,
      description,
      startDate,
      startTime,
      endDate,
      endTime,
      marksPerQuestion,
      negativeMarking,
      negativeMarkValue,
      questionNumbering,
      questionPresentation,
      shuffleQuestions,
      shuffleOptions,
      allowMultipleAttempts,
      allowAnswerChange,
      resultVisibility,
      answerVisibility,
      autoSubmit,
    } = req.body;

    if (!title || !duration || typeof totalMarks === 'undefined') {
      return res.status(400).json({
        success: false,
        error: 'Please provide title, duration, and totalMarks',
      });
    }

    // determine status: if explicit start is in future, mark as 'scheduled'
    let startDateTime = null;
    if (startDate) {
      if (startTime) startDateTime = new Date(`${startDate}T${startTime}:00`);
      else startDateTime = new Date(startDate);
    }

    const isScheduled = startDateTime && startDateTime.getTime() > Date.now();

    const newExam = await Exam.create({
      title,
      duration,
      totalMarks,
      questionIds: questionIds || [],
      description,
      status: isScheduled ? 'scheduled' : 'draft',
      // schedule fields
      startDate: startDate || null,
      startTime: startTime || null,
      endDate: endDate || null,
      endTime: endTime || null,
      // settings
      marksPerQuestion: marksPerQuestion ?? 1,
      negativeMarking: Boolean(negativeMarking),
      negativeMarkValue: negativeMarkValue ?? 0,
      questionNumbering: questionNumbering || 'sequential',
      questionPresentation: questionPresentation || 'all-at-once',
      shuffleQuestions: Boolean(shuffleQuestions),
      shuffleOptions: Boolean(shuffleOptions),
      allowMultipleAttempts: Boolean(allowMultipleAttempts),
      allowAnswerChange: allowAnswerChange !== false,
      resultVisibility: resultVisibility || 'immediate',
      answerVisibility: answerVisibility || 'after-exam-end',
      autoSubmit: autoSubmit !== false,
      accessType: req.body.accessType || 'all',
      allowedStudents: Array.isArray(req.body.allowedStudents) ? req.body.allowedStudents : [],
    });

    // populate related refs for the response
    await newExam.populate(['questionIds', 'classId', 'groupId', 'subjectId', 'chapterId', 'topicId']);

    res.status(201).json({
      success: true,
      data: newExam,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// @desc    Update exam
// @route   PUT /api/exams/:id
// @access  Private
exports.updateExam = async (req, res) => {
  try {
    let exam = await Exam.findById(req.params.id);
    
    if (!exam) {
      return res.status(404).json({
        success: false,
        error: 'Exam not found',
      });
    }
    
    // Ensure allowedStudents is an array when updating
    const updatePayload = { ...req.body };
    if (updatePayload.allowedStudents && !Array.isArray(updatePayload.allowedStudents)) {
      updatePayload.allowedStudents = Array.isArray(updatePayload.allowedStudents) ? updatePayload.allowedStudents : [];
    }

    exam = await Exam.findByIdAndUpdate(req.params.id, updatePayload, {
      new: true,
      runValidators: true,
    }).populate(['questionIds', 'classId', 'groupId', 'subjectId', 'chapterId', 'topicId']);
    // populate allowedStudents as well
    await exam.populate('allowedStudents');
    
    res.status(200).json({
      success: true,
      data: exam,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// @desc    Publish exam
// @route   PATCH /api/exams/:id/publish
// @access  Private
exports.publishExam = async (req, res) => {
  try {
    let exam = await Exam.findById(req.params.id);
    
    if (!exam) {
      return res.status(404).json({
        success: false,
        error: 'Exam not found',
      });
    }
    
    if (exam.questionIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Cannot publish exam without questions',
      });
    }
    
    exam = await Exam.findByIdAndUpdate(
      req.params.id,
      {
        status: 'live',
        publishedAt: new Date(),
      },
      {
        new: true,
      }
    ).populate(['questionIds', 'classId', 'groupId', 'subjectId', 'chapterId', 'topicId']);
    
    res.status(200).json({
      success: true,
      data: exam,
      message: 'Exam published successfully',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// @desc    Unpublish exam
// @route   PATCH /api/exams/:id/unpublish
// @access  Private
exports.unpublishExam = async (req, res) => {
  try {
    let exam = await Exam.findById(req.params.id);
    
    if (!exam) {
      return res.status(404).json({
        success: false,
        error: 'Exam not found',
      });
    }
    
    exam = await Exam.findByIdAndUpdate(
      req.params.id,
      {
        status: 'draft',
      },
      {
        new: true,
      }
    ).populate(['questionIds', 'classId', 'groupId', 'subjectId', 'chapterId', 'topicId']);
    
    res.status(200).json({
      success: true,
      data: exam,
      message: 'Exam unpublished successfully',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// @desc    Delete exam
// @route   DELETE /api/exams/:id
// @access  Private
exports.deleteExam = async (req, res) => {
  try {
    const exam = await Exam.findByIdAndDelete(req.params.id);
    
    if (!exam) {
      return res.status(404).json({
        success: false,
        error: 'Exam not found',
      });
    }
    // Also remove any exam results associated with this exam using the deleted exam's ObjectId
    try {
      const delRes = await ExamResult.deleteMany({ examId: exam._id });
      if (delRes && typeof delRes.deletedCount !== 'undefined') {
        console.log(`Deleted ${delRes.deletedCount} ExamResult(s) for exam ${String(exam._id)}`);
      }
    } catch (e) {
      // Log but don't fail the overall delete
      console.error('Failed to delete related exam results:', e);
    }
    
    res.status(200).json({
      success: true,
      data: {},
      message: 'Exam deleted successfully',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};
