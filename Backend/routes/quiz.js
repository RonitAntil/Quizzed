const express = require('express');
const Question = require('../models/Question');
const User = require('../models/User');
const QuizAttempt = require('../models/QuizAttempt');
const { auth, optionalAuth } = require('../middleware/auth');

const router = express.Router();

// Helper Functions (moved outside router)
function formatTopicName(topicName) {
    return topicName.split('-').map(word => 
        word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
}

function getTopicDescription(topicName) {
    const descriptions = {
        'mathematics': 'Algebra, Calculus, Geometry, Statistics',
        'science': 'Physics, Chemistry, Biology, Earth Science',
        'history': 'World History, Ancient Civilizations, Modern Events',
        'literature': 'Classic Literature, Poetry, Literary Analysis',
        'geography': 'World Geography, Countries, Capitals, Physical Features',
        'programming': 'JavaScript, Python, Algorithms, Data Structures',
        'english': 'Grammar, Vocabulary, Reading Comprehension',
        'art': 'Art History, Techniques, Famous Artists',
        'music': 'Music Theory, Composers, Musical Instruments',
        'philosophy': 'Logic, Ethics, Metaphysics, Famous Philosophers'
    };
    return descriptions[topicName] || 'Comprehensive questions on this subject';
}

function getTopicIcon(topicName) {
    const icons = {
        'mathematics': 'fas fa-calculator',
        'science': 'fas fa-atom',
        'history': 'fas fa-landmark',
        'literature': 'fas fa-book',
        'geography': 'fas fa-globe',
        'programming': 'fas fa-code',
        'english': 'fas fa-language',
        'art': 'fas fa-palette',
        'music': 'fas fa-music',
        'philosophy': 'fas fa-brain'
    };
    return icons[topicName] || 'fas fa-question-circle';
}

function calculateTopicDifficulty(difficulties) {
    if (difficulties.includes('hard')) return 'hard';
    if (difficulties.includes('medium')) return 'medium';
    return 'easy';
}

async function getUserTopicHistory(userId, topicId) {
    const attempts = await QuizAttempt.find({
        userId,
        topicId,
        status: 'completed'
    }).sort({ completedAt: -1 }).limit(10);

    return {
        averageScore: attempts.length > 0 ? 
            attempts.reduce((sum, attempt) => sum + attempt.score, 0) / attempts.length : 0,
        totalAttempts: attempts.length,
        recentPerformance: attempts.slice(0, 3),
        weakAreas: [], // Would be calculated from wrong answers
        strongAreas: [] // Would be calculated from consistent correct answers
    };
}

function personalizeQuestionSelection(questions, userHistory, requestedCount) {
    // Shuffle questions
    const shuffled = questions.sort(() => Math.random() - 0.5);
    
    // If user has history, adjust selection based on performance
    if (userHistory.totalAttempts > 0) {
        // Mix of difficulties based on user's average score
        const avgScore = userHistory.averageScore;
        let easyCount, mediumCount, hardCount;
        
        if (avgScore >= 80) {
            // High performer - more challenging questions
            easyCount = Math.floor(requestedCount * 0.2);
            mediumCount = Math.floor(requestedCount * 0.3);
            hardCount = requestedCount - easyCount - mediumCount;
        } else if (avgScore >= 60) {
            // Medium performer - balanced mix
            easyCount = Math.floor(requestedCount * 0.3);
            mediumCount = Math.floor(requestedCount * 0.5);
            hardCount = requestedCount - easyCount - mediumCount;
        } else {
            // Struggling learner - more easier questions
            easyCount = Math.floor(requestedCount * 0.5);
            mediumCount = Math.floor(requestedCount * 0.4);
            hardCount = requestedCount - easyCount - mediumCount;
        }

        const selectedQuestions = [
            ...shuffled.filter(q => q.difficulty === 'easy').slice(0, easyCount),
            ...shuffled.filter(q => q.difficulty === 'medium').slice(0, mediumCount),
            ...shuffled.filter(q => q.difficulty === 'hard').slice(0, hardCount)
        ];

        return selectedQuestions.slice(0, requestedCount);
    }
    
    // For new users, start with easier questions
    return shuffled.slice(0, requestedCount);
}

function analyzeTopicPerformance(recentAttempts) {
    const topicScores = {};
    
    recentAttempts.forEach(attempt => {
        if (!topicScores[attempt.topicId]) {
            topicScores[attempt.topicId] = {
                scores: [],
                totalAttempts: 0
            };
        }
        topicScores[attempt.topicId].scores.push(attempt.score);
        topicScores[attempt.topicId].totalAttempts++;
    });

    // Calculate averages and trends
    Object.keys(topicScores).forEach(topicId => {
        const scores = topicScores[topicId].scores;
        topicScores[topicId].averageScore = scores.reduce((a, b) => a + b, 0) / scores.length;
        topicScores[topicId].trend = calculateTrend(scores);
    });

    return topicScores;
}

function calculateTrend(scores) {
    if (scores.length < 2) return 'stable';
    
    const recent = scores.slice(-3).reduce((a, b) => a + b, 0) / Math.min(3, scores.length);
    const earlier = scores.slice(0, -3).reduce((a, b) => a + b, 0) / Math.max(1, scores.length - 3);
    
    if (recent > earlier + 5) return 'improving';
    if (recent < earlier - 5) return 'declining';
    return 'stable';
}

async function generateRecommendations(user, topicPerformance) {
    const recommendations = [];
    
    // Recommend topics where user is struggling
    Object.keys(topicPerformance).forEach(topicId => {
        const perf = topicPerformance[topicId];
        if (perf.averageScore < 70) {
            recommendations.push({
                type: 'improvement',
                topicId,
                reason: `Your average score is ${perf.averageScore.toFixed(1)}%. More practice could help!`,
                priority: 'high'
            });
        }
    });

    // Recommend new topics based on user preferences
    const studiedTopics = user.stats.topicsStudied || [];
    const allTopics = ['mathematics', 'science', 'history', 'literature', 'geography', 'programming'];
    const unstudiedTopics = allTopics.filter(topic => !studiedTopics.includes(topic));
    
    unstudiedTopics.slice(0, 2).forEach(topicId => {
        recommendations.push({
            type: 'exploration',
            topicId,
            reason: 'Based on your interests, you might enjoy this topic',
            priority: 'medium'
        });
    });

    // Recommend advanced topics for high performers
    Object.keys(topicPerformance).forEach(topicId => {
        const perf = topicPerformance[topicId];
        if (perf.averageScore >= 85) {
            recommendations.push({
                type: 'advancement',
                topicId: `advanced-${topicId}`,
                reason: `You're excelling at ${topicId}! Try advanced level questions.`,
                priority: 'medium'
            });
        }
    });

    return recommendations.slice(0, 5); // Limit to 5 recommendations
}

// Routes
// @route   GET /api/quiz/topics
// @desc    Get all available topics with question counts
// @access  Public
router.get('/topics', async (req, res) => {
    try {
        const topics = await Question.aggregate([
            { $match: { status: 'active' } },
            { $unwind: '$topics' },
            {
                $group: {
                    _id: '$topics',
                    questionCount: { $sum: 1 },
                    difficulties: { $addToSet: '$difficulty' },
                    subjects: { $addToSet: '$metadata.subject' }
                }
            },
            {
                $project: {
                    name: '$_id',
                    questionCount: 1,
                    difficulties: 1,
                    subjects: 1,
                    _id: 0
                }
            },
            { $sort: { questionCount: -1 } }
        ]);

        // Enhance with metadata and icons
        const enhancedTopics = topics.map(topic => ({
            id: topic.name.toLowerCase().replace(/\s+/g, '-'),
            name: formatTopicName(topic.name),
            description: getTopicDescription(topic.name),
            icon: getTopicIcon(topic.name),
            questionCount: topic.questionCount,
            difficulty: calculateTopicDifficulty(topic.difficulties),
            subjects: topic.subjects
        }));

        res.json({
            success: true,
            topics: enhancedTopics,
            totalTopics: enhancedTopics.length
        });

    } catch (error) {
        console.error('Error fetching topics:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch topics'
        });
    }
});

