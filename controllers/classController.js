const Class = require('../models/Class');

// @desc    Get all classes
// @route   GET /api/classes
// @access  Public
exports.getAllClasses = async (req, res) => {
  try {
    const classes = await Class.find().sort({ order: 1, createdAt: 1 });
    
    res.status(200).json({
      success: true,
      count: classes.length,
      data: classes,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// @desc    Get single class
// @route   GET /api/classes/:id
// @access  Public
exports.getClass = async (req, res) => {
  try {
    const classItem = await Class.findById(req.params.id);
    
    if (!classItem) {
      return res.status(404).json({
        success: false,
        error: 'Class not found',
      });
    }
    
    res.status(200).json({
      success: true,
      data: classItem,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// @desc    Create class
// @route   POST /api/classes
// @access  Private
exports.createClass = async (req, res) => {
  try {
    const { name, description } = req.body;
    
    if (!name) {
      return res.status(400).json({
        success: false,
        error: 'Please provide class name',
      });
    }
    
    const newClass = await Class.create({
      name,
      description,
    });
    
    res.status(201).json({
      success: true,
      data: newClass,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        error: 'Class name already exists',
      });
    }
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// @desc    Update class
// @route   PUT /api/classes/:id
// @access  Private
exports.updateClass = async (req, res) => {
  try {
    let classItem = await Class.findById(req.params.id);
    
    if (!classItem) {
      return res.status(404).json({
        success: false,
        error: 'Class not found',
      });
    }
    
    classItem = await Class.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    
    res.status(200).json({
      success: true,
      data: classItem,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// @desc    Delete class
// @route   DELETE /api/classes/:id
// @access  Private
exports.deleteClass = async (req, res) => {
  try {
    const classItem = await Class.findByIdAndDelete(req.params.id);
    
    if (!classItem) {
      return res.status(404).json({
        success: false,
        error: 'Class not found',
      });
    }
    
    res.status(200).json({
      success: true,
      data: {},
      message: 'Class deleted successfully',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};
