const Subject = require('../models/Subject');

// @desc    Get all subjects or subjects by groupId
// @route   GET /api/subjects?groupId=
// @access  Public
exports.getAllSubjects = async (req, res) => {
  try {
    const { groupId } = req.query;
    const filter = groupId ? { groupId } : {};
    
    const subjects = await Subject.find(filter)
      .populate('groupId')
      .sort({ order: 1, createdAt: 1 });
    
    res.status(200).json({
      success: true,
      count: subjects.length,
      data: subjects,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// @desc    Get single subject
// @route   GET /api/subjects/:id
// @access  Public
exports.getSubject = async (req, res) => {
  try {
    const subject = await Subject.findById(req.params.id).populate('groupId');
    
    if (!subject) {
      return res.status(404).json({
        success: false,
        error: 'Subject not found',
      });
    }
    
    res.status(200).json({
      success: true,
      data: subject,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// @desc    Create subject
// @route   POST /api/subjects
// @access  Private
exports.createSubject = async (req, res) => {
  try {
    const { name, groupId, description } = req.body;
    
    if (!name || !groupId) {
      return res.status(400).json({
        success: false,
        error: 'Please provide name and groupId',
      });
    }
    
    const newSubject = await Subject.create({
      name,
      groupId,
      description,
    });
    
    await newSubject.populate('groupId');
    
    res.status(201).json({
      success: true,
      data: newSubject,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// @desc    Update subject
// @route   PUT /api/subjects/:id
// @access  Private
exports.updateSubject = async (req, res) => {
  try {
    let subject = await Subject.findById(req.params.id);
    
    if (!subject) {
      return res.status(404).json({
        success: false,
        error: 'Subject not found',
      });
    }
    
    subject = await Subject.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    }).populate('groupId');
    
    res.status(200).json({
      success: true,
      data: subject,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// @desc    Delete subject
// @route   DELETE /api/subjects/:id
// @access  Private
exports.deleteSubject = async (req, res) => {
  try {
    const subject = await Subject.findByIdAndDelete(req.params.id);
    
    if (!subject) {
      return res.status(404).json({
        success: false,
        error: 'Subject not found',
      });
    }
    
    res.status(200).json({
      success: true,
      data: {},
      message: 'Subject deleted successfully',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};
