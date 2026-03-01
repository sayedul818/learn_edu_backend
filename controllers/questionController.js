const Question = require('../models/Question');

// @desc    Get all questions with filters
// @route   GET /api/questions?subjectId=&chapterId=&topicId=&search=&difficulty=&questionType=
// @access  Public
exports.getAllQuestions = async (req, res) => {
  try {
    const { subjectId, chapterId, topicId, search, difficulty, questionType } = req.query;
    const filter = {};
    
    if (subjectId) filter.subjectId = subjectId;
    if (chapterId) filter.chapterId = chapterId;
    if (topicId) filter.topicId = topicId;
    if (difficulty) filter.difficulty = difficulty;
    if (questionType) filter.questionType = questionType;
    
    if (search) {
      filter.$or = [
        { questionTextEn: { $regex: search, $options: 'i' } },
        { questionTextBn: { $regex: search, $options: 'i' } },
      ];
    }
    
    const questions = await Question.find(filter)
      .populate('subjectId')
      .populate('chapterId')
      .populate('topicId')
      .populate('examTypeId')
      .sort({ createdAt: -1 });
    
    res.status(200).json({
      success: true,
      count: questions.length,
      data: questions,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// @desc    Get single question
// @route   GET /api/questions/:id
// @access  Public
exports.getQuestion = async (req, res) => {
  try {
    const question = await Question.findById(req.params.id)
      .populate('subjectId')
      .populate('chapterId')
      .populate('topicId')
      .populate('examTypeId');
    
    if (!question) {
      return res.status(404).json({
        success: false,
        error: 'Question not found',
      });
    }
    
    res.status(200).json({
      success: true,
      data: question,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// @desc    Create single question
// @route   POST /api/questions
// @access  Private
exports.createQuestion = async (req, res) => {
  try {
    const { questionTextEn, questionTextBn, options, explanation, subjectId, chapterId, topicId, difficulty, questionType, tags, subQuestions } = req.body;

    // basic required refs
    if (!subjectId || !chapterId) {
      return res.status(400).json({ success: false, error: 'Please provide subjectId and chapterId' });
    }

    const qType = (questionType || 'MCQ').toUpperCase();

    // MCQ validation
    if (qType === 'MCQ') {
      if (!questionTextEn && !questionTextBn) {
        return res.status(400).json({ success: false, error: 'Please provide question text (questionTextEn or questionTextBn) for MCQ' });
      }

      if (!Array.isArray(options) || options.length < 2) {
        return res.status(400).json({ success: false, error: 'MCQ must have at least 2 options' });
      }

      const emptyOpt = options.find((o) => !o || !o.text || String(o.text).trim() === '');
      if (emptyOpt) {
        return res.status(400).json({ success: false, error: 'All MCQ options must have non-empty text' });
      }
    }

    // CQ validation (comprehension questions with sub-questions)
    if (qType === 'CQ') {
      const hasPassage = !!(questionTextBn || questionTextEn);
      const hasSubQuestions = Array.isArray(subQuestions) && subQuestions.length > 0;

      // require either a passage or at least one valid subQuestion
      if (!hasPassage && !hasSubQuestions) {
        return res.status(400).json({ success: false, error: 'Please provide either a passage (questionTextBn/questionTextEn) or at least one subQuestion for CQ' });
      }

      // If subQuestions are provided, normalize and validate minimal fields (label + questionText)
      if (hasSubQuestions) {
        for (let i = 0; i < subQuestions.length; i++) {
          const sq = subQuestions[i] = { ...(subQuestions[i] || {}) };
          // map generic keys to explicit schema keys when present
          if (!sq.answerBn && sq.answer) sq.answerBn = sq.answer;
          if (!sq.questionTextBn && sq.questionText) sq.questionTextBn = sq.questionText;
          // normalize sub-question type (accept `type` or legacy `subQuestionType`)
          if (!sq.type && sq.subQuestionType) sq.type = sq.subQuestionType;

          if (!sq.label || !(sq.questionTextBn || sq.questionTextEn)) {
            return res.status(400).json({ success: false, error: `Each subQuestion must have 'label' and 'questionTextBn/questionTextEn' (problem at index ${i})` });
          }
        }
      }
    }

    const newQuestion = await Question.create({
      questionTextEn,
      questionTextBn,
      options,
      subQuestions,
      explanation,
      subjectId,
      chapterId,
      topicId,
      difficulty: difficulty || 'medium',
      questionType: qType,
      tags: tags || [],
    });
    
    await newQuestion.populate('subjectId');
    await newQuestion.populate('chapterId');
    await newQuestion.populate('topicId');
    await newQuestion.populate('examTypeId');
    
    res.status(201).json({
      success: true,
      data: newQuestion,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// @desc    Bulk import questions
// @route   POST /api/questions/bulk
// @access  Private
exports.bulkImportQuestions = async (req, res) => {
  try {
    const { questions } = req.body;
    
    if (!Array.isArray(questions)) {
      return res.status(400).json({
        success: false,
        error: 'Please provide array of questions',
      });
    }
    
    // Validate each question according to its type (MCQ or CQ)
    const isValidQuestion = (q) => {
      if (!q || !q.subjectId || !q.chapterId) return false;
      const qType = (q.questionType || 'MCQ').toUpperCase();
      if (qType === 'MCQ') {
        if (!(q.questionTextEn || q.questionTextBn)) return false;
        if (!Array.isArray(q.options) || q.options.length < 2) return false;
        if (q.options.some((o) => !o || !o.text || String(o.text).trim() === '')) return false;
        return true;
      }
      if (qType === 'CQ') {
        const hasPassage = !!(q.questionTextEn || q.questionTextBn);
        const hasSub = Array.isArray(q.subQuestions) && q.subQuestions.length > 0;
        if (!hasPassage && !hasSub) return false;
        if (hasSub) {
          for (const sq of q.subQuestions) {
            if (!sq || !sq.label || !(sq.questionTextBn || sq.questionTextEn)) return false;
          }
        }
        return true;
      }
      return false;
    };

    const validQuestions = questions.filter(isValidQuestion);

    if (validQuestions.length === 0) {
      return res.status(400).json({ success: false, error: 'No valid questions provided (check MCQ/CQ structure and required fields)' });
    }
    
    // Set default values for optional fields
    // Normalize subQuestions for CQ items and set defaults
    const questionsToInsert = validQuestions.map((q) => {
      const normalized = {
        ...q,
        difficulty: q.difficulty || 'medium',
        questionType: (q.questionType || 'MCQ').toUpperCase(),
        tags: q.tags || [],
      };

      if (normalized.questionType === 'CQ' && Array.isArray(normalized.subQuestions)) {
        normalized.subQuestions = normalized.subQuestions.map((sq) => {
          const s = { ...(sq || {}) };
          if (!s.answerBn && s.answer) s.answerBn = s.answer;
          if (!s.questionTextBn && s.questionText) s.questionTextBn = s.questionText;
          if (!s.type && s.subQuestionType) s.type = s.subQuestionType;
          return s;
        });
      }

      return normalized;
    });
    
    const insertedQuestions = await Question.insertMany(questionsToInsert);
    
    // Populate references for all inserted questions
    const populatedQuestions = await Question.find({
      _id: { $in: insertedQuestions.map((q) => q._id) },
    })
      .populate('subjectId')
      .populate('chapterId')
      .populate('topicId')
      .populate('examTypeId');
    
    res.status(201).json({
      success: true,
      count: populatedQuestions.length,
      data: populatedQuestions,
      message: `${populatedQuestions.length} questions imported successfully`,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// @desc    Update question
// @route   PUT /api/questions/:id
// @access  Private
exports.updateQuestion = async (req, res) => {
  try {
    let question = await Question.findById(req.params.id);
    
    if (!question) {
      return res.status(404).json({
        success: false,
        error: 'Question not found',
      });
    }
    
    question = await Question.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    })
      .populate('subjectId')
      .populate('chapterId')
      .populate('topicId')
      .populate('examTypeId');
    
    res.status(200).json({
      success: true,
      data: question,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// @desc    Delete question
// @route   DELETE /api/questions/:id
// @access  Private
exports.deleteQuestion = async (req, res) => {
  try {
    const question = await Question.findByIdAndDelete(req.params.id);
    
    if (!question) {
      return res.status(404).json({
        success: false,
        error: 'Question not found',
      });
    }
    
    res.status(200).json({
      success: true,
      data: {},
      message: 'Question deleted successfully',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};