// @route   POST /api/quiz/start/:topicId
// @desc    Start a new quiz for a specific topic
// @access  Private
router.post('/start/:topicId', auth, async (req, res) => {
    try {
        const { topicId } = req.params;
        
        // Debug logging
        console.log('Quiz start request - topicId:', topicId);
        console.log('Request body:', req.body);
        console.log('Request headers:', req.headers['content-type']);
        
        // Safe destructuring with defaults
        const body = req.body || {};
        const difficulty = body.difficulty || null;
        const questionCount = body.questionCount || 10;
        
        const userId = req.userId;

        // Build query for personalized question selection
        const query = {
            status: 'active',
            topics: { $in: [topicId] }
        };

        if (difficulty) {
            query.difficulty = difficulty;
        }

        // Get user's learning history for this topic
        const userHistory = await getUserTopicHistory(userId, topicId);
        
        // Select questions based on user's performance and preferences
        let questions = await Question.find(query)
            .populate('createdBy', 'username')
            .lean();

        // Personalize question selection
        questions = personalizeQuestionSelection(questions, userHistory, questionCount);

        if (questions.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'No questions found for this topic'
            });
        }

        // Create quiz attempt record
        const quizAttempt = new QuizAttempt({
            userId,
            topicId,
            questions: questions.map(q => q._id),
            startedAt: new Date(),
            timeLimit: questionCount * 60, // 1 minute per question
            status: 'in-progress'
        });

        await quizAttempt.save();

        // Clean question data for frontend (remove correct answers)
        const cleanQuestions = questions.map(q => ({
            id: q._id,
            questionText: q.questionText,
            questionType: q.questionType,
            options: q.options.map(opt => ({ text: opt.text })), // Remove isCorrect
            difficulty: q.difficulty,
            topics: q.topics,
            tags: q.tags,
            estimatedTime: q.metadata?.estimatedTime || 60
        }));

        res.json({
            success: true,
            quiz: {
                id: quizAttempt._id,
                topicId,
                questions: cleanQuestions,
                timeLimit: quizAttempt.timeLimit,
                totalQuestions: cleanQuestions.length,
                startedAt: quizAttempt.startedAt
            }
        });

    } catch (error) {
        console.error('Error starting quiz:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to start quiz: ' + error.message
        });
    }
});

// @route   POST /api/quiz/submit-answer
// @desc    Submit answer for a quiz question
// @access  Private
router.post('/submit-answer', auth, async (req, res) => {
    try {
        const { quizAttemptId, questionId, selectedIndex, timeSpent } = req.body;
        const userId = req.userId;

        // Find the quiz attempt
        const quizAttempt = await QuizAttempt.findOne({
            _id: quizAttemptId,
            userId,
            status: 'in-progress'
        });

        if (!quizAttempt) {
            return res.status(404).json({
                success: false,
                message: 'Quiz attempt not found or already completed'
            });
        }

        // Get the question with correct answer
        const question = await Question.findById(questionId);
        if (!question) {
            return res.status(404).json({
                success: false,
                message: 'Question not found'
            });
        }

        // Check if answer is correct
        const isCorrect = question.options[selectedIndex]?.isCorrect || false;
        
        // Update question analytics
        question.analytics.totalAttempts += 1;
        if (isCorrect) {
            question.analytics.correctAttempts += 1;
        }
        question.analytics.averageTime = 
            (question.analytics.averageTime + timeSpent) / 2;
        await question.save();

        // Store answer in quiz attempt
        const answerIndex = quizAttempt.answers.findIndex(a => a.questionId.toString() === questionId);
        
        const answerData = {
            questionId,
            selectedIndex,
            isCorrect,
            timeSpent,
            submittedAt: new Date()
        };

        if (answerIndex >= 0) {
            quizAttempt.answers[answerIndex] = answerData;
        } else {
            quizAttempt.answers.push(answerData);
        }

        await quizAttempt.save();

        res.json({
            success: true,
            isCorrect,
            correctAnswer: question.options.findIndex(opt => opt.isCorrect),
            explanation: question.explanation,
            questionAnalytics: {
                successRate: (question.analytics.correctAttempts / question.analytics.totalAttempts * 100).toFixed(1)
            }
        });

    } catch (error) {
        console.error('Error submitting answer:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to submit answer'
        });
    }
});

