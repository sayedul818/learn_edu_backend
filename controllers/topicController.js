const Topic = require('../models/Topic');

// @desc    Get all topics or topics by chapterId
// @route   GET /api/topics?chapterId=
// @access  Public
exports.getAllTopics = async (req, res) => {
  try {
    const { chapterId } = req.query;
    const filter = chapterId ? { chapterId } : {};
    
    const topics = await Topic.find(filter)
      .populate('chapterId')
      .sort({ order: 1, createdAt: 1 });
    
    res.status(200).json({
      success: true,
      count: topics.length,
      data: topics,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// @desc    Get single topic
// @route   GET /api/topics/:id
// @access  Public
exports.getTopic = async (req, res) => {
  try {
    const topic = await Topic.findById(req.params.id).populate('chapterId');
    
    if (!topic) {
      return res.status(404).json({
        success: false,
        error: 'Topic not found',
      });
    }
    
    res.status(200).json({
      success: true,
      data: topic,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// @desc    Create topic
// @route   POST /api/topics
// @access  Private
exports.createTopic = async (req, res) => {
  try {
    const { name, chapterId, description } = req.body;
    
    if (!name || !chapterId) {
      return res.status(400).json({
        success: false,
        error: 'Please provide name and chapterId',
      });
    }
    
    const newTopic = await Topic.create({
      name,
      chapterId,
      description,
    });
    
    await newTopic.populate('chapterId');
    
    res.status(201).json({
      success: true,
      data: newTopic,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// @desc    Update topic
// @route   PUT /api/topics/:id
// @access  Private
exports.updateTopic = async (req, res) => {
  try {
    let topic = await Topic.findById(req.params.id);
    
    if (!topic) {
      return res.status(404).json({
        success: false,
        error: 'Topic not found',
      });
    }
    
    topic = await Topic.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    }).populate('chapterId');
    
    res.status(200).json({
      success: true,
      data: topic,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// @desc    Delete topic
// @route   DELETE /api/topics/:id
// @access  Private
exports.deleteTopic = async (req, res) => {
  try {
    const topic = await Topic.findByIdAndDelete(req.params.id);
    
    if (!topic) {
      return res.status(404).json({
        success: false,
        error: 'Topic not found',
      });
    }
    
    res.status(200).json({
      success: true,
      data: {},
      message: 'Topic deleted successfully',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};
