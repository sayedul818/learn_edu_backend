const ExamResult = require('../models/ExamResult');
const User = require('../models/User');

// @desc Get leaderboard
// @route GET /api/leaderboard?period=daily|weekly|monthly|all
// @access Public (but returns same regardless)
exports.getLeaderboard = async (req, res) => {
  try {
    const period = req.query.period || 'weekly';
    let match = {};
    const now = new Date();
    if (period === 'daily') {
      const since = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
      match.submittedAt = { $gte: since };
    } else if (period === 'weekly') {
      const since = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      match.submittedAt = { $gte: since };
    } else if (period === 'monthly') {
      const since = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      match.submittedAt = { $gte: since };
    }

    const pipeline = [];
    if (match.submittedAt) pipeline.push({ $match: match });

    pipeline.push(
      { $group: {
          _id: '$studentId',
          totalScore: { $sum: '$score' },
          examsCompleted: { $sum: 1 },
          avgPercentage: { $avg: '$percentage' }
        }
      },
      { $sort: { totalScore: -1 } },
      { $limit: 200 },
      { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'student' } },
      { $unwind: { path: '$student', preserveNullAndEmptyArrays: true } },
      { $project: {
          studentId: '$_id',
          totalScore: 1,
          examsCompleted: 1,
          avgPercentage: { $round: ['$avgPercentage', 0] },
          name: { $ifNull: [ '$student.name', '$student.email' ] },
          email: '$student.email'
      } }
    );

    const rows = await ExamResult.aggregate(pipeline).allowDiskUse(true);
    // attach ranks
    const result = rows.map((r, idx) => ({ rank: idx + 1, ...r }));
    res.json({ success: true, data: result });
  } catch (err) {
    console.error('Leaderboard error', err);
    res.status(500).json({ success: false, error: err.message });
  }
};
