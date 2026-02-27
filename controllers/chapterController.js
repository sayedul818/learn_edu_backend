const Chapter = require('../models/Chapter');

// @desc    Get all chapters or chapters by subjectId
// @route   GET /api/chapters?subjectId=
// @access  Public
exports.getAllChapters = async (req, res) => {
  try {
    const { subjectId } = req.query;
    const filter = subjectId ? { subjectId } : {};
    
    const chapters = await Chapter.find(filter)
      .populate('subjectId')
      .sort({ order: 1, createdAt: 1 });
    
    res.status(200).json({
      success: true,
      count: chapters.length,
      data: chapters,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// @desc    Get single chapter
// @route   GET /api/chapters/:id
// @access  Public
exports.getChapter = async (req, res) => {
  try {
    const chapter = await Chapter.findById(req.params.id).populate('subjectId');
    
    if (!chapter) {
      return res.status(404).json({
        success: false,
        error: 'Chapter not found',
      });
    }
    
    res.status(200).json({
      success: true,
      data: chapter,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// @desc    Create chapter
// @route   POST /api/chapters
// @access  Private
exports.createChapter = async (req, res) => {
  try {
    const { name, subjectId, description } = req.body;
    
    if (!name || !subjectId) {
      return res.status(400).json({
        success: false,
        error: 'Please provide name and subjectId',
      });
    }
    
    const newChapter = await Chapter.create({
      name,
      subjectId,
      description,
    });
    
    await newChapter.populate('subjectId');
    
    res.status(201).json({
      success: true,
      data: newChapter,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// @desc    Update chapter
// @route   PUT /api/chapters/:id
// @access  Private
exports.updateChapter = async (req, res) => {
  try {
    let chapter = await Chapter.findById(req.params.id);
    
    if (!chapter) {
      return res.status(404).json({
        success: false,
        error: 'Chapter not found',
      });
    }
    
    chapter = await Chapter.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    }).populate('subjectId');
    
    res.status(200).json({
      success: true,
      data: chapter,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// @desc    Delete chapter
// @route   DELETE /api/chapters/:id
// @access  Private
exports.deleteChapter = async (req, res) => {
  try {
    const chapter = await Chapter.findByIdAndDelete(req.params.id);
    
    if (!chapter) {
      return res.status(404).json({
        success: false,
        error: 'Chapter not found',
      });
    }
    
    res.status(200).json({
      success: true,
      data: {},
      message: 'Chapter deleted successfully',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};
