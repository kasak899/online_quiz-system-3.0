// seed.js — Run once to populate the database with sample questions
// Usage: node seed.js

require('dotenv').config();
const mongoose = require('mongoose');

mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/eduquiz');

const questionSchema = new mongoose.Schema({
  subject: String, question: String, options: [String],
  answer: Number, explanation: String, difficulty: String,
  approved: { type: Boolean, default: true }
});
const Question = mongoose.model('Question', questionSchema);

const questions = [
  // Mathematics
  { subject:'Mathematics', question:'What is the derivative of x²?', options:['x','2x','x²','2x²'], answer:1, explanation:'Power rule: d/dx(xⁿ) = nxⁿ⁻¹', difficulty:'Medium' },
  { subject:'Mathematics', question:'What is √144?', options:['11','12','13','14'], answer:1, explanation:'12 × 12 = 144', difficulty:'Easy' },
  { subject:'Mathematics', question:'Solve: 2x + 5 = 13', options:['3','4','5','6'], answer:1, explanation:'2x = 8, x = 4', difficulty:'Easy' },
  { subject:'Mathematics', question:'What is the value of π (pi) approximately?', options:['3.14159','2.71828','1.41421','1.73205'], answer:0, explanation:'π ≈ 3.14159265...', difficulty:'Easy' },
  { subject:'Mathematics', question:'How many degrees are in a triangle?', options:['90°','180°','270°','360°'], answer:1, explanation:'Sum of interior angles of any triangle = 180°', difficulty:'Easy' },

  // Science
  { subject:'Science', question:'What is the chemical symbol for Gold?', options:['Go','Gd','Au','Ag'], answer:2, explanation:'Au comes from the Latin word "Aurum"', difficulty:'Medium' },
  { subject:'Science', question:'How many bones are in the adult human body?', options:['196','206','216','226'], answer:1, explanation:'An adult human has 206 bones', difficulty:'Medium' },
  { subject:'Science', question:'What is Newton\'s 2nd law?', options:['F=ma','E=mc²','V=IR','PV=nRT'], answer:0, explanation:'Force = Mass × Acceleration', difficulty:'Easy' },
  { subject:'Science', question:'What planet is closest to the Sun?', options:['Venus','Mars','Mercury','Earth'], answer:2, explanation:'Mercury is the innermost planet of the solar system', difficulty:'Easy' },
  { subject:'Science', question:'What is the speed of light?', options:['3×10⁶ m/s','3×10⁸ m/s','3×10¹⁰ m/s','3×10⁴ m/s'], answer:1, explanation:'c ≈ 3 × 10⁸ metres per second', difficulty:'Medium' },

  // Computer Science
  { subject:'Computer Sci', question:'What does CPU stand for?', options:['Central Processing Unit','Computer Personal Unit','Core Processing Utility','Central Program Unit'], answer:0, explanation:'CPU = Central Processing Unit, the brain of a computer', difficulty:'Easy' },
  { subject:'Computer Sci', question:'What is the time complexity of binary search?', options:['O(n)','O(log n)','O(n²)','O(1)'], answer:1, explanation:'Binary search halves the search space each step', difficulty:'Medium' },
  { subject:'Computer Sci', question:'Which data structure uses LIFO?', options:['Queue','Stack','Tree','Graph'], answer:1, explanation:'Stack = Last In, First Out', difficulty:'Easy' },
  { subject:'Computer Sci', question:'What does HTML stand for?', options:['Hyper Text Markup Language','High Tech Modern Language','Hyper Transfer Markup Logic','None'], answer:0, explanation:'HyperText Markup Language — backbone of web pages', difficulty:'Easy' },
  { subject:'Computer Sci', question:'Which sorting algorithm has best average-case O(n log n)?', options:['Bubble Sort','Insertion Sort','Merge Sort','Selection Sort'], answer:2, explanation:'Merge Sort consistently achieves O(n log n)', difficulty:'Hard' },

  // English
  { subject:'English', question:'What is the plural of "criterion"?', options:['criterions','criterias','criteria','criterium'], answer:2, explanation:'"Criteria" is the correct Latin-derived plural', difficulty:'Medium' },
  { subject:'English', question:'Who wrote "Pride and Prejudice"?', options:['Charlotte Brontë','Jane Austen','George Eliot','Emily Brontë'], answer:1, explanation:'Jane Austen published it in 1813', difficulty:'Easy' },
  { subject:'English', question:'What is a synonym for "ephemeral"?', options:['Permanent','Transient','Eternal','Lasting'], answer:1, explanation:'Ephemeral = lasting for a very short time = transient', difficulty:'Hard' },

  // History
  { subject:'History', question:'In which year did World War II end?', options:['1943','1944','1945','1946'], answer:2, explanation:'WWII ended in 1945 with Germany\'s surrender in May and Japan\'s in September', difficulty:'Easy' },
  { subject:'History', question:'Who was the first President of India?', options:['Jawaharlal Nehru','Mahatma Gandhi','Dr. Rajendra Prasad','Sardar Patel'], answer:2, explanation:'Dr. Rajendra Prasad served as the first President of India (1950–1962)', difficulty:'Easy' },

  // Geography
  { subject:'Geography', question:'What is the capital of Australia?', options:['Sydney','Melbourne','Canberra','Brisbane'], answer:2, explanation:'Canberra is the capital — not Sydney as commonly assumed!', difficulty:'Medium' },
  { subject:'Geography', question:'Which is the longest river in the world?', options:['Amazon','Mississippi','Nile','Yangtze'], answer:2, explanation:'The Nile stretches approximately 6,650 km', difficulty:'Easy' },
];

async function seed() {
  try {
    await Question.deleteMany({});
    await Question.insertMany(questions);
    console.log(`✅ Seeded ${questions.length} questions successfully!`);
    process.exit(0);
  } catch (err) {
    console.error('❌ Seed error:', err.message);
    process.exit(1);
  }
}

seed();