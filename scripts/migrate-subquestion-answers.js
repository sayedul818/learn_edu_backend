const mongoose = require('mongoose');
const Question = require('../models/Question');

async function run() {
  const uri = process.env.MONGO_URI || 'mongodb://localhost:27017/learnsmart-prep';
  await mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true });
  console.log('Connected to DB');

  // Find questions that have subQuestions and at least one subQuestion with missing answerBn but has answer
  const cursor = Question.find({ 'subQuestions': { $exists: true, $ne: [] } }).cursor();
  let updated = 0;

  for (let doc = await cursor.next(); doc != null; doc = await cursor.next()) {
    let changed = false;
    if (Array.isArray(doc.subQuestions)) {
      doc.subQuestions = doc.subQuestions.map(sq => {
        const s = sq.toObject ? sq.toObject() : { ...sq };
        // if there is a generic 'answer' property, move it to answerBn
        if (!s.answerBn && s.answer) {
          s.answerBn = s.answer;
          delete s.answer;
          changed = true;
        }
        // also copy questionText -> questionTextBn if needed
        if (!s.questionTextBn && s.questionText) {
          s.questionTextBn = s.questionText;
          delete s.questionText;
          changed = true;
        }
        return s;
      });
    }

    if (changed) {
      await Question.updateOne({ _id: doc._id }, { $set: { subQuestions: doc.subQuestions } });
      updated++;
      console.log('Updated question', doc._id.toString());
    }
  }

  console.log('Migration complete. Updated docs:', updated);
  await mongoose.disconnect();
}

run().catch(err => { console.error(err); process.exit(1); });
