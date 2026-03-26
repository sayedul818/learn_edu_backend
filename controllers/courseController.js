const Course = require('../models/Course');
const Enrollment = require('../models/Enrollment');
const User = require('../models/User');
const Exam = require('../models/Exam');

function isAdmin(user) {
  return user && user.role === 'admin';
}

function toObjectId(user) {
  return user?._id || user?.id || null;
}

async function findOwnedCourse(courseId, user) {
  const filter = { _id: courseId };
  if (!isAdmin(user)) filter.ownerTeacherId = toObjectId(user);
  return Course.findOne(filter);
}

exports.listCourses = async (req, res) => {
  try {
    const { status, search } = req.query;
    const q = {};
    if (!isAdmin(req.user)) q.ownerTeacherId = toObjectId(req.user);
    if (status) q.status = status;
    if (search) q.title = new RegExp(search, 'i');

    const courses = await Course.find(q)
      .populate('ownerTeacherId', 'name email')
      .sort({ createdAt: -1 });

    const ids = courses.map((c) => c._id);
    const enrollmentAgg = await Enrollment.aggregate([
      { $match: { courseId: { $in: ids } } },
      { $group: { _id: '$courseId', totalStudents: { $sum: 1 } } },
    ]);
    const countMap = new Map(enrollmentAgg.map((r) => [String(r._id), r.totalStudents]));

    const data = courses.map((c) => ({
      ...c.toObject(),
      studentCount: countMap.get(String(c._id)) || 0,
    }));

    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.getCourse = async (req, res) => {
  try {
    const course = await findOwnedCourse(req.params.id, req.user);
    if (!course) return res.status(404).json({ success: false, error: 'Course not found' });

    const [students, exams] = await Promise.all([
      Enrollment.find({ courseId: course._id, ownerTeacherId: course.ownerTeacherId })
        .populate('studentId', 'name email phone status')
        .sort({ createdAt: -1 }),
      Exam.find({ _id: { $in: course.examIds || [] } }).select('title status totalMarks duration startDate endDate'),
    ]);

    res.json({
      success: true,
      data: {
        ...course.toObject(),
        students,
        exams,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.createCourse = async (req, res) => {
  try {
    const {
      title,
      description,
      thumbnail,
      price,
      duration,
      startDate,
      endDate,
      status,
    } = req.body;

    if (!title || !duration) {
      return res.status(400).json({ success: false, error: 'Title and duration are required' });
    }

    const course = await Course.create({
      title,
      description: description || '',
      thumbnail: thumbnail || '',
      price: price === '' || price === null || price === undefined ? null : Number(price),
      duration,
      startDate: startDate || null,
      endDate: endDate || null,
      status: status === 'published' ? 'published' : 'draft',
      ownerTeacherId: toObjectId(req.user),
    });

    res.status(201).json({ success: true, data: course });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.updateCourse = async (req, res) => {
  try {
    const course = await findOwnedCourse(req.params.id, req.user);
    if (!course) return res.status(404).json({ success: false, error: 'Course not found' });

    const allowedFields = ['title', 'description', 'thumbnail', 'price', 'duration', 'startDate', 'endDate', 'status'];
    allowedFields.forEach((field) => {
      if (Object.prototype.hasOwnProperty.call(req.body, field)) {
        if (field === 'price') {
          const value = req.body[field];
          course[field] = value === '' || value === null || value === undefined ? null : Number(value);
        } else {
          course[field] = req.body[field];
        }
      }
    });

    await course.save();
    res.json({ success: true, data: course });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.deleteCourse = async (req, res) => {
  try {
    const course = await findOwnedCourse(req.params.id, req.user);
    if (!course) return res.status(404).json({ success: false, error: 'Course not found' });

    await Enrollment.deleteMany({ courseId: course._id });
    await Course.findByIdAndDelete(course._id);

    res.json({ success: true, data: { id: req.params.id } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.listCourseStudents = async (req, res) => {
  try {
    const course = await findOwnedCourse(req.params.id, req.user);
    if (!course) return res.status(404).json({ success: false, error: 'Course not found' });

    const students = await Enrollment.find({ courseId: course._id })
      .populate('studentId', 'name email phone status assignedTeacherId')
      .sort({ createdAt: -1 });

    res.json({ success: true, data: students });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.addCourseStudent = async (req, res) => {
  try {
    const course = await findOwnedCourse(req.params.id, req.user);
    if (!course) return res.status(404).json({ success: false, error: 'Course not found' });

    const { studentId, enrollmentDate, status } = req.body;
    if (!studentId) return res.status(400).json({ success: false, error: 'studentId is required' });

    const student = await User.findOne({ _id: studentId, role: 'student' });
    if (!student) return res.status(404).json({ success: false, error: 'Student not found' });

    if (!isAdmin(req.user) && String(student.assignedTeacherId || '') !== String(toObjectId(req.user))) {
      return res.status(403).json({ success: false, error: 'You can only enroll your own students' });
    }

    const enrollment = await Enrollment.create({
      studentId,
      courseId: course._id,
      enrollmentDate: enrollmentDate || new Date(),
      status: status === 'pending' ? 'pending' : 'active',
      ownerTeacherId: course.ownerTeacherId,
    });

    await enrollment.populate('studentId', 'name email phone status');
    res.status(201).json({ success: true, data: enrollment });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ success: false, error: 'Student is already enrolled in this course' });
    }
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.removeCourseStudent = async (req, res) => {
  try {
    const course = await findOwnedCourse(req.params.id, req.user);
    if (!course) return res.status(404).json({ success: false, error: 'Course not found' });

    const deleted = await Enrollment.findOneAndDelete({
      courseId: course._id,
      studentId: req.params.studentId,
      ownerTeacherId: course.ownerTeacherId,
    });

    if (!deleted) return res.status(404).json({ success: false, error: 'Enrollment not found' });

    res.json({ success: true, data: { id: deleted._id } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.linkCourseExam = async (req, res) => {
  try {
    const course = await findOwnedCourse(req.params.id, req.user);
    if (!course) return res.status(404).json({ success: false, error: 'Course not found' });

    const { examId } = req.body;
    if (!examId) return res.status(400).json({ success: false, error: 'examId is required' });

    const exam = await Exam.findById(examId);
    if (!exam) return res.status(404).json({ success: false, error: 'Exam not found' });

    if (!course.examIds.some((id) => String(id) === String(examId))) {
      course.examIds.push(examId);
      await course.save();
    }

    res.json({ success: true, data: course.examIds });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.unlinkCourseExam = async (req, res) => {
  try {
    const course = await findOwnedCourse(req.params.id, req.user);
    if (!course) return res.status(404).json({ success: false, error: 'Course not found' });

    course.examIds = (course.examIds || []).filter((id) => String(id) !== String(req.params.examId));
    await course.save();

    res.json({ success: true, data: course.examIds });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.addMaterial = async (req, res) => {
  try {
    const course = await findOwnedCourse(req.params.id, req.user);
    if (!course) return res.status(404).json({ success: false, error: 'Course not found' });

    const { title, url, type } = req.body;
    if (!title || !url) return res.status(400).json({ success: false, error: 'title and url are required' });

    course.materials.push({ title, url, type: type || 'link' });
    await course.save();

    res.status(201).json({ success: true, data: course.materials[course.materials.length - 1] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.removeMaterial = async (req, res) => {
  try {
    const course = await findOwnedCourse(req.params.id, req.user);
    if (!course) return res.status(404).json({ success: false, error: 'Course not found' });

    course.materials = (course.materials || []).filter((m) => String(m._id) !== String(req.params.materialId));
    await course.save();

    res.json({ success: true, data: course.materials });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.addAnnouncement = async (req, res) => {
  try {
    const course = await findOwnedCourse(req.params.id, req.user);
    if (!course) return res.status(404).json({ success: false, error: 'Course not found' });

    const { message } = req.body;
    if (!message) return res.status(400).json({ success: false, error: 'message is required' });

    course.announcements.push({ message });
    await course.save();

    res.status(201).json({ success: true, data: course.announcements[course.announcements.length - 1] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.removeAnnouncement = async (req, res) => {
  try {
    const course = await findOwnedCourse(req.params.id, req.user);
    if (!course) return res.status(404).json({ success: false, error: 'Course not found' });

    course.announcements = (course.announcements || []).filter((a) => String(a._id) !== String(req.params.announcementId));
    await course.save();

    res.json({ success: true, data: course.announcements });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};
