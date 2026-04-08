const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const dotenv = require('dotenv');

const connectDB = require('../config/db');
const Question = require('../models/Question');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const columns = [
  'id',
  'questionType',
  'difficulty',
  'boardYear',
  'subjectId',
  'subjectName',
  'chapterId',
  'chapterName',
  'topicId',
  'topicName',
  'examTypeId',
  'examTypeName',
  'questionTextEn',
  'questionTextBn',
  'explanation',
  'tags',
  'optionA',
  'optionB',
  'optionC',
  'optionD',
  'optionE',
  'optionF',
  'correctOption',
  'correctAnswer',
  'optionsPacked',
  'subQuestionsJson',
  'createdAt',
  'updatedAt',
];

function escapeCsvCell(value) {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function toCsvRow(values) {
  return values.map(escapeCsvCell).join(',');
}

function getSafeName(obj, fallback = '') {
  if (!obj) return fallback;
  if (typeof obj === 'string') return obj;
  return obj.name || obj.examName || fallback;
}

async function exportQuestionsCsv() {
  await connectDB();

  const questions = await Question.find({})
    .populate('subjectId')
    .populate('chapterId')
    .populate('topicId')
    .populate('examTypeId')
    .sort({ createdAt: -1 });

  const lines = [toCsvRow(columns)];

  for (const q of questions) {
    const options = Array.isArray(q.options) ? q.options : [];
    const optionTexts = options.map((o) => (o && o.text ? String(o.text).trim() : ''));
    const correctIndex = options.findIndex((o) => o && o.isCorrect);
    const correctOption = correctIndex >= 0 ? String.fromCharCode(65 + correctIndex) : '';
    const correctAnswer = correctIndex >= 0 ? optionTexts[correctIndex] : '';

    const row = [
      q._id,
      q.questionType || '',
      q.difficulty || '',
      q.boardYear || '',
      q.subjectId?._id || q.subjectId || '',
      getSafeName(q.subjectId),
      q.chapterId?._id || q.chapterId || '',
      getSafeName(q.chapterId),
      q.topicId?._id || q.topicId || '',
      getSafeName(q.topicId),
      q.examTypeId?._id || q.examTypeId || '',
      getSafeName(q.examTypeId),
      q.questionTextEn || '',
      q.questionTextBn || '',
      q.explanation || '',
      Array.isArray(q.tags) ? q.tags.join('|') : '',
      optionTexts[0] || '',
      optionTexts[1] || '',
      optionTexts[2] || '',
      optionTexts[3] || '',
      optionTexts[4] || '',
      optionTexts[5] || '',
      correctOption,
      correctAnswer,
      optionTexts.join('|'),
      JSON.stringify(Array.isArray(q.subQuestions) ? q.subQuestions : []),
      q.createdAt ? new Date(q.createdAt).toISOString() : '',
      q.updatedAt ? new Date(q.updatedAt).toISOString() : '',
    ];

    lines.push(toCsvRow(row));
  }

  const now = new Date();
  const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`;
  const outputDir = path.join(__dirname, '..', 'exports');
  const outputFile = path.join(outputDir, `questions-export-${stamp}.csv`);

  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(outputFile, lines.join('\n'), 'utf8');

  console.log(`Exported ${questions.length} questions`);
  console.log(`CSV file: ${outputFile}`);
}

exportQuestionsCsv()
  .then(async () => {
    await mongoose.connection.close();
    process.exit(0);
  })
  .catch(async (err) => {
    console.error('Failed to export questions CSV:', err.message);
    try {
      await mongoose.connection.close();
    } catch (_e) {
      // ignore close errors
    }
    process.exit(1);
  });