// @route   POST /api/quiz/complete
// @desc    Complete a quiz and get results
// @access  Private
router.post('/complete', auth, async (req, res) => {
    try {
        const { quizAttemptId } = req.body;
        const userId = req.userId;

        // Find and update quiz attempt
        const quizAttempt = await QuizAttempt.findOne({
            _id: quizAttemptId,
            userId,
            status: 'in-progress'
        }).populate('questions');

        if (!quizAttempt) {
            return res.status(404).json({
                success: false,
                message: 'Quiz attempt not found'
            });
        }

        // Calculate results
        const totalQuestions = quizAttempt.questions.length;
        const correctAnswers = quizAttempt.answers.filter(a => a.isCorrect).length;
        const score = Math.round((correctAnswers / totalQuestions) * 100);
        const totalTimeSpent = quizAttempt.answers.reduce((sum, a) => sum + a.timeSpent, 0);

        // Update quiz attempt
        quizAttempt.status = 'completed';
        quizAttempt.completedAt = new Date();
        quizAttempt.score = score;
        quizAttempt.timeSpent = totalTimeSpent;
        await quizAttempt.save();

        // Update user statistics
        const user = await User.findById(userId);
        user.stats.totalQuizzesTaken += 1;
        user.stats.totalScore += score;
        user.stats.averageScore = user.stats.totalScore / user.stats.totalQuizzesTaken;
        
        // Add topic to studied topics if not already there
        if (!user.stats.topicsStudied.includes(quizAttempt.topicId)) {
            user.stats.topicsStudied.push(quizAttempt.topicId);
        }
        
        await user.save();

        res.json({
            success: true,
            results: {
                quizId: quizAttempt._id,
                score,
                correctAnswers,
                totalQuestions,
                timeSpent: totalTimeSpent,
                completedAt: quizAttempt.completedAt,
                topicId: quizAttempt.topicId
            },
            userStats: user.stats
        });

    } catch (error) {
        console.error('Error completing quiz:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to complete quiz'
        });
    }
});

// @route   GET /api/quiz/history
// @desc    Get user's quiz history
// @access  Private
router.get('/history', auth, async (req, res) => {
    try {
        const { page = 1, limit = 10, topicId } = req.query;
        const userId = req.userId;

        const query = { userId, status: 'completed' };
        if (topicId) {
            query.topicId = topicId;
        }

        const quizzes = await QuizAttempt.find(query)
            .sort({ completedAt: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit)
            .populate('questions', 'questionText topics')
            .lean();

        const total = await QuizAttempt.countDocuments(query);

        res.json({
            success: true,
            quizzes,
            pagination: {
                currentPage: page,
                totalPages: Math.ceil(total / limit),
                total,
                hasMore: page * limit < total
            }
        });

    } catch (error) {
        console.error('Error fetching quiz history:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch quiz history'
        });
    }
});

// @route   GET /api/quiz/recommendations
// @desc    Get personalized quiz recommendations
// @access  Private
router.get('/recommendations', auth, async (req, res) => {
    try {
        const userId = req.userId;
        
        // Get user's performance data
        const user = await User.findById(userId);
        const recentAttempts = await QuizAttempt.find({
            userId,
            status: 'completed',
            completedAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } // Last 30 days
        }).populate('questions');

        // Analyze weak areas
        const topicPerformance = analyzeTopicPerformance(recentAttempts);
        
        // Generate recommendations
        const recommendations = await generateRecommendations(user, topicPerformance);

        res.json({
            success: true,
            recommendations,
            topicPerformance
        });

    } catch (error) {
        console.error('Error generating recommendations:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to generate recommendations'
        });
    }
});

module.exports = router;