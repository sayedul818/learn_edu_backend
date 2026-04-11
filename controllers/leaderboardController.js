const ExamResult = require('../models/ExamResult');
const User = require('../models/User');

// @desc Get leaderboard
// @route GET /api/leaderboard?period=daily|weekly|monthly|all&month=YYYY-MM&start=ISO&end=ISO
// @access Public (but returns same regardless)
exports.getLeaderboard = async (req, res) => {
  try {
    const period = req.query.period || 'weekly';
    const month = typeof req.query.month === 'string' ? req.query.month.trim() : '';
    const startParam = typeof req.query.start === 'string' ? req.query.start.trim() : '';
    const endParam = typeof req.query.end === 'string' ? req.query.end.trim() : '';
    let match = {};
    const now = new Date();
    if (startParam && endParam) {
      const start = new Date(startParam);
      const end = new Date(endParam);
      if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime()) && start < end) {
        match.submittedAt = { $gte: start, $lt: end };
      }
    } else if (month) {
      const [yearStr, monthStr] = month.split('-');
      const year = Number(yearStr);
      const monthIndex = Number(monthStr) - 1;

      if (!Number.isNaN(year) && !Number.isNaN(monthIndex) && monthIndex >= 0 && monthIndex < 12) {
        const start = new Date(year, monthIndex, 1);
        const end = new Date(year, monthIndex + 1, 1);
        match.submittedAt = { $gte: start, $lt: end };
      }
    } else if (period === 'daily') {
      const since = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
      match.submittedAt = { $gte: since };
    } else if (period === 'weekly') {
      const since = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      match.submittedAt = { $gte: since };
    } else if (period === 'monthly') {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      match.submittedAt = { $gte: start, $lt: end };
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
          email: '$student.email',
          avatar: { $ifNull: ['$student.avatar', ''] }
      } }
    );

    const rows = await ExamResult.aggregate(pipeline).allowDiskUse(true);
    // attach ranks
    const result = rows.map((r, idx) => ({ rank: idx + 1, ...r }));
    res.json({
      success: true,
      data: result,
      period,
      month: month || null,
    });
  } catch (err) {
    console.error('Leaderboard error', err);
    res.status(500).json({ success: false, error: err.message });
  }
};
