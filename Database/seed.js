const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

// Import Models
const User = require('../Backend/models/User');
const Question = require('../Backend/models/Question');
const QuizAttempt = require('../Backend/models/QuizAttempt');

// Sample Data
const sampleUsers = [
    {
        username: 'admin',
        email: 'admin@quizzed.com',
        password: 'admin123',
        role: 'admin',
        profile: {
            firstName: 'Admin',
            lastName: 'User',
            bio: 'Platform administrator'
        },
        preferences: {
            favoriteTopics: ['mathematics', 'science'],
            difficultyLevel: 'advanced'
        },
        stats: {
            totalQuizzesTaken: 50,
            totalScore: 4250,
            averageScore: 85,
            topicsStudied: ['mathematics', 'science', 'programming']
        }
    },
    {
        username: 'john_doe',
        email: 'john@example.com',
        password: 'password123',
        role: 'student',
        profile: {
            firstName: 'John',
            lastName: 'Doe',
            bio: 'Computer Science student'
        },
        preferences: {
            favoriteTopics: ['programming', 'mathematics'],
            difficultyLevel: 'intermediate'
        },
        stats: {
            totalQuizzesTaken: 25,
            totalScore: 1875,
            averageScore: 75,
            topicsStudied: ['programming', 'mathematics']
        }
    },
    {
        username: 'jane_smith',
        email: 'jane@example.com',
        password: 'password123',
        role: 'student',
        profile: {
            firstName: 'Jane',
            lastName: 'Smith',
            bio: 'Biology enthusiast'
        },
        preferences: {
            favoriteTopics: ['science', 'biology'],
            difficultyLevel: 'beginner'
        },
        stats: {
            totalQuizzesTaken: 15,
            totalScore: 975,
            averageScore: 65,
            topicsStudied: ['science']
        }
    }
];

