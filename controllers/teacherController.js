const User = require('../models/User');
const Enrollment = require('../models/Enrollment');
const ExamResult = require('../models/ExamResult');

function toObjectId(user) {
  return user?._id || user?.id || null;
}

function isAdmin(user) {
  return user && user.role === 'admin';
}

exports.listStudents = async (req, res) => {
  try {
    const { search, status } = req.query;
    const q = { role: 'student' };
    if (!isAdmin(req.user)) q.assignedTeacherId = toObjectId(req.user);
    if (status) q.status = status;
    if (search) {
      q.$or = [
        { name: new RegExp(search, 'i') },
        { email: new RegExp(search, 'i') },
      ];
    }

    const students = await User.find(q).select('-password').sort({ createdAt: -1 });
    const studentIds = students.map((s) => s._id);

    const [enrollAgg, resultAgg] = await Promise.all([
      Enrollment.aggregate([
        { $match: { studentId: { $in: studentIds } } },
        { $group: { _id: '$studentId', enrolledCourses: { $sum: 1 } } },
      ]),
      ExamResult.aggregate([
        { $match: { studentId: { $in: studentIds } } },
        {
          $group: {
            _id: '$studentId',
            examsGiven: { $sum: 1 },
            avgScore: { $avg: '$percentage' },
          },
        },
      ]),
    ]);

    const enrollmentMap = new Map(enrollAgg.map((r) => [String(r._id), r.enrolledCourses]));
    const resultMap = new Map(resultAgg.map((r) => [String(r._id), { examsGiven: r.examsGiven, avgScore: r.avgScore }]));

    const data = students.map((student) => {
      const resultInfo = resultMap.get(String(student._id)) || { examsGiven: 0, avgScore: 0 };
      return {
        ...student.toObject(),
        enrolledCourses: enrollmentMap.get(String(student._id)) || 0,
        examsGiven: resultInfo.examsGiven,
        averageScore: Number((resultInfo.avgScore || 0).toFixed(2)),
      };
    });

    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.createStudent = async (req, res) => {
  try {
    const { name, email, password, phone, class: className, group } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ success: false, error: 'name, email and password are required' });
    }

    const existing = await User.findOne({ email });
    if (existing) return res.status(409).json({ success: false, error: 'User already exists' });

    const student = await User.create({
      name,
      email,
      password,
      role: 'student',
      phone: phone || '',
      class: className || '',
      group: group || '',
      assignedTeacherId: isAdmin(req.user) && req.body.assignedTeacherId ? req.body.assignedTeacherId : toObjectId(req.user),
      status: 'active',
    });

    res.status(201).json({
      success: true,
      data: {
        id: student._id,
        name: student.name,
        email: student.email,
        role: student.role,
        phone: student.phone,
        class: student.class,
        group: student.group,
        assignedTeacherId: student.assignedTeacherId,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.updateStudent = async (req, res) => {
  try {
    const q = { _id: req.params.id, role: 'student' };
    if (!isAdmin(req.user)) q.assignedTeacherId = toObjectId(req.user);

    const student = await User.findOne(q);
    if (!student) return res.status(404).json({ success: false, error: 'Student not found' });

    const allowed = ['name', 'email', 'phone', 'class', 'group', 'avatar'];
    allowed.forEach((field) => {
      if (Object.prototype.hasOwnProperty.call(req.body, field)) {
        student[field] = req.body[field];
      }
    });

    await student.save();
    res.json({ success: true, data: student });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.changeStudentStatus = async (req, res) => {
  try {
    const q = { _id: req.params.id, role: 'student' };
    if (!isAdmin(req.user)) q.assignedTeacherId = toObjectId(req.user);

    const student = await User.findOne(q);
    if (!student) return res.status(404).json({ success: false, error: 'Student not found' });

    student.status = req.body.status === 'inactive' ? 'inactive' : 'active';
    await student.save();

    res.json({ success: true, data: { id: student._id, status: student.status } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.deleteStudent = async (req, res) => {
  try {
    const q = { _id: req.params.id, role: 'student' };
    if (!isAdmin(req.user)) q.assignedTeacherId = toObjectId(req.user);

    const student = await User.findOne(q);
    if (!student) return res.status(404).json({ success: false, error: 'Student not found' });

    await Enrollment.deleteMany({ studentId: student._id });
    await User.findByIdAndDelete(student._id);

    res.json({ success: true, data: { id: req.params.id } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};
