const ExamResult = require('../models/ExamResult');
const User = require('../models/User');
const Exam = require('../models/Exam');

// GET /api/admin/reports/students
async function getStudentsSummary(req, res) {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 50);
    const skip = (page - 1) * limit;
    const search = req.query.q ? String(req.query.q).trim() : null;

    const matchStage = {};

    // basic aggregation grouping by student
    const pipeline = [
      { $match: matchStage },
      {
        $group: {
          _id: '$studentId',
          examsTaken: { $sum: 1 },
          avgPercentage: { $avg: { $ifNull: ['$percentage', 0] } },
          bestPercentage: { $max: { $ifNull: ['$percentage', 0] } },
          avgScore: { $avg: { $ifNull: ['$score', 0] } },
          lastTaken: { $max: '$submittedAt' },
        }
      },
      { $sort: { avgPercentage: -1, examsTaken: -1 } },
      { $skip: skip },
      { $limit: limit },
      // lookup user
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'user'
        }
      },
      { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          studentId: '$_id',
          examsTaken: 1,
          avgPercentage: { $round: ['$avgPercentage', 2] },
          bestPercentage: { $round: ['$bestPercentage', 2] },
          avgScore: { $round: ['$avgScore', 2] },
          lastTaken: 1,
          name: '$user.name',
          email: '$user.email',
          class: '$user.class',
          group: '$user.group',
          status: '$user.status'
        }
      }
    ];

    // if search provided, we will fetch ids matching user search first
    if (search) {
      const users = await User.find({ $or: [{ name: { $regex: search, $options: 'i' } }, { email: { $regex: search, $options: 'i' } }] }).select('_id').lean();
      const ids = users.map(u => u._id);
      if (ids.length === 0) return res.json({ data: [], page, limit, total: 0 });
      pipeline.unshift({ $match: { studentId: { $in: ids } } });
    }

    const results = await ExamResult.aggregate(pipeline).allowDiskUse(true);

    // get total count (separate aggregation)
    const countPipeline = [];
    if (search) {
      const users = await User.find({ $or: [{ name: { $regex: search, $options: 'i' } }, { email: { $regex: search, $options: 'i' } }] }).select('_id').lean();
      const ids = users.map(u => u._id);
      if (ids.length === 0) return res.json({ data: [], page, limit, total: 0 });
      countPipeline.push({ $match: { studentId: { $in: ids } } });
    }
    countPipeline.push({ $group: { _id: '$studentId' } }, { $count: 'total' });
    const countRes = await ExamResult.aggregate(countPipeline);
    const total = countRes[0] ? countRes[0].total : 0;

    res.json({ data: results, page, limit, total });
  } catch (err) {
    console.error('adminReports.getStudentsSummary error', err);
    res.status(500).json({ error: 'Failed to get students summary' });
  }
}

// GET /api/admin/reports/students/:id
async function getStudentDetail(req, res) {
  try {
    const studentId = req.params.id;
    const student = await User.findById(studentId).select('name email class group phone status').lean();
    if (!student) return res.status(404).json({ error: 'Student not found' });

    const results = await ExamResult.find({ studentId }).populate({ path: 'examId', select: 'title totalMarks startDate' }).sort({ submittedAt: -1 }).lean();

    const detail = results.map(r => ({
      resultId: r._id,
      examId: r.examId?._id,
      examTitle: r.examId? r.examId.title : 'Unknown',
      score: r.score,
      totalMarks: r.totalMarks,
      percentage: r.percentage,
      submittedAt: r.submittedAt,
      timeTaken: r.timeTaken,
      pendingEvaluation: r.pendingEvaluation,
    }));

    res.json({ student, results: detail });
  } catch (err) {
    console.error('adminReports.getStudentDetail error', err);
    res.status(500).json({ error: 'Failed to get student detail' });
  }
}

module.exports = { getStudentsSummary, getStudentDetail };
