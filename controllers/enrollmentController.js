const Enrollment = require('../models/Enrollment');

function toObjectId(user) {
  return user?._id || user?.id || null;
}

function isAdmin(user) {
  return user && user.role === 'admin';
}

exports.listEnrollments = async (req, res) => {
  try {
    const { status, courseId, studentId } = req.query;
    const q = {};
    if (!isAdmin(req.user)) q.ownerTeacherId = toObjectId(req.user);
    if (status) q.status = status;
    if (courseId) q.courseId = courseId;
    if (studentId) q.studentId = studentId;

    const enrollments = await Enrollment.find(q)
      .populate('studentId', 'name email phone status')
      .populate('courseId', 'title status duration startDate endDate')
      .sort({ createdAt: -1 });

    res.json({ success: true, data: enrollments });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.updateEnrollment = async (req, res) => {
  try {
    const q = { _id: req.params.id };
    if (!isAdmin(req.user)) q.ownerTeacherId = toObjectId(req.user);

    const enrollment = await Enrollment.findOne(q);
    if (!enrollment) return res.status(404).json({ success: false, error: 'Enrollment not found' });

    if (req.body.status) {
      enrollment.status = req.body.status === 'pending' ? 'pending' : 'active';
    }
    if (req.body.enrollmentDate) {
      enrollment.enrollmentDate = req.body.enrollmentDate;
    }

    await enrollment.save();
    await enrollment.populate('studentId', 'name email phone status');
    await enrollment.populate('courseId', 'title status');

    res.json({ success: true, data: enrollment });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.deleteEnrollment = async (req, res) => {
  try {
    const q = { _id: req.params.id };
    if (!isAdmin(req.user)) q.ownerTeacherId = toObjectId(req.user);

    const deleted = await Enrollment.findOneAndDelete(q);
    if (!deleted) return res.status(404).json({ success: false, error: 'Enrollment not found' });

    res.json({ success: true, data: { id: req.params.id } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};