const sampleQuestions = [
    // Mathematics Questions
    {
        questionText: "What is the derivative of x²?",
        questionType: "multiple-choice",
        options: [
            { text: "x", isCorrect: false },
            { text: "2x", isCorrect: true },
            { text: "x²", isCorrect: false },
            { text: "2", isCorrect: false }
        ],
        explanation: "The derivative of x² is 2x using the power rule: d/dx(x^n) = n×x^(n-1)",
        difficulty: "medium",
        topics: ["mathematics", "calculus"],
        tags: ["derivative", "power-rule", "calculus"],
        metadata: {
            subject: "Mathematics",
            grade: "College",
            estimatedTime: 45,
            points: 1
        },
        analytics: {
            totalAttempts: 100,
            correctAttempts: 75,
            averageTime: 42
        }
    },
    {
        questionText: "What is the value of π (pi) rounded to 3 decimal places?",
        questionType: "multiple-choice",
        options: [
            { text: "3.141", isCorrect: false },
            { text: "3.142", isCorrect: true },
            { text: "3.143", isCorrect: false },
            { text: "3.140", isCorrect: false }
        ],
        explanation: "π ≈ 3.14159..., which rounds to 3.142 when rounded to 3 decimal places",
        difficulty: "easy",
        topics: ["mathematics", "geometry"],
        tags: ["pi", "geometry", "constants"],
        metadata: {
            subject: "Mathematics",
            grade: "High School",
            estimatedTime: 30,
            points: 1
        },
        analytics: {
            totalAttempts: 150,
            correctAttempts: 120,
            averageTime: 28
        }
    },
    {
        questionText: "Solve for x: 2x + 5 = 13",
        questionType: "multiple-choice",
        options: [
            { text: "x = 3", isCorrect: false },
            { text: "x = 4", isCorrect: true },
            { text: "x = 5", isCorrect: false },
            { text: "x = 6", isCorrect: false }
        ],
        explanation: "2x + 5 = 13, so 2x = 8, therefore x = 4",
        difficulty: "easy",
        topics: ["mathematics", "algebra"],
        tags: ["linear-equations", "algebra", "solving"],
        metadata: {
            subject: "Mathematics",
            grade: "Middle School",
            estimatedTime: 60,
            points: 1
        },
        analytics: {
            totalAttempts: 200,
            correctAttempts: 160,
            averageTime: 55
        }
    },

    // Science Questions
    {
        questionText: "What is the chemical symbol for gold?",
        questionType: "multiple-choice",
        options: [
            { text: "Go", isCorrect: false },
            { text: "Au", isCorrect: true },
            { text: "Gd", isCorrect: false },
            { text: "Ag", isCorrect: false }
        ],
        explanation: "The chemical symbol for gold is Au, derived from the Latin word 'aurum'",
        difficulty: "easy",
        topics: ["science", "chemistry"],
        tags: ["periodic-table", "elements", "chemistry"],
        metadata: {
            subject: "Chemistry",
            grade: "High School",
            estimatedTime: 30,
            points: 1
        },
        analytics: {
            totalAttempts: 180,
            correctAttempts: 144,
            averageTime: 25
        }
    },
    {
        questionText: "What is Newton's First Law of Motion?",
        questionType: "multiple-choice",
        options: [
            { text: "F = ma", isCorrect: false },
            { text: "An object at rest stays at rest unless acted upon by a force", isCorrect: true },
            { text: "For every action there is an equal and opposite reaction", isCorrect: false },
            { text: "Energy cannot be created or destroyed", isCorrect: false }
        ],
        explanation: "Newton's First Law states that an object at rest stays at rest and an object in motion stays in motion unless acted upon by an external force",
        difficulty: "medium",
        topics: ["science", "physics"],
        tags: ["newton", "motion", "physics", "laws"],
        metadata: {
            subject: "Physics",
            grade: "High School",
            estimatedTime: 45,
            points: 1
        },
        analytics: {
            totalAttempts: 90,
            correctAttempts: 72,
            averageTime: 50
        }
    },
    {
        questionText: "Which organelle is known as the 'powerhouse of the cell'?",
        questionType: "multiple-choice",
        options: [
            { text: "Nucleus", isCorrect: false },
            { text: "Mitochondria", isCorrect: true },
            { text: "Ribosome", isCorrect: false },
            { text: "Golgi apparatus", isCorrect: false }
        ],
        explanation: "Mitochondria are called the 'powerhouse of the cell' because they produce ATP, the cell's main energy currency",
        difficulty: "easy",
        topics: ["science", "biology"],
        tags: ["cell-biology", "organelles", "mitochondria"],
        metadata: {
            subject: "Biology",
            grade: "High School",
            estimatedTime: 35,
            points: 1
        },
        analytics: {
            totalAttempts: 120,
            correctAttempts: 96,
            averageTime: 32
        }
    },

    // Programming Questions
    {
        questionText: "Which of the following is NOT a JavaScript data type?",
        questionType: "multiple-choice",
        options: [
            { text: "string", isCorrect: false },
            { text: "boolean", isCorrect: false },
            { text: "float", isCorrect: true },
            { text: "undefined", isCorrect: false }
        ],
        explanation: "JavaScript uses 'number' for all numeric values, not separate 'float' and 'int' types like some other languages",
        difficulty: "medium",
        topics: ["programming", "javascript"],
        tags: ["javascript", "data-types", "programming"],
        metadata: {
            subject: "Computer Science",
            grade: "College",
            estimatedTime: 40,
            points: 1
        },
        analytics: {
            totalAttempts: 85,
            correctAttempts: 51,
            averageTime: 45
        }
    },
    {
        questionText: "What does 'HTML' stand for?",
        questionType: "multiple-choice",
        options: [
            { text: "Hyper Text Markup Language", isCorrect: true },
            { text: "High Tech Modern Language", isCorrect: false },
            { text: "Home Tool Markup Language", isCorrect: false },
            { text: "Hyperlink and Text Markup Language", isCorrect: false }
        ],
        explanation: "HTML stands for HyperText Markup Language, used for creating web pages",
        difficulty: "easy",
        topics: ["programming", "web-development"],
        tags: ["html", "web-development", "markup"],
        metadata: {
            subject: "Web Development",
            grade: "Beginner",
            estimatedTime: 25,
            points: 1
        },
        analytics: {
            totalAttempts: 200,
            correctAttempts: 180,
            averageTime: 20
        }
    },

    // History Questions
    {
        questionText: "In which year did World War II end?",
        questionType: "multiple-choice",
        options: [
            { text: "1944", isCorrect: false },
            { text: "1945", isCorrect: true },
            { text: "1946", isCorrect: false },
            { text: "1947", isCorrect: false }
        ],
        explanation: "World War II ended in 1945 with Japan's surrender in September",
        difficulty: "easy",
        topics: ["history", "world-war"],
        tags: ["wwii", "world-history", "20th-century"],
        metadata: {
            subject: "History",
            grade: "High School",
            estimatedTime: 30,
            points: 1
        },
        analytics: {
            totalAttempts: 160,
            correctAttempts: 128,
            averageTime: 25
        }
    },
    {
        questionText: "Who was the first President of the United States?",
        questionType: "multiple-choice",
        options: [
            { text: "Thomas Jefferson", isCorrect: false },
            { text: "George Washington", isCorrect: true },
            { text: "John Adams", isCorrect: false },
            { text: "Benjamin Franklin", isCorrect: false }
        ],
        explanation: "George Washington served as the first President of the United States from 1789 to 1797",
        difficulty: "easy",
        topics: ["history", "american-history"],
        tags: ["presidents", "american-history", "founding-fathers"],
        metadata: {
            subject: "American History",
            grade: "Elementary",
            estimatedTime: 25,
            points: 1
        },
        analytics: {
            totalAttempts: 220,
            correctAttempts: 198,
            averageTime: 20
        }
    },

    // Geography Questions
    {
        questionText: "What is the capital of Australia?",
        questionType: "multiple-choice",
        options: [
            { text: "Sydney", isCorrect: false },
            { text: "Melbourne", isCorrect: false },
            { text: "Canberra", isCorrect: true },
            { text: "Perth", isCorrect: false }
        ],
        explanation: "Canberra is the capital of Australia, despite Sydney and Melbourne being larger cities",
        difficulty: "medium",
        topics: ["geography", "capitals"],
        tags: ["capitals", "australia", "geography"],
        metadata: {
            subject: "Geography",
            grade: "Middle School",
            estimatedTime: 35,
            points: 1
        },
        analytics: {
            totalAttempts: 140,
            correctAttempts: 84,
            averageTime: 40
        }
    },
    {
        questionText: "Which is the longest river in the world?",
        questionType: "multiple-choice",
        options: [
            { text: "Amazon River", isCorrect: false },
            { text: "Nile River", isCorrect: true },
            { text: "Mississippi River", isCorrect: false },
            { text: "Yangtze River", isCorrect: false }
        ],
        explanation: "The Nile River is traditionally considered the longest river in the world at approximately 6,650 km",
        difficulty: "medium",
        topics: ["geography", "rivers"],
        tags: ["rivers", "world-geography", "physical-features"],
        metadata: {
            subject: "Geography",
            grade: "High School",
            estimatedTime: 40,
            points: 1
        },
        analytics: {
            totalAttempts: 110,
            correctAttempts: 77,
            averageTime: 38
        }
    }
];

