const Course = require('../models/Course');
const Enrollment = require('../models/Enrollment');
const User = require('../models/User');
const Exam = require('../models/Exam');
const ExamResult = require('../models/ExamResult');
const Question = require('../models/Question');
const Assignment = require('../models/Assignment');
const crypto = require('crypto');

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

function normalizeAnnouncementPayload(body, user, defaultStatus = 'published') {
  const title = String(body?.title || '').trim();
  const message = String(body?.message || '').trim();
  const attachments = Array.isArray(body?.attachments)
    ? body.attachments
        .filter((item) => item && item.url)
        .map((item) => ({
          name: String(item.name || '').trim(),
          url: String(item.url || '').trim(),
          type: ['pdf', 'image', 'video', 'link'].includes(String(item.type || '').toLowerCase())
            ? String(item.type).toLowerCase()
            : 'link',
        }))
    : [];

  const scope = ['all', 'batch', 'students'].includes(String(body?.audience?.scope || '').toLowerCase())
    ? String(body.audience.scope).toLowerCase()
    : 'all';

  const batches = Array.isArray(body?.audience?.batches)
    ? body.audience.batches.map((entry) => String(entry || '').trim()).filter(Boolean)
    : [];

  const studentIds = Array.isArray(body?.audience?.studentIds)
    ? body.audience.studentIds.map((id) => id).filter(Boolean)
    : [];

  const mode = String(body?.schedule?.mode || '').toLowerCase() === 'scheduled' ? 'scheduled' : 'now';
  const scheduledFor = body?.schedule?.scheduledFor ? new Date(body.schedule.scheduledFor) : null;

  const priority = ['normal', 'important', 'urgent'].includes(String(body?.priority || '').toLowerCase())
    ? String(body.priority).toLowerCase()
    : 'normal';

  const status = ['draft', 'published', 'scheduled'].includes(String(body?.status || '').toLowerCase())
    ? String(body.status).toLowerCase()
    : defaultStatus;

  const payload = {
    title,
    message,
    attachments,
    audience: { scope, batches, studentIds },
    schedule: {
      mode,
      scheduledFor: mode === 'scheduled' && scheduledFor && !Number.isNaN(scheduledFor.getTime()) ? scheduledFor : null,
    },
    priority,
    isPinned: Boolean(body?.isPinned),
    notification: {
      push: body?.notification?.push !== undefined ? Boolean(body.notification.push) : true,
      email: body?.notification?.email !== undefined ? Boolean(body.notification.email) : false,
      silent: body?.notification?.silent !== undefined ? Boolean(body.notification.silent) : false,
    },
    status,
    updatedAt: new Date(),
  };

  if (user) {
    payload.createdBy = {
      userId: toObjectId(user),
      name: String(user.name || ''),
    };
  }

  return payload;
}

function buildInviteCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const length = 5 + Math.floor(Math.random() * 4);
  const randomBytes = crypto.randomBytes(length);
  let code = '';
  for (let i = 0; i < length; i += 1) {
    code += alphabet[randomBytes[i] % alphabet.length];
  }
  return code;
}

