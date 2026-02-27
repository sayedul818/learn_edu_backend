const Group = require('../models/Group');

// @desc    Get all groups or groups by classId
// @route   GET /api/groups?classId=
// @access  Public
exports.getAllGroups = async (req, res) => {
  try {
    const { classId } = req.query;
    const filter = classId ? { classId } : {};
    
    const groups = await Group.find(filter)
      .populate('classId')
      .sort({ order: 1, createdAt: 1 });
    
    res.status(200).json({
      success: true,
      count: groups.length,
      data: groups,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// @desc    Get single group
// @route   GET /api/groups/:id
// @access  Public
exports.getGroup = async (req, res) => {
  try {
    const group = await Group.findById(req.params.id).populate('classId');
    
    if (!group) {
      return res.status(404).json({
        success: false,
        error: 'Group not found',
      });
    }
    
    res.status(200).json({
      success: true,
      data: group,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// @desc    Create group
// @route   POST /api/groups
// @access  Private
exports.createGroup = async (req, res) => {
  try {
    const { name, classId, description } = req.body;
    
    if (!name || !classId) {
      return res.status(400).json({
        success: false,
        error: 'Please provide name and classId',
      });
    }
    
    const newGroup = await Group.create({
      name,
      classId,
      description,
    });
    
    await newGroup.populate('classId');
    
    res.status(201).json({
      success: true,
      data: newGroup,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// @desc    Update group
// @route   PUT /api/groups/:id
// @access  Private
exports.updateGroup = async (req, res) => {
  try {
    let group = await Group.findById(req.params.id);
    
    if (!group) {
      return res.status(404).json({
        success: false,
        error: 'Group not found',
      });
    }
    
    group = await Group.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    }).populate('classId');
    
    res.status(200).json({
      success: true,
      data: group,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// @desc    Delete group
// @route   DELETE /api/groups/:id
// @access  Private
exports.deleteGroup = async (req, res) => {
  try {
    const group = await Group.findByIdAndDelete(req.params.id);
    
    if (!group) {
      return res.status(404).json({
        success: false,
        error: 'Group not found',
      });
    }
    
    res.status(200).json({
      success: true,
      data: {},
      message: 'Group deleted successfully',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};
