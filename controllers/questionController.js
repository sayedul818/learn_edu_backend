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
    const { questionTextEn, questionTextBn, options, explanation, subjectId, chapterId, topicId, difficulty, questionType, tags } = req.body;
    
    if (!questionTextEn || !options || !subjectId || !chapterId || !topicId) {
      return res.status(400).json({
        success: false,
        error: 'Please provide required fields',
      });
    }
    
    if (!Array.isArray(options) || options.length < 2) {
      return res.status(400).json({
        success: false,
        error: 'Question must have at least 2 options',
      });
    }
    
    const newQuestion = await Question.create({
      questionTextEn,
      questionTextBn,
      options,
      explanation,
      subjectId,
      chapterId,
      topicId,
      difficulty: difficulty || 'medium',
      questionType: questionType || 'MCQ',
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
    
    // Validate each question
    const validQuestions = questions.filter((q) => {
      return q.questionTextEn && q.options && q.subjectId && q.chapterId && q.topicId;
    });
    
    if (validQuestions.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No valid questions provided',
      });
    }
    
    // Set default values for optional fields
    const questionsToInsert = validQuestions.map((q) => ({
      ...q,
      difficulty: q.difficulty || 'medium',
      questionType: q.questionType || 'MCQ',
      tags: q.tags || [],
    }));
    
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