async function generateUniqueInviteToken() {
  for (let i = 0; i < 5; i += 1) {
    const token = buildInviteCode();
    const exists = await Course.exists({ inviteToken: token });
    if (!exists) return token;
  }
  throw new Error('Unable to generate unique invite token');
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

    const studentIds = students.map((student) => student.studentId?._id).filter(Boolean);
    const examIds = (course.examIds || []).map(String);
    const performanceAgg = studentIds.length > 0 && examIds.length > 0
      ? await ExamResult.aggregate([
          { $match: { studentId: { $in: studentIds }, examId: { $in: course.examIds || [] } } },
          {
            $group: {
              _id: '$studentId',
              completedExams: { $sum: { $cond: [{ $ne: ['$score', null] }, 1, 0] } },
              averagePercentage: { $avg: '$percentage' },
              lastActivityAt: { $max: '$submittedAt' },
            },
          },
        ])
      : [];
    const performanceMap = new Map(performanceAgg.map((row) => [String(row._id), row]));

    const studentsWithPerformance = students.map((student) => {
      const studentId = String(student.studentId?._id || '');
      const summary = performanceMap.get(studentId);
      const averagePercentage = summary?.averagePercentage == null ? 0 : Math.round(summary.averagePercentage);
      const totalExams = examIds.length;
      const completedExams = summary?.completedExams || 0;
      const progressPercentage = totalExams > 0 ? Math.round((completedExams / totalExams) * 100) : 0;

      return {
        ...student.toObject(),
        progressPercentage,
        averagePercentage,
        completedExams,
        totalExams,
        lastActivityAt: summary?.lastActivityAt || student.enrollmentDate || student.createdAt,
      };
    });

    res.json({
      success: true,
      data: {
        ...course.toObject(),
        students: studentsWithPerformance,
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

    const normalizedStatus = ['active', 'pending', 'hold'].includes(String(status || '').toLowerCase())
      ? String(status).toLowerCase()
      : 'active';

    const enrollment = await Enrollment.create({
      studentId,
      courseId: course._id,
      enrollmentDate: enrollmentDate || new Date(),
      status: normalizedStatus,
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

exports.updateCourseStudentStatus = async (req, res) => {
  try {
    const course = await findOwnedCourse(req.params.id, req.user);
    if (!course) return res.status(404).json({ success: false, error: 'Course not found' });

    const nextStatus = String(req.body?.status || '').toLowerCase();
    if (!['active', 'pending', 'hold'].includes(nextStatus)) {
      return res.status(400).json({ success: false, error: 'status must be active, pending, or hold' });
    }

    const enrollment = await Enrollment.findOneAndUpdate(
      {
        courseId: course._id,
        studentId: req.params.studentId,
        ownerTeacherId: course.ownerTeacherId,
      },
      {
        $set: {
          status: nextStatus,
          enrollmentDate: nextStatus === 'active' ? new Date() : undefined,
        },
      },
      { new: true }
    ).populate('studentId', 'name email phone status avatar');

    if (!enrollment) return res.status(404).json({ success: false, error: 'Enrollment not found' });

    res.json({ success: true, data: enrollment });
  } catch (error) {
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

exports.generateCourseInviteLink = async (req, res) => {
  try {
    const course = await findOwnedCourse(req.params.id, req.user);
    if (!course) return res.status(404).json({ success: false, error: 'Course not found' });

    const hasModernCode = /^[A-Z0-9]{5,8}$/.test(String(course.inviteToken || '').toUpperCase());
    if (!course.inviteToken || !hasModernCode) {
      course.inviteToken = await generateUniqueInviteToken();
      course.inviteTokenCreatedAt = new Date();
      await course.save();
    }

    res.json({
      success: true,
      data: {
        courseId: course._id,
        token: course.inviteToken,
        joinPath: `/course-join/${course.inviteToken}`,
        inviteTokenCreatedAt: course.inviteTokenCreatedAt,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.joinCourseByToken = async (req, res) => {
  try {
    const token = (req.params.token || '').trim().toUpperCase();
    if (!token) return res.status(400).json({ success: false, error: 'token is required' });

    const userId = toObjectId(req.user);
    if (!userId) return res.status(401).json({ success: false, error: 'Not authenticated' });

    if (req.user?.role !== 'student') {
      return res.status(403).json({ success: false, error: 'Only students can join via invite link' });
    }

    const course = await Course.findOne({ inviteToken: token });
    if (!course) return res.status(404).json({ success: false, error: 'Invite link is invalid or expired' });

    const student = await User.findOne({ _id: userId, role: 'student' });
    if (!student) return res.status(404).json({ success: false, error: 'Student not found' });

    const existing = await Enrollment.findOne({ studentId: userId, courseId: course._id });
    if (existing) {
      const existingStatus = String(existing.status || 'pending').toLowerCase();
      if (existingStatus === 'active') {
        return res.json({
          success: true,
          data: {
            alreadyEnrolled: true,
            courseId: course._id,
            courseTitle: course.title,
            status: 'active',
          },
        });
      }

      if (existingStatus === 'pending') {
        return res.json({
          success: true,
          data: {
            alreadyRequested: true,
            courseId: course._id,
            courseTitle: course.title,
            status: 'pending',
          },
        });
      }

      existing.status = 'pending';
      await existing.save();
      return res.json({
        success: true,
        data: {
          requestSubmitted: true,
          courseId: course._id,
          courseTitle: course.title,
          status: 'pending',
        },
      });
    }

    const enrollment = await Enrollment.create({
      studentId: userId,
      courseId: course._id,
      enrollmentDate: new Date(),
      status: 'pending',
      ownerTeacherId: course.ownerTeacherId,
    });

    res.status(201).json({
      success: true,
      data: {
        requestSubmitted: true,
        enrollmentId: enrollment._id,
        courseId: course._id,
        courseTitle: course.title,
        status: 'pending',
      },
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.json({ success: true, data: { alreadyEnrolled: true } });
    }
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.listMyMaterials = async (req, res) => {
  try {
    const userId = toObjectId(req.user);
    if (!userId) return res.status(401).json({ success: false, error: 'Not authenticated' });

    if (req.user?.role !== 'student') {
      return res.status(403).json({ success: false, error: 'Only students can access course materials' });
    }

    const enrollments = await Enrollment.find({ studentId: userId, status: 'active' })
      .populate('courseId', 'title materials')
      .sort({ updatedAt: -1 });

    const data = enrollments
      .map((enrollment) => {
        const course = enrollment.courseId;
        if (!course) return null;
        const materials = Array.isArray(course.materials) ? course.materials : [];
        return {
          courseId: course._id,
          courseTitle: course.title,
          materials,
        };
      })
      .filter(Boolean);

    const totalMaterials = data.reduce((sum, row) => sum + (row.materials?.length || 0), 0);

    res.json({ success: true, data, totalMaterials });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

const getLeaderboardWindow = (timeRange = 'all') => {
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  const normalized = String(timeRange || 'all').toLowerCase();
  if (normalized === 'weekly') {
    return { currentStart: now - 7 * day, previousStart: now - 14 * day, previousEnd: now - 7 * day };
  }
  if (normalized === 'monthly') {
    return { currentStart: now - 30 * day, previousStart: now - 60 * day, previousEnd: now - 30 * day };
  }
  return { currentStart: null, previousStart: null, previousEnd: null };
};

const isInRange = (value, start = null, end = null) => {
  if (!value) return false;
  const ts = new Date(value).getTime();
  if (!Number.isFinite(ts)) return false;
  if (start != null && ts < start) return false;
  if (end != null && ts > end) return false;
  return true;
};

const computeCourseLeaderboardRows = ({
  students,
  examAttempts,
  assignmentDocs,
  scoreType,
  start,
  end,
}) => {
  const studentMap = new Map(
    (students || [])
      .map((entry) => {
        const student = entry.studentId;
        const studentId = String(student?._id || '');
        if (!studentId) return null;
        return [studentId, {
          studentId,
          studentName: String(student?.name || 'Student'),
          studentEmail: String(student?.email || ''),
          avatar: String(student?.avatar || ''),
        }];
      })
      .filter(Boolean)
  );

  const metrics = new Map();
  const ensure = (studentId) => {
    if (!metrics.has(studentId)) {
      metrics.set(studentId, {
        assignmentCount: 0,
        lateCount: 0,
        assignmentPercentages: [],
        examsById: new Set(),
        examPercentages: [],
        activityDays: new Set(),
      });
    }
    return metrics.get(studentId);
  };

  (examAttempts || []).forEach((attempt) => {
    const studentId = String(attempt.studentId?._id || attempt.studentId || '');
    if (!studentMap.has(studentId)) return;
    if (start != null && !isInRange(attempt.submittedAt, start, end)) return;
    const item = ensure(studentId);
    item.examsById.add(String(attempt.examId?._id || attempt.examId || ''));
    const percentage = Number(attempt.percentage);
    if (Number.isFinite(percentage)) item.examPercentages.push(percentage);
    if (attempt.submittedAt) item.activityDays.add(new Date(attempt.submittedAt).toISOString().slice(0, 10));
  });

  (assignmentDocs || []).forEach((assignment) => {
    const assignmentDueAt = assignment?.dueAt;
    const submissions = Array.isArray(assignment?.submissions) ? assignment.submissions : [];
    submissions.forEach((submission) => {
      const studentId = String(submission.studentId?._id || submission.studentId || '');
      if (!studentMap.has(studentId)) return;
      if (start != null && !isInRange(submission.submittedAt, start, end)) return;

      const item = ensure(studentId);
      item.assignmentCount += 1;
      const dueTs = assignmentDueAt ? new Date(assignmentDueAt).getTime() : null;
      const submittedTs = submission.submittedAt ? new Date(submission.submittedAt).getTime() : null;
      const isLate = Boolean(submission.isLate) || (Number.isFinite(dueTs) && Number.isFinite(submittedTs) && submittedTs > dueTs);
      if (isLate) item.lateCount += 1;
      if (submission.submittedAt) item.activityDays.add(new Date(submission.submittedAt).toISOString().slice(0, 10));

      const marks = Number(submission.marks);
      const totalMarks = Number(assignment.totalMarks || 0);
      if (Number.isFinite(marks) && totalMarks > 0) {
        item.assignmentPercentages.push(Math.max(0, Math.min(100, (marks / totalMarks) * 100)));
      }
    });
  });

  const totalAssignmentsInWindow = (() => {
    const source = assignmentDocs || [];
    const count = source.filter((assignment) => {
      if (start == null) return true;
      return isInRange(assignment?.dueAt || assignment?.createdAt, start, end);
    }).length;
    return count > 0 ? count : source.length;
  })();

  const rows = Array.from(studentMap.values()).map((student) => {
    const item = metrics.get(student.studentId);
    const assignmentCount = item?.assignmentCount || 0;
    const lateCount = item?.lateCount || 0;
    const examsGiven = item?.examsById?.size || 0;
    const examAccuracy = item?.examPercentages?.length
      ? item.examPercentages.reduce((sum, value) => sum + value, 0) / item.examPercentages.length
      : 0;
    const completionRate = totalAssignmentsInWindow > 0 ? assignmentCount / totalAssignmentsInWindow : 0;
    const assignmentAccuracy = item?.assignmentPercentages?.length
      ? item.assignmentPercentages.reduce((sum, value) => sum + value, 0) / item.assignmentPercentages.length
      : completionRate * 100;
    const weighted = examAccuracy * 0.7 + assignmentAccuracy * 0.3;
    const base = scoreType === 'exams' ? examAccuracy : scoreType === 'assignments' ? assignmentAccuracy : weighted;
    const consistencyDays = item?.activityDays?.size || 0;
    const bonus = Math.min(10, Number((consistencyDays * 1.5).toFixed(1)));
    const penalty = lateCount * 2;
    const score = Math.max(0, Number((base + bonus - penalty).toFixed(1)));
    const accuracy = scoreType === 'exams' ? examAccuracy : scoreType === 'assignments' ? assignmentAccuracy : weighted;

    return {
      ...student,
      completedAssignments: assignmentCount,
      examsGiven,
      accuracy: Number(accuracy.toFixed(1)),
      score,
      bonus,
      penalty,
      lateSubmissions: lateCount,
      consistencyDays,
      assignmentAccuracy: Number(assignmentAccuracy.toFixed(1)),
      examAccuracy: Number(examAccuracy.toFixed(1)),
      completionRate: Number((completionRate * 100).toFixed(1)),
      rank: 0,
    };
  });

  rows.sort((a, b) => b.score - a.score || b.accuracy - a.accuracy || a.studentName.localeCompare(b.studentName));
  rows.forEach((row, index) => {
    row.rank = index + 1;
  });
  return rows;
};

exports.listMyEnrolledCourses = async (req, res) => {
  try {
    const userId = toObjectId(req.user);
    if (!userId) return res.status(401).json({ success: false, error: 'Not authenticated' });
    if (req.user?.role !== 'student') {
      return res.status(403).json({ success: false, error: 'Only students can access enrolled courses' });
    }

    const enrollments = await Enrollment.find({ studentId: userId, status: 'active' })
      .populate('courseId', 'title ownerTeacherId examIds')
      .sort({ updatedAt: -1 });

    const teacherIds = enrollments.map((entry) => entry.courseId?.ownerTeacherId).filter(Boolean);
    const teachers = teacherIds.length > 0 ? await User.find({ _id: { $in: teacherIds } }).select('name') : [];
    const teacherMap = new Map(teachers.map((teacher) => [String(teacher._id), teacher]));

    const data = enrollments
      .map((entry) => {
        const course = entry.courseId;
        if (!course) return null;
        return {
          courseId: course._id,
          courseTitle: course.title,
          teacherName: teacherMap.get(String(course.ownerTeacherId || ''))?.name || 'Teacher',
          examIds: Array.isArray(course.examIds) ? course.examIds : [],
        };
      })
      .filter(Boolean);

    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.getCourseLeaderboard = async (req, res) => {
  try {
    const userId = toObjectId(req.user);
    if (!userId) return res.status(401).json({ success: false, error: 'Not authenticated' });

    const scoreType = ['overall', 'exams', 'assignments'].includes(String(req.query?.type || '').toLowerCase())
      ? String(req.query.type).toLowerCase()
      : 'overall';
    const timeRange = ['weekly', 'monthly', 'all'].includes(String(req.query?.timeRange || '').toLowerCase())
      ? String(req.query.timeRange).toLowerCase()
      : 'all';

    const course = await Course.findById(req.params.id).select('title ownerTeacherId examIds');
    if (!course) return res.status(404).json({ success: false, error: 'Course not found' });

    const isTeacherOwner = isAdmin(req.user) || String(course.ownerTeacherId || '') === String(userId);
    if (!isTeacherOwner) {
      const enrollment = await Enrollment.findOne({ studentId: userId, courseId: course._id, status: 'active' });
      if (!enrollment) return res.status(403).json({ success: false, error: 'Not enrolled in this course' });
    }

    const enrollments = await Enrollment.find({ courseId: course._id, status: 'active' })
      .populate('studentId', 'name email avatar')
      .sort({ createdAt: -1 });
    const studentIds = enrollments.map((entry) => entry.studentId?._id).filter(Boolean);

    const examIds = Array.isArray(course.examIds) ? course.examIds : [];
    const [examAttempts, assignmentDocs] = await Promise.all([
      examIds.length > 0 && studentIds.length > 0
        ? ExamResult.find({ examId: { $in: examIds }, studentId: { $in: studentIds } })
            .select('examId studentId percentage score submittedAt')
            .populate('studentId', 'name email avatar')
        : [],
      Assignment.find({ courseId: course._id, ownerTeacherId: course.ownerTeacherId })
        .select('totalMarks dueAt createdAt submissions')
        .populate('submissions.studentId', 'name email avatar'),
    ]);

    const { currentStart, previousStart, previousEnd } = getLeaderboardWindow(timeRange);
    const now = Date.now();
    const currentRows = computeCourseLeaderboardRows({
      students: enrollments,
      examAttempts,
      assignmentDocs,
      scoreType,
      start: currentStart,
      end: now,
    });
    const previousRows = computeCourseLeaderboardRows({
      students: enrollments,
      examAttempts,
      assignmentDocs,
      scoreType,
      start: previousStart,
      end: previousEnd,
    });

    const previousScoreMap = new Map(previousRows.map((row) => [String(row.studentId), Number(row.score || 0)]));
    const rows = currentRows.map((row) => ({
      ...row,
      deltaScore: Number((Number(row.score || 0) - Number(previousScoreMap.get(String(row.studentId)) || 0)).toFixed(1)),
    }));

    const top3 = rows.slice(0, 3);
    const topPerformer = rows[0] || null;
    const mostImproved = [...rows].sort((a, b) => b.deltaScore - a.deltaScore).find((row) => row.deltaScore > 0) || null;
    const weakStudents = [...rows].sort((a, b) => a.score - b.score).slice(0, 3);

    res.json({
      success: true,
      data: {
        courseId: course._id,
        courseTitle: course.title,
        timeRange,
        scoreType,
        rows,
        top3,
        topPerformer,
        mostImproved,
        weakStudents,
        totalStudents: rows.length,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.listMyAnnouncements = async (req, res) => {
  try {
    const userId = toObjectId(req.user);
    if (!userId) return res.status(401).json({ success: false, error: 'Not authenticated' });

    if (req.user?.role !== 'student') {
      return res.status(403).json({ success: false, error: 'Only students can access announcements' });
    }

    const enrollments = await Enrollment.find({ studentId: userId, status: 'active' })
      .populate('courseId', 'title announcements ownerTeacherId')
      .sort({ updatedAt: -1 });

    const teacherIds = enrollments
      .map((entry) => entry.courseId?.ownerTeacherId)
      .filter(Boolean);

    const teachers = teacherIds.length > 0
      ? await User.find({ _id: { $in: teacherIds } }).select('name avatar')
      : [];
    const teacherMap = new Map(teachers.map((teacher) => [String(teacher._id), teacher]));

    const now = Date.now();
    const data = enrollments
      .map((enrollment) => {
        const course = enrollment.courseId;
        if (!course) return null;

        const teacher = teacherMap.get(String(course.ownerTeacherId || ''));
        const announcements = Array.isArray(course.announcements)
          ? course.announcements
              .filter((item) => {
                const status = String(item.status || 'published').toLowerCase();
                if (status === 'draft') return false;
                if (status === 'scheduled') {
                  const scheduledAt = item.schedule?.scheduledFor ? new Date(item.schedule.scheduledFor).getTime() : NaN;
                  if (Number.isFinite(scheduledAt) && scheduledAt > now) return false;
                }
                return true;
              })
              .map((item) => ({
                ...item.toObject(),
                courseId: course._id,
                courseTitle: course.title,
                teacherName: teacher?.name || 'Teacher',
                teacherAvatar: teacher?.avatar || '',
              }))
          : [];

        return {
          courseId: course._id,
          courseTitle: course.title,
          teacher: {
            name: teacher?.name || 'Teacher',
            avatar: teacher?.avatar || '',
          },
          announcements,
        };
      })
      .filter(Boolean);

    const totalAnnouncements = data.reduce((sum, row) => sum + (row.announcements?.length || 0), 0);

    res.json({ success: true, data, totalAnnouncements });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.markMyAnnouncementSeen = async (req, res) => {
  try {
    const userId = toObjectId(req.user);
    if (!userId) return res.status(401).json({ success: false, error: 'Not authenticated' });
    if (req.user?.role !== 'student') return res.status(403).json({ success: false, error: 'Only students can mark announcement as seen' });

    const enrollment = await Enrollment.findOne({
      studentId: userId,
      courseId: req.params.courseId,
      status: 'active',
    });
    if (!enrollment) return res.status(404).json({ success: false, error: 'Course enrollment not found' });

    const course = await Course.findById(req.params.courseId);
    if (!course) return res.status(404).json({ success: false, error: 'Course not found' });

    const announcement = (course.announcements || []).find((item) => String(item._id) === String(req.params.announcementId));
    if (!announcement) return res.status(404).json({ success: false, error: 'Announcement not found' });

    const seenList = Array.isArray(announcement.seenBy) ? announcement.seenBy.map(String) : [];
    if (!seenList.includes(String(userId))) {
      announcement.seenBy.push(userId);
      announcement.updatedAt = new Date();
      await course.save();
    }

    res.json({ success: true, data: announcement });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.toggleMyAnnouncementLike = async (req, res) => {
  try {
    const userId = toObjectId(req.user);
    if (!userId) return res.status(401).json({ success: false, error: 'Not authenticated' });
    if (req.user?.role !== 'student') return res.status(403).json({ success: false, error: 'Only students can react to announcements' });

    const enrollment = await Enrollment.findOne({
      studentId: userId,
      courseId: req.params.courseId,
      status: 'active',
    });
    if (!enrollment) return res.status(404).json({ success: false, error: 'Course enrollment not found' });

    const course = await Course.findById(req.params.courseId);
    if (!course) return res.status(404).json({ success: false, error: 'Course not found' });

    const announcement = (course.announcements || []).find((item) => String(item._id) === String(req.params.announcementId));
    if (!announcement) return res.status(404).json({ success: false, error: 'Announcement not found' });

    const likedList = Array.isArray(announcement.likedBy) ? announcement.likedBy.map(String) : [];
    const alreadyLiked = likedList.includes(String(userId));
    if (alreadyLiked) {
      announcement.likedBy = (announcement.likedBy || []).filter((id) => String(id) !== String(userId));
    } else {
      announcement.likedBy.push(userId);
    }

    announcement.updatedAt = new Date();
    await course.save();

    res.json({ success: true, data: announcement, liked: !alreadyLiked });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.getCourseStudentPerformance = async (req, res) => {
  try {
    const course = await findOwnedCourse(req.params.id, req.user);
    if (!course) return res.status(404).json({ success: false, error: 'Course not found' });

    const enrollment = await Enrollment.findOne({
      courseId: course._id,
      studentId: req.params.studentId,
      ownerTeacherId: course.ownerTeacherId,
    }).populate('studentId', 'name email phone status avatar');

    if (!enrollment) {
      return res.status(404).json({ success: false, error: 'Enrollment not found' });
    }

    const examIds = (course.examIds || []).map(String);
    const exams = await Exam.find({ _id: { $in: examIds } }).select('title totalMarks status publishedAt startDate endDate questionIds marksPerQuestion negativeMarking negativeMarkValue');
    const examMap = new Map(exams.map((exam) => [String(exam._id), exam]));

    const allQuestionIds = [...new Set(exams.flatMap((exam) => (exam.questionIds || []).map(String)))];
    const questions = allQuestionIds.length > 0
      ? await Question.find({ _id: { $in: allQuestionIds } }).populate('subjectId', 'name').populate('chapterId', 'title').populate('topicId', 'title').lean()
      : [];
    const questionMap = new Map(questions.map((question) => [String(question._id), question]));

    const results = await ExamResult.find({
      studentId: req.params.studentId,
      examId: { $in: examIds },
    }).select('examId score totalMarks submittedAt percentage pendingEvaluation');

    const weakAreaCounts = new Map();
    const recordWeakArea = (label, category) => {
      if (!label) return;
      const key = `${category}:${label}`;
      const current = weakAreaCounts.get(key) || { category, label, incorrectCount: 0, attempts: 0 };
      current.incorrectCount += 1;
      current.attempts += 1;
      weakAreaCounts.set(key, current);
    };

    const resultRows = results.map((result) => {
      const exam = examMap.get(String(result.examId));
      const total = Number(result.totalMarks || exam?.totalMarks || 0);
      const score = result.score == null ? null : Number(result.score);
      const percentage = result.percentage == null
        ? (score == null || total === 0 ? null : Math.round((score / total) * 100))
        : Number(result.percentage);

      const answers = result.answers || {};
      const resultWeakAreas = [];
      const examQuestionIds = (exam?.questionIds || []).map(String);
      const marksPerQuestion = exam?.marksPerQuestion ?? 1;
      const negativeMarking = Boolean(exam?.negativeMarking);
      const negativeValue = Number(exam?.negativeMarkValue || 0);

      examQuestionIds.forEach((questionId) => {
        const question = questionMap.get(String(questionId));
        if (!question || question.subQuestions?.length) return;
        if (question.questionType !== 'MCQ') return;

        const studentAns = answers[questionId] ?? answers[String(question._id)] ?? answers[question._id];
        const correctOption = (question.options || []).find((option) => option.isCorrect);
        const correctText = correctOption ? correctOption.text : null;
        const correctIndex = (question.options || []).findIndex((option) => option.isCorrect);
        const isCorrect = studentAns != null && (
          String(studentAns) === String(correctText) ||
          String(studentAns).toUpperCase() === (correctIndex >= 0 ? String.fromCharCode(65 + correctIndex) : '')
        );

        if (!isCorrect) {
          const topicLabel = question.topicId?.title || question.topicId?.name;
          const chapterLabel = question.chapterId?.title || question.chapterId?.name;
          const subjectLabel = question.subjectId?.name;
          const label = topicLabel || chapterLabel || subjectLabel || question.questionType || 'Question';
          const category = topicLabel ? 'topic' : chapterLabel ? 'chapter' : subjectLabel ? 'subject' : 'question';
          recordWeakArea(label, category);
          resultWeakAreas.push({
            questionId: String(question._id),
            label,
            category,
            penalty: negativeMarking && studentAns ? Number(negativeValue || 0) : Number(marksPerQuestion || 1),
          });
        }
      });

      return {
        examId: String(result.examId),
        examTitle: exam?.title || 'Exam',
        score,
        totalMarks: total,
        percentage,
        submittedAt: result.submittedAt,
        pendingEvaluation: Boolean(result.pendingEvaluation),
        weakAreas: resultWeakAreas,
      };
    });

    const completedCount = resultRows.filter((row) => row.score != null).length;
    const averagePercentage = resultRows.length > 0
      ? Math.round(
          resultRows.reduce((sum, row) => sum + Number(row.percentage || 0), 0) / resultRows.length
        )
      : 0;
    const lastActivityAt = resultRows.length > 0
      ? resultRows
          .map((row) => row.submittedAt)
          .filter(Boolean)
          .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0]
      : enrollment.enrollmentDate || enrollment.createdAt;

    const weakAreas = Array.from(weakAreaCounts.values())
      .sort((a, b) => b.incorrectCount - a.incorrectCount)
      .slice(0, 5)
      .map((item) => ({
        category: item.category,
        label: item.label,
        incorrectCount: item.incorrectCount,
        attempts: item.attempts,
      }));

    const assignmentDocs = await Assignment.find({
      courseId: course._id,
      ownerTeacherId: course.ownerTeacherId,
    }).select('title totalMarks dueAt status submissions');

    const assignmentItems = assignmentDocs.map((assignment) => {
      const submission = (assignment.submissions || []).find((item) => String(item.studentId) === String(req.params.studentId));
      const status = submission
        ? (submission.isLate || (assignment.dueAt && submission.submittedAt && new Date(submission.submittedAt).getTime() > new Date(assignment.dueAt).getTime()) ? 'late' : 'submitted')
        : (assignment.dueAt && new Date().getTime() > new Date(assignment.dueAt).getTime() ? 'late' : 'pending');

      const totalMarks = Number(assignment.totalMarks || 0);
      const score = submission?.marks == null ? null : Number(submission.marks);
      const percentage = score == null || totalMarks <= 0 ? null : Math.round((score / totalMarks) * 100);

      return {
        assignmentId: String(assignment._id),
        title: assignment.title,
        dueAt: assignment.dueAt,
        status,
        score,
        totalMarks,
        percentage,
        submittedAt: submission?.submittedAt || null,
        feedback: submission?.feedback || '',
      };
    });

    const submittedAssignments = assignmentItems.filter((item) => item.submittedAt).length;
    const gradedAssignments = assignmentItems.filter((item) => item.percentage != null);
    const assignmentAveragePercentage = gradedAssignments.length > 0
      ? Math.round(gradedAssignments.reduce((sum, item) => sum + Number(item.percentage || 0), 0) / gradedAssignments.length)
      : 0;
    const assignmentCompletionRate = assignmentItems.length > 0
      ? Math.round((submittedAssignments / assignmentItems.length) * 100)
      : 0;

    res.json({
      success: true,
      data: {
        course: {
          _id: course._id,
          title: course.title,
        },
        enrollment: {
          _id: enrollment._id,
          enrollmentDate: enrollment.enrollmentDate,
          status: enrollment.status,
          createdAt: enrollment.createdAt,
        },
        student: enrollment.studentId,
        performance: {
          totalExams: examIds.length,
          completedExams: completedCount,
          averagePercentage,
          lastActivityAt,
          results: resultRows,
          weakAreas,
          assignments: {
            totalAssignments: assignmentItems.length,
            submittedAssignments,
            assignmentAveragePercentage,
            assignmentCompletionRate,
            items: assignmentItems,
          },
        },
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.addMaterial = async (req, res) => {
  try {
    const course = await findOwnedCourse(req.params.id, req.user);
    if (!course) return res.status(404).json({ success: false, error: 'Course not found' });

    const { title, url, type, category, description } = req.body;
    if (!title || !url) return res.status(400).json({ success: false, error: 'title and url are required' });

    course.materials.push({
      title,
      url,
      type: type || 'link',
      category: category || 'General',
      description: description || '',
    });
    await course.save();

    res.status(201).json({ success: true, data: course.materials[course.materials.length - 1] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.updateMaterial = async (req, res) => {
  try {
    const course = await findOwnedCourse(req.params.id, req.user);
    if (!course) return res.status(404).json({ success: false, error: 'Course not found' });

    const material = (course.materials || []).find((m) => String(m._id) === String(req.params.materialId));
    if (!material) return res.status(404).json({ success: false, error: 'Material not found' });

    const nextTitle = String(req.body?.title || '').trim();
    const nextUrl = String(req.body?.url || '').trim();

    if (!nextTitle || !nextUrl) {
      return res.status(400).json({ success: false, error: 'title and url are required' });
    }

    material.title = nextTitle;
    material.url = nextUrl;
    material.type = req.body?.type || material.type || 'link';
    material.category = req.body?.category || material.category || 'General';
    material.description = req.body?.description || '';
    material.uploadedAt = new Date();

    await course.save();

    res.json({ success: true, data: material });
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

    const rawMessage = req.body?.message;
    const hasPayload = typeof req.body === 'object' && req.body !== null;
    const payload = hasPayload
      ? normalizeAnnouncementPayload(req.body, req.user, 'published')
      : normalizeAnnouncementPayload({ message: rawMessage }, req.user, 'published');

    if (!payload.message) return res.status(400).json({ success: false, error: 'message is required' });

    course.announcements.push(payload);
    await course.save();

    res.status(201).json({ success: true, data: course.announcements[course.announcements.length - 1] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.updateAnnouncement = async (req, res) => {
  try {
    const course = await findOwnedCourse(req.params.id, req.user);
    if (!course) return res.status(404).json({ success: false, error: 'Course not found' });

    const announcement = (course.announcements || []).find((item) => String(item._id) === String(req.params.announcementId));
    if (!announcement) return res.status(404).json({ success: false, error: 'Announcement not found' });

    const payload = normalizeAnnouncementPayload({
      ...announcement.toObject(),
      ...req.body,
      audience: {
        ...(announcement.audience || {}),
        ...(req.body?.audience || {}),
      },
      schedule: {
        ...(announcement.schedule || {}),
        ...(req.body?.schedule || {}),
      },
      notification: {
        ...(announcement.notification || {}),
        ...(req.body?.notification || {}),
      },
    }, req.user, String(announcement.status || 'published').toLowerCase());

    if (!payload.message) return res.status(400).json({ success: false, error: 'message is required' });

    Object.assign(announcement, payload, { updatedAt: new Date() });
    await course.save();

    res.json({ success: true, data: announcement });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.duplicateAnnouncement = async (req, res) => {
  try {
    const course = await findOwnedCourse(req.params.id, req.user);
    if (!course) return res.status(404).json({ success: false, error: 'Course not found' });

    const announcement = (course.announcements || []).find((item) => String(item._id) === String(req.params.announcementId));
    if (!announcement) return res.status(404).json({ success: false, error: 'Announcement not found' });

    const copied = normalizeAnnouncementPayload({
      ...announcement.toObject(),
      title: announcement.title ? `${announcement.title} (Copy)` : '',
      status: 'draft',
      isPinned: false,
      seenBy: [],
      likedBy: [],
      comments: [],
    }, req.user, 'draft');

    course.announcements.push({ ...copied, createdAt: new Date(), updatedAt: new Date() });
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
