const ExamType = require('../models/ExamType');

// @desc    Get all exam types with filters
// @route   GET /api/exam-types?category=&search=
// @access  Public
exports.getAllExamTypes = async (req, res) => {
  try {
    const { category, search } = req.query;
    const filter = {};

    if (category) filter.examCategory = category;

    if (search) {
      filter.$or = [
        { examName: { $regex: search, $options: 'i' } },
      ];
    }

    const examTypes = await ExamType.find(filter).sort({ year: -1, examName: 1 });

    res.status(200).json({
      success: true,
      count: examTypes.length,
      data: examTypes,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// @desc    Get single exam type
// @route   GET /api/exam-types/:id
// @access  Public
exports.getExamType = async (req, res) => {
  try {
    const examType = await ExamType.findById(req.params.id);

    if (!examType) {
      return res.status(404).json({
        success: false,
        error: 'Exam type not found',
      });
    }

    res.status(200).json({
      success: true,
      data: examType,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// @desc    Create exam type
// @route   POST /api/exam-types
// @access  Private
exports.createExamType = async (req, res) => {
  try {
    const { examCategory, examName, year } = req.body;

    if (!examCategory || !examName || !year) {
      return res.status(400).json({
        success: false,
        error: 'Please provide all required fields: examCategory, examName, year',
      });
    }

    const newExamType = await ExamType.create({
      examCategory,
      examName,
      year,
    });

    res.status(201).json({
      success: true,
      data: newExamType,
      message: 'Exam type created successfully',
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        error: 'This exam type already exists',
      });
    }
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// @desc    Update exam type
// @route   PUT /api/exam-types/:id
// @access  Private
exports.updateExamType = async (req, res) => {
  try {
    let examType = await ExamType.findById(req.params.id);

    if (!examType) {
      return res.status(404).json({
        success: false,
        error: 'Exam type not found',
      });
    }

    examType = await ExamType.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    res.status(200).json({
      success: true,
      data: examType,
      message: 'Exam type updated successfully',
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        error: 'This exam type already exists',
      });
    }
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// @desc    Delete exam type
// @route   DELETE /api/exam-types/:id
// @access  Private
exports.deleteExamType = async (req, res) => {
  try {
    const examType = await ExamType.findByIdAndDelete(req.params.id);

    if (!examType) {
      return res.status(404).json({
        success: false,
        error: 'Exam type not found',
      });
    }

    res.status(200).json({
      success: true,
      data: examType,
      message: 'Exam type deleted successfully',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};
