const Assignment = require('../models/Assignment');
const Course = require('../models/Course');
const Enrollment = require('../models/Enrollment');
const User = require('../models/User');

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

async function findOwnedAssignment(courseId, assignmentId, user) {
  const filter = { _id: assignmentId, courseId };
  if (!isAdmin(user)) filter.ownerTeacherId = toObjectId(user);
  return Assignment.findOne(filter);
}

function buildDueAt(datePart, timePart) {
  if (!datePart) return null;
  const value = `${datePart}T${timePart || '23:59'}:00`;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function computeSubmissionStatus(assignment, submission, now = new Date()) {
  if (!submission) {
    if (assignment.dueAt && now.getTime() > new Date(assignment.dueAt).getTime()) return 'late';
    return 'pending';
  }

  if (!submission.submittedAt) return 'pending';

  if (submission.isLate) return 'late';
  if (assignment.dueAt && submission.submittedAt && new Date(submission.submittedAt).getTime() > new Date(assignment.dueAt).getTime()) return 'late';
  return 'submitted';
}

function normalizeAttachmentUrl(url = '') {
  const value = String(url || '');
  if (!value) return '';
  if (value.includes('/image/upload/') && value.toLowerCase().includes('.pdf')) {
    return value.replace('/image/upload/', '/raw/upload/');
  }
  return value;
}

function sanitizeAttachments(list) {
  const items = Array.isArray(list) ? list : [];
  return items
    .map((item) => ({
      name: item?.name ? String(item.name) : '',
      url: normalizeAttachmentUrl(item?.url || ''),
      size: Number(item?.size) || 0,
      mimeType: item?.mimeType ? String(item.mimeType) : '',
    }))
    .filter((item) => Boolean(item.url));
}

async function uploadBufferToCloudinary(file) {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME || 'dbjpqg8e3';
  const uploadPreset = process.env.CLOUDINARY_UPLOAD_PRESET || 'learnsmart_questions';
  const isImage = typeof file.mimetype === 'string' && file.mimetype.startsWith('image/');
  const resourceType = isImage ? 'image' : 'raw';
  const formData = new FormData();

  formData.append('file', new Blob([file.buffer], { type: file.mimetype || 'application/octet-stream' }), file.originalname);
  formData.append('upload_preset', uploadPreset);

  const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Cloudinary upload failed: ${text || response.statusText}`);
  }

  const data = await response.json();
  return {
    name: file.originalname,
    url: normalizeAttachmentUrl(data.secure_url || data.url),
    size: file.size || 0,
    mimeType: file.mimetype || '',
  };
}

exports.listAssignments = async (req, res) => {
  try {
    const { id: courseId } = req.params;
    const { search = '', status } = req.query;

    // Student view: only enrolled course assignments and never draft assignments.
    if (req.user?.role === 'student') {
      const studentId = toObjectId(req.user);
      const enrollment = await Enrollment.findOne({ studentId, courseId });
      if (!enrollment) return res.status(403).json({ success: false, error: 'You are not enrolled in this course' });

      const query = { courseId, status: { $in: ['active', 'closed'] } };
      if (status && ['active', 'closed'].includes(status)) query.status = status;
      if (search) query.title = new RegExp(search, 'i');

      const [assignments, course] = await Promise.all([
        Assignment.find(query).sort({ dueAt: 1, createdAt: -1 }),
        Course.findById(courseId).select('title'),
      ]);

      const now = new Date();
      const data = assignments.map((assignment) => {
        const submission = (assignment.submissions || []).find((item) => String(item.studentId) === String(studentId));
        const submissionStatus = computeSubmissionStatus(assignment, submission, now);
        return {
          ...assignment.toObject(),
          course: course ? { _id: course._id, title: course.title } : undefined,
          submissionStatus,
          submittedAt: submission?.submittedAt || null,
          marks: submission?.marks ?? null,
          feedback: submission?.feedback || '',
          hasSubmitted: Boolean(submission),
        };
      });

      return res.json({ success: true, data });
    }

    const course = await findOwnedCourse(courseId, req.user);
    if (!course) return res.status(404).json({ success: false, error: 'Course not found' });

    const query = { courseId: course._id };
    if (!isAdmin(req.user)) query.ownerTeacherId = toObjectId(req.user);
    if (status && status !== 'all') query.status = status;
    if (search) query.title = new RegExp(search, 'i');

    const [assignments, totalStudents] = await Promise.all([
      Assignment.find(query).sort({ createdAt: -1 }),
      Enrollment.countDocuments({ courseId: course._id, ownerTeacherId: course.ownerTeacherId }),
    ]);

    const now = new Date();
    const data = assignments.map((assignment) => {
      const submitted = assignment.submissions || [];
      const lateCount = submitted.filter((submission) => computeSubmissionStatus(assignment, submission, now) === 'late').length;
      const completionRate = totalStudents > 0 ? Math.round((submitted.length / totalStudents) * 100) : 0;

      return {
        ...assignment.toObject(),
        totalStudents,
        submittedCount: submitted.length,
        pendingCount: Math.max(totalStudents - submitted.length, 0),
        lateCount,
        completionRate,
      };
    });

    return res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.listMyAssignments = async (req, res) => {
  try {
    const studentId = toObjectId(req.user);
    if (!studentId || req.user?.role !== 'student') {
      return res.status(403).json({ success: false, error: 'Student access only' });
    }

    const { search = '', status = 'all' } = req.query;
    const enrollments = await Enrollment.find({ studentId }).select('courseId');
    const courseIds = enrollments.map((item) => item.courseId);
    if (!courseIds.length) return res.json({ success: true, data: [] });

    const query = { courseId: { $in: courseIds }, status: { $in: ['active', 'closed'] } };
    if (status && ['active', 'closed'].includes(String(status))) query.status = status;
    if (search) query.title = new RegExp(search, 'i');

    const [assignments, courses] = await Promise.all([
      Assignment.find(query).sort({ dueAt: 1, createdAt: -1 }),
      Course.find({ _id: { $in: courseIds } }).select('title'),
    ]);

    const courseMap = new Map(courses.map((course) => [String(course._id), course.title]));
    const now = new Date();
    const data = assignments.map((assignment) => {
      const submission = (assignment.submissions || []).find((item) => String(item.studentId) === String(studentId));
      return {
        ...assignment.toObject(),
        course: {
          _id: assignment.courseId,
          title: courseMap.get(String(assignment.courseId)) || 'Course',
        },
        submissionStatus: computeSubmissionStatus(assignment, submission, now),
        submittedAt: submission?.submittedAt || null,
        marks: submission?.marks ?? null,
        feedback: submission?.feedback || '',
        hasSubmitted: Boolean(submission),
      };
    });

    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.getMyAssignment = async (req, res) => {
  try {
    const { assignmentId } = req.params;
    const studentId = toObjectId(req.user);
    if (!studentId || req.user?.role !== 'student') {
      return res.status(403).json({ success: false, error: 'Student access only' });
    }

    const assignment = await Assignment.findById(assignmentId);
    if (!assignment) return res.status(404).json({ success: false, error: 'Assignment not found' });
    if (!['active', 'closed'].includes(assignment.status)) {
      return res.status(404).json({ success: false, error: 'Assignment not available' });
    }

    const enrollment = await Enrollment.findOne({ studentId, courseId: assignment.courseId });
    if (!enrollment) return res.status(403).json({ success: false, error: 'You are not enrolled in this course' });

    const course = await Course.findById(assignment.courseId).select('title');
    const submission = (assignment.submissions || []).find((item) => String(item.studentId) === String(studentId)) || null;
    const normalizedSubmission = submission
      ? {
          ...submission.toObject(),
          attachments: sanitizeAttachments(submission.attachments),
        }
      : null;

    res.json({
      success: true,
      data: {
        ...assignment.toObject(),
        course: course ? { _id: course._id, title: course.title } : undefined,
        submission: normalizedSubmission,
        submissionStatus: computeSubmissionStatus(assignment, normalizedSubmission, new Date()),
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.createAssignment = async (req, res) => {
  try {
    const { id: courseId } = req.params;
    const course = await findOwnedCourse(courseId, req.user);
    if (!course) return res.status(404).json({ success: false, error: 'Course not found' });

    const {
      title,
      description,
      instructions,
      type,
      status,
      dueAt,
      dueDate,
      dueTime,
      totalMarks,
      allowLateSubmission,
      maxFileSizeMb,
      referenceMaterials,
    } = req.body;

    if (!title || !String(title).trim()) {
      return res.status(400).json({ success: false, error: 'Assignment title is required' });
    }

    const assignment = await Assignment.create({
      courseId: course._id,
      ownerTeacherId: course.ownerTeacherId,
      title: String(title).trim(),
      description: description || '',
      instructions: instructions || '',
      type: ['written', 'file', 'mixed'].includes(type) ? type : 'written',
      status: ['draft', 'active', 'closed'].includes(status) ? status : 'draft',
      dueAt: dueAt || buildDueAt(dueDate, dueTime),
      totalMarks: totalMarks === undefined ? 100 : Number(totalMarks) || 0,
      allowLateSubmission: Boolean(allowLateSubmission),
      maxFileSizeMb: maxFileSizeMb === undefined ? 10 : Number(maxFileSizeMb) || 10,
      referenceMaterials: Array.isArray(referenceMaterials) ? referenceMaterials : [],
    });

    res.status(201).json({ success: true, data: assignment });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.updateAssignment = async (req, res) => {
  try {
    const { id: courseId, assignmentId } = req.params;
    const assignment = await findOwnedAssignment(courseId, assignmentId, req.user);
    if (!assignment) return res.status(404).json({ success: false, error: 'Assignment not found' });

    const payload = { ...req.body };

    if (payload.title !== undefined) payload.title = String(payload.title || '').trim();
    if (payload.dueAt === undefined && payload.dueDate) payload.dueAt = buildDueAt(payload.dueDate, payload.dueTime);
    if (payload.totalMarks !== undefined) payload.totalMarks = Number(payload.totalMarks) || 0;
    if (payload.maxFileSizeMb !== undefined) payload.maxFileSizeMb = Number(payload.maxFileSizeMb) || 10;
    if (payload.referenceMaterials && !Array.isArray(payload.referenceMaterials)) payload.referenceMaterials = [];

    Object.assign(assignment, payload);
    await assignment.save();

    res.json({ success: true, data: assignment });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.publishAssignment = async (req, res) => {
  try {
    const { id: courseId, assignmentId } = req.params;
    const assignment = await findOwnedAssignment(courseId, assignmentId, req.user);
    if (!assignment) return res.status(404).json({ success: false, error: 'Assignment not found' });

    assignment.status = 'active';
    await assignment.save();

    res.json({ success: true, data: assignment, message: 'Assignment published' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.closeAssignment = async (req, res) => {
  try {
    const { id: courseId, assignmentId } = req.params;
    const assignment = await findOwnedAssignment(courseId, assignmentId, req.user);
    if (!assignment) return res.status(404).json({ success: false, error: 'Assignment not found' });

    assignment.status = 'closed';
    await assignment.save();

    res.json({ success: true, data: assignment, message: 'Assignment closed' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.deleteAssignment = async (req, res) => {
  try {
    const { id: courseId, assignmentId } = req.params;
    const assignment = await findOwnedAssignment(courseId, assignmentId, req.user);
    if (!assignment) return res.status(404).json({ success: false, error: 'Assignment not found' });

    await Assignment.deleteOne({ _id: assignment._id });
    res.json({ success: true, message: 'Assignment deleted' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.getAssignmentSubmissions = async (req, res) => {
  try {
    const { id: courseId, assignmentId } = req.params;
    const assignment = await findOwnedAssignment(courseId, assignmentId, req.user);
    if (!assignment) return res.status(404).json({ success: false, error: 'Assignment not found' });

    const enrollments = await Enrollment.find({ courseId: assignment.courseId, ownerTeacherId: assignment.ownerTeacherId })
      .populate('studentId', 'name email status avatar')
      .sort({ createdAt: -1 });

    const submissionMap = new Map((assignment.submissions || []).map((submission) => [String(submission.studentId), submission]));
    const now = new Date();

    const rows = enrollments.map((enrollment) => {
      const student = enrollment.studentId;
      const studentId = String(student?._id || enrollment.studentId || '');
      const submission = submissionMap.get(studentId);
      const status = computeSubmissionStatus(assignment, submission, now);

      return {
        studentId,
        studentName: student?.name || 'Unknown Student',
        email: student?.email || '',
        submissionStatus: status,
        submittedAt: submission?.submittedAt || null,
        marks: submission?.marks ?? null,
        feedback: submission?.feedback || '',
        hasFile: Array.isArray(submission?.attachments) && submission.attachments.length > 0,
        files: sanitizeAttachments(submission?.attachments),
      };
    });

    const totalStudents = rows.length;
    const submitted = rows.filter((row) => row.submissionStatus === 'submitted' || row.submissionStatus === 'late').length;
    const pending = rows.filter((row) => row.submissionStatus === 'pending').length;
    const late = rows.filter((row) => row.submissionStatus === 'late').length;

    res.json({
      success: true,
      data: {
        assignment,
        summary: {
          totalStudents,
          submitted,
          pending,
          late,
        },
        rows,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.getStudentSubmission = async (req, res) => {
  try {
    const { id: courseId, assignmentId, studentId } = req.params;
    const assignment = await findOwnedAssignment(courseId, assignmentId, req.user);
    if (!assignment) return res.status(404).json({ success: false, error: 'Assignment not found' });

    const student = await User.findById(studentId).select('name email status avatar');
    if (!student) return res.status(404).json({ success: false, error: 'Student not found' });

    const submission = (assignment.submissions || []).find((item) => String(item.studentId) === String(studentId)) || null;
    const status = computeSubmissionStatus(assignment, submission, new Date());

    res.json({
      success: true,
      data: {
        assignment: {
          _id: assignment._id,
          title: assignment.title,
          type: assignment.type,
          dueAt: assignment.dueAt,
          totalMarks: assignment.totalMarks,
        },
        student,
        submission: submission
          ? {
              studentId: submission.studentId,
              writtenAnswer: submission.writtenAnswer || '',
              attachments: sanitizeAttachments(submission.attachments),
              submittedAt: submission.submittedAt || null,
              marks: submission.marks ?? null,
              feedback: submission.feedback || '',
              gradedAt: submission.gradedAt || null,
              returnedAt: submission.returnedAt || null,
            }
          : null,
        status,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.gradeStudentSubmission = async (req, res) => {
  try {
    const { id: courseId, assignmentId, studentId } = req.params;
    const assignment = await findOwnedAssignment(courseId, assignmentId, req.user);
    if (!assignment) return res.status(404).json({ success: false, error: 'Assignment not found' });

    const submissionIndex = (assignment.submissions || []).findIndex((item) => String(item.studentId) === String(studentId));
    if (submissionIndex < 0) {
      return res.status(404).json({ success: false, error: 'Submission not found for this student' });
    }

    const submission = assignment.submissions[submissionIndex];
    if (req.body.marks !== undefined) submission.marks = Number(req.body.marks);
    if (req.body.feedback !== undefined) submission.feedback = String(req.body.feedback || '');
    submission.gradedAt = new Date();
    if (req.body.returnToStudent) submission.returnedAt = new Date();

    assignment.markModified('submissions');
    await assignment.save();

    res.json({ success: true, data: submission, message: 'Submission graded successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.submitAssignment = async (req, res) => {
  try {
    const { id: courseId, assignmentId } = req.params;
    const assignment = await Assignment.findOne({ _id: assignmentId, courseId });
    if (!assignment) return res.status(404).json({ success: false, error: 'Assignment not found' });

    const studentId = toObjectId(req.user);
    if (!studentId) return res.status(401).json({ success: false, error: 'Not authenticated' });
    if (req.user?.role !== 'student') {
      return res.status(403).json({ success: false, error: 'Only students can submit assignments' });
    }

    const enrollment = await Enrollment.findOne({ studentId, courseId: assignment.courseId });
    if (!enrollment) {
      return res.status(403).json({ success: false, error: 'You are not enrolled in this course' });
    }

    if (assignment.status !== 'active') {
      return res.status(400).json({ success: false, error: 'Assignment is not active' });
    }

    const now = new Date();
    const isLate = assignment.dueAt ? now.getTime() > new Date(assignment.dueAt).getTime() : false;
    if (isLate && !assignment.allowLateSubmission) {
      return res.status(400).json({ success: false, error: 'Late submission is not allowed for this assignment' });
    }

    const writtenAnswer = String(req.body?.writtenAnswer || '');
    const attachments = sanitizeAttachments(req.body?.attachments);
    const existingIndex = (assignment.submissions || []).findIndex((item) => String(item.studentId) === String(studentId));

    const payload = {
      studentId,
      writtenAnswer,
      attachments,
      submittedAt: now,
      isLate,
      feedback: '',
    };

    if (existingIndex >= 0) {
      assignment.submissions[existingIndex] = {
        ...assignment.submissions[existingIndex],
        ...payload,
      };
    } else {
      assignment.submissions.push(payload);
    }

    assignment.markModified('submissions');
    await assignment.save();

    res.json({ success: true, data: payload, message: 'Assignment submitted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.uploadAssignmentAttachments = async (req, res) => {
  try {
    const { id: courseId, assignmentId } = req.params;
    const assignment = await Assignment.findOne({ _id: assignmentId, courseId });
    if (!assignment) return res.status(404).json({ success: false, error: 'Assignment not found' });

    const studentId = toObjectId(req.user);
    if (!studentId) return res.status(401).json({ success: false, error: 'Not authenticated' });
    if (req.user?.role !== 'student') {
      return res.status(403).json({ success: false, error: 'Only students can upload assignment files' });
    }

    const enrollment = await Enrollment.findOne({ studentId, courseId: assignment.courseId });
    if (!enrollment) {
      return res.status(403).json({ success: false, error: 'You are not enrolled in this course' });
    }

    if (assignment.status !== 'active') {
      return res.status(400).json({ success: false, error: 'Assignment is not active' });
    }

    const files = Array.isArray(req.files) ? req.files : [];
    if (!files.length) {
      return res.status(400).json({ success: false, error: 'No files uploaded' });
    }

    const existingIndex = (assignment.submissions || []).findIndex((item) => String(item.studentId) === String(studentId));
    const data = await Promise.all(files.map((file) => uploadBufferToCloudinary(file)));

    if (existingIndex >= 0) {
      const submission = assignment.submissions[existingIndex];
      const existingAttachments = sanitizeAttachments(submission.attachments);
      submission.attachments = [...existingAttachments, ...data];
      if (!submission.submittedAt) submission.submittedAt = null;
      assignment.markModified('submissions');
      await assignment.save();
    } else {
      assignment.submissions.push({
        studentId,
        writtenAnswer: '',
        attachments: data,
        submittedAt: null,
        isLate: false,
        feedback: '',
      });
      assignment.markModified('submissions');
      await assignment.save();
    }

    return res.status(201).json({ success: true, data });
  } catch (error) {
    const message = String(error?.message || 'Upload failed');
    if (message.includes('deny or ACL failure')) {
      return res.status(500).json({
        success: false,
        error: 'Cloudinary blocked public delivery for this upload preset. Update the preset to allow public unsigned uploads (delivery type: upload, access: public).',
      });
    }
    return res.status(500).json({ success: false, error: message });
  }
};
