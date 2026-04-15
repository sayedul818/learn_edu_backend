const Question = require('../models/Question');

const toStringOrEmpty = (value) => (value == null ? '' : String(value).trim());

const parseArrayField = (value) => {
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string' || value.trim() === '') return [];

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const normalizeSubQuestion = (sq = {}, fallbackType = '') => {
  const normalized = { ...(sq || {}) };

  if (!normalized.answerBn && normalized.answer) normalized.answerBn = normalized.answer;
  if (!normalized.answerEn && normalized.answerTextEn) normalized.answerEn = normalized.answerTextEn;
  if (!normalized.questionTextBn && normalized.question) normalized.questionTextBn = normalized.question;
  if (!normalized.questionTextEn && normalized.questionEn) normalized.questionTextEn = normalized.questionEn;
  if (!normalized.questionTextBn && normalized.questionText) normalized.questionTextBn = normalized.questionText;
  if (!normalized.questionTextEn && normalized.questionTextEnglish) normalized.questionTextEn = normalized.questionTextEnglish;
  if (!normalized.question && normalized.questionTextBn) normalized.question = normalized.questionTextBn;
  if (!normalized.type && normalized.subQuestionType) normalized.type = normalized.subQuestionType;
  if (!normalized.type && fallbackType) normalized.type = fallbackType;

  return normalized;
};

const normalizeQuestionType = (value, hasSubQuestions = false) => {
  const normalized = toStringOrEmpty(value).toUpperCase();
  if (normalized === 'MCQ' || normalized === 'CQ') return normalized;
  return hasSubQuestions ? 'CQ' : 'MCQ';
};

// @desc    Get all questions with filters
// @route   GET /api/questions?subjectId=&chapterId=&topicId=&search=&difficulty=&questionType=
// @access  Public
exports.getAllQuestions = async (req, res) => {
  try {
    const { subjectId, chapterId, topicId, search, difficulty, questionType, boardYear } = req.query;
    const filter = {};
    
    if (subjectId) filter.subjectId = subjectId;
    if (chapterId) filter.chapterId = chapterId;
    if (topicId) filter.topicId = topicId;
    if (difficulty) filter.difficulty = difficulty;
    if (questionType) filter.questionType = questionType;
    if (boardYear) filter.boardYear = boardYear;
    
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
      .sort({ createdAt: 1, _id: 1 });
    
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
    const { questionTextEn, questionTextBn, image, options, explanation, subjectId, chapterId, topicId, difficulty, questionType, tags, subQuestions, boardYear } = req.body;
    const passageTextEn = toStringOrEmpty(questionTextEn || req.body.passageTextEn || req.body.passage || req.body.passage_text_en);
    const passageTextBn = toStringOrEmpty(questionTextBn || req.body.passageTextBn || req.body.passageTextBangla || req.body.passage_text_bn);
    const fallbackSubQuestionType = toStringOrEmpty(req.body.type);
    const rawSubQuestions = Array.isArray(subQuestions)
      ? subQuestions
      : parseArrayField(req.body.blanks || req.body.subQuestionsJson || req.body.cqSubQuestions);
    const normalizedSubQuestions = rawSubQuestions.map((sq) => normalizeSubQuestion(sq, fallbackSubQuestionType));

    // basic required refs
    if (!subjectId || !chapterId) {
      return res.status(400).json({ success: false, error: 'Please provide subjectId and chapterId' });
    }

    const qType = normalizeQuestionType(questionType || req.body.question_type || req.body.qType || req.body.type, normalizedSubQuestions.length > 0);

    // MCQ validation
    if (qType === 'MCQ') {
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
      const hasPassage = !!(passageTextBn || passageTextEn);
      const hasSubQuestions = Array.isArray(normalizedSubQuestions) && normalizedSubQuestions.length > 0;

      // require either a passage or at least one valid subQuestion
      if (!hasPassage && !hasSubQuestions) {
        return res.status(400).json({ success: false, error: 'Please provide either a passage (questionTextBn/questionTextEn) or at least one subQuestion for CQ' });
      }

      // Sub-question fields are optional. Keep only the parent-level CQ guard above
      // (requires either a passage or at least one subQuestion object).
    }

    const newQuestion = await Question.create({
      questionTextEn: passageTextEn,
      questionTextBn: passageTextBn,
      image,
      options,
      subQuestions: normalizedSubQuestions,
      explanation,
      subjectId,
      chapterId,
      topicId,
      difficulty: difficulty || 'medium',
      questionType: qType,
      boardYear: boardYear || req.body.board || '',
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
    const { questions, dryRun = false, continueOnError = true } = req.body;
    
    if (!Array.isArray(questions)) {
      return res.status(400).json({
        success: false,
        error: 'Please provide array of questions',
      });
    }
    
    const normalizeQuestion = (q = {}) => {
      const subQuestionsSource = parseArrayField(q.subQuestions || q.blanks || q.subQuestionsJson || q.cqSubQuestions);
      const normalized = {
        ...q,
        difficulty: q.difficulty || 'medium',
        questionTextEn: toStringOrEmpty(q.questionTextEn || q.passageTextEn || q.passage || q.passageText || q.passage_text_en),
        questionTextBn: toStringOrEmpty(q.questionTextBn || q.passageTextBn || q.passageTextBangla || q.passage_text_bn),
        questionType: normalizeQuestionType(q.questionType || q.question_type || q.qType || q.type, subQuestionsSource.length > 0),
        boardYear: toStringOrEmpty(q.boardYear || q.board || q.year),
        tags: Array.isArray(q.tags)
          ? q.tags.filter(Boolean)
          : (typeof q.tags === 'string' ? q.tags.split(',').map((t) => t.trim()).filter(Boolean) : []),
        subQuestions: subQuestionsSource.map((sq) => normalizeSubQuestion(sq, toStringOrEmpty(q.type))),
      };

      if (Array.isArray(normalized.options)) {
        normalized.options = normalized.options
          .map((o) => ({
            text: String(o?.text || '').trim(),
            isCorrect: Boolean(o?.isCorrect),
          }))
          .filter((o) => o.text !== '');
      }

      return normalized;
    };

    const validateQuestion = (q = {}) => {
      const errors = [];
      if (!q.subjectId) errors.push('subjectId is required');
      if (!q.chapterId) errors.push('chapterId is required');

      const qType = (q.questionType || 'MCQ').toUpperCase();
      if (qType !== 'MCQ' && qType !== 'CQ') {
        errors.push(`Unsupported questionType '${q.questionType}' for bulk import`);
        return errors;
      }

      if (qType === 'MCQ') {
        if (!Array.isArray(q.options) || q.options.length < 2) {
          errors.push('MCQ must have at least 2 options');
        } else if (q.options.some((o) => !o || !o.text || String(o.text).trim() === '')) {
          errors.push('All MCQ options must have non-empty text');
        }
      }

      if (qType === 'CQ') {
        const hasPassage = !!(q.questionTextEn || q.questionTextBn);
        const hasSub = Array.isArray(q.subQuestions) && q.subQuestions.length > 0;
        if (!hasPassage && !hasSub) {
          errors.push('CQ requires passage text or at least one subQuestion');
        }

        // Sub-question fields are optional for CQ imports.
      }

      return errors;
    };

    const normalizedRows = questions.map((q) => normalizeQuestion(q));
    const rejected = [];
    const accepted = [];

    normalizedRows.forEach((q, idx) => {
      const errors = validateQuestion(q);
      if (errors.length > 0) {
        rejected.push({ index: idx, errors });
      } else {
        accepted.push(q);
      }
    });

    if (!continueOnError && rejected.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed for one or more rows',
        importedCount: 0,
        rejectedCount: rejected.length,
        rejected,
      });
    }

    if (accepted.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No valid questions provided (check MCQ/CQ structure and required fields)',
        importedCount: 0,
        rejectedCount: rejected.length,
        rejected,
      });
    }

    if (dryRun) {
      return res.status(200).json({
        success: true,
        dryRun: true,
        importedCount: 0,
        validCount: accepted.length,
        rejectedCount: rejected.length,
        rejected,
        message: 'Dry run completed successfully',
      });
    }

    const insertedQuestions = await Question.insertMany(accepted);
    
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
      importedCount: populatedQuestions.length,
      validCount: accepted.length,
      rejectedCount: rejected.length,
      rejected,
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