// Database seeding functions
async function connectDatabase() {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/quizzed', {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        console.log('✅ Connected to MongoDB');
    } catch (error) {
        console.error('❌ MongoDB connection error:', error);
        process.exit(1);
    }
}

async function clearDatabase() {
    console.log('🗑️  Clearing existing data...');
    await User.deleteMany({});
    await Question.deleteMany({});
    await QuizAttempt.deleteMany({});
    console.log('✅ Database cleared');
}

async function seedUsers() {
    console.log('👥 Seeding users...');
    
    const users = [];
    for (const userData of sampleUsers) {
        const user = new User(userData);
        await user.save();
        users.push(user);
        console.log(`✅ Created user: ${userData.username}`);
    }
    
    return users;
}

async function seedQuestions(users) {
    console.log('❓ Seeding questions...');
    
    const adminUser = users.find(u => u.role === 'admin');
    const questions = [];
    
    for (const questionData of sampleQuestions) {
        const question = new Question({
            ...questionData,
            createdBy: adminUser._id,
            status: 'active'
        });
        await question.save();
        questions.push(question);
        console.log(`✅ Created question: ${questionData.questionText.substring(0, 50)}...`);
    }
    
    return questions;
}

async function seedQuizAttempts(users, questions) {
    console.log('📊 Seeding quiz attempts...');
    
    const studentUsers = users.filter(u => u.role === 'student');
    const attempts = [];
    
    for (const user of studentUsers) {
        // Create 3-5 quiz attempts per student
        const numAttempts = Math.floor(Math.random() * 3) + 3;
        
        for (let i = 0; i < numAttempts; i++) {
            // Random topic
            const topics = ['mathematics', 'science', 'programming', 'history', 'geography'];
            const randomTopic = topics[Math.floor(Math.random() * topics.length)];
            
            // Get questions for this topic
            const topicQuestions = questions.filter(q => q.topics.includes(randomTopic));
            const numQuestions = Math.min(5, topicQuestions.length);
            const selectedQuestions = topicQuestions.slice(0, numQuestions);
            
            if (selectedQuestions.length === 0) continue;
            
            // Generate answers
            const answers = selectedQuestions.map(question => {
                const isCorrect = Math.random() > 0.3; // 70% chance of correct answer
                let selectedIndex;
                
                if (isCorrect) {
                    selectedIndex = question.options.findIndex(opt => opt.isCorrect);
                } else {
                    // Select random incorrect answer
                    const incorrectIndices = question.options
                        .map((opt, index) => opt.isCorrect ? -1 : index)
                        .filter(index => index !== -1);
                    selectedIndex = incorrectIndices[Math.floor(Math.random() * incorrectIndices.length)];
                }
                
                return {
                    questionId: question._id,
                    selectedIndex,
                    isCorrect,
                    timeSpent: Math.floor(Math.random() * 60) + 30, // 30-90 seconds
                    submittedAt: new Date()
                };
            });
            
            const score = Math.round((answers.filter(a => a.isCorrect).length / answers.length) * 100);
            const totalTimeSpent = answers.reduce((sum, a) => sum + a.timeSpent, 0);
            
            // Create quiz attempt
            const attempt = new QuizAttempt({
                userId: user._id,
                topicId: randomTopic,
                questions: selectedQuestions.map(q => q._id),
                answers,
                score,
                timeSpent: totalTimeSpent,
                startedAt: new Date(Date.now() - totalTimeSpent * 1000 - Math.random() * 7 * 24 * 60 * 60 * 1000), // Random date within last week
                completedAt: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000),
                status: 'completed',
                timeLimit: 600
            });
            
            await attempt.save();
            attempts.push(attempt);
        }
        
        console.log(`✅ Created quiz attempts for user: ${user.username}`);
    }
    
    return attempts;
}

async function updateUserStats(users) {
    console.log('📈 Updating user statistics...');
    
    for (const user of users) {
        const userAttempts = await QuizAttempt.find({ userId: user._id, status: 'completed' });
        
        if (userAttempts.length > 0) {
            const totalScore = userAttempts.reduce((sum, attempt) => sum + attempt.score, 0);
            const averageScore = totalScore / userAttempts.length;
            const topicsStudied = [...new Set(userAttempts.map(attempt => attempt.topicId))];
            
            user.stats = {
                totalQuizzesTaken: userAttempts.length,
                totalScore: Math.round(totalScore),
                averageScore: Math.round(averageScore),
                topicsStudied
            };
            
            await user.save();
            console.log(`✅ Updated stats for user: ${user.username} (${userAttempts.length} quizzes, ${Math.round(averageScore)}% avg)`);
        }
    }
}

// Main seeding function
async function seedDatabase() {
    try {
        console.log('🌱 Starting database seeding...');
        console.log('='.repeat(50));
        
        await connectDatabase();
        await clearDatabase();
        
        const users = await seedUsers();
        const questions = await seedQuestions(users);
        const attempts = await seedQuizAttempts(users, questions);
        await updateUserStats(users);
        
        console.log('='.repeat(50));
        console.log('🎉 Database seeding completed successfully!');
        console.log(`👥 Users created: ${users.length}`);
        console.log(`❓ Questions created: ${questions.length}`);
        console.log(`📊 Quiz attempts created: ${attempts.length}`);
        console.log('='.repeat(50));
        
        console.log('\n📋 Sample Login Credentials:');
        console.log('Admin: admin@quizzed.com / admin123');
        console.log('Student: john@example.com / password123');
        console.log('Student: jane@example.com / password123');
        
        process.exit(0);
        
    } catch (error) {
        console.error('❌ Seeding failed:', error);
        process.exit(1);
    }
}

// Run seeding if called directly
if (require.main === module) {
    seedDatabase();
}

module.exports = {
    seedDatabase,
    sampleUsers,
    sampleQuestions
};