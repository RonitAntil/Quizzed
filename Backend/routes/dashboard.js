const express = require('express');
const mongoose = require('mongoose');
const QuizAttempt = require('../models/QuizAttempt');
const Question = require('../models/Question');
const User = require('../models/User');
const { auth } = require('../middleware/auth');

const router = express.Router();

// Helper functions (moved outside of router methods)
async function getPerformanceAnalytics(userId) {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentAttempts = await QuizAttempt.find({
        userId,
        status: 'completed',
        completedAt: { $gte: thirtyDaysAgo }
    }).sort({ completedAt: 1 });

    if (recentAttempts.length === 0) {
        return {
            averageScore: 0,
            totalQuizzes: 0,
            improvement: 0,
            consistencyScore: 0,
            weeklyData: []
        };
    }

    const scores = recentAttempts.map(a => a.score);
    const averageScore = scores.reduce((a, b) => a + b, 0) / scores.length;
    
    // Calculate improvement (comparing first half vs second half)
    const mid = Math.floor(scores.length / 2);
    const firstHalf = scores.slice(0, mid);
    const secondHalf = scores.slice(mid);
    const improvement = secondHalf.length > 0 && firstHalf.length > 0 ?
        (secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length) -
        (firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length) : 0;

    // Calculate consistency (lower standard deviation = more consistent)
    const mean = averageScore;
    const variance = scores.reduce((sum, score) => sum + Math.pow(score - mean, 2), 0) / scores.length;
    const standardDeviation = Math.sqrt(variance);
    const consistencyScore = Math.max(0, 100 - standardDeviation);

    // Generate weekly data for charts
    const weeklyData = generateWeeklyData(recentAttempts);

    return {
        averageScore: Math.round(averageScore),
        totalQuizzes: recentAttempts.length,
        improvement: Math.round(improvement),
        consistencyScore: Math.round(consistencyScore),
        weeklyData
    };
}

function generateWeeklyData(attempts) {
    const weeklyData = {};
    const now = new Date();
    
    // Initialize last 4 weeks
    for (let i = 3; i >= 0; i--) {
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - (i * 7 + 6));
        const weekKey = weekStart.toISOString().split('T')[0];
        weeklyData[weekKey] = { quizzes: 0, totalScore: 0, averageScore: 0 };
    }

    // Group attempts by week
    attempts.forEach(attempt => {
        const attemptDate = new Date(attempt.completedAt);
        const weekStart = new Date(attemptDate);
        weekStart.setDate(attemptDate.getDate() - attemptDate.getDay());
        const weekKey = weekStart.toISOString().split('T')[0];
        
        if (weeklyData[weekKey]) {
            weeklyData[weekKey].quizzes++;
            weeklyData[weekKey].totalScore += attempt.score;
        }
    });

    // Calculate averages
    Object.keys(weeklyData).forEach(week => {
        const data = weeklyData[week];
        data.averageScore = data.quizzes > 0 ? Math.round(data.totalScore / data.quizzes) : 0;
    });

    return Object.entries(weeklyData).map(([week, data]) => ({
        week,
        ...data
    }));
}

async function getLearningRecommendations(userId) {
    const user = await User.findById(userId);
    const recentAttempts = await QuizAttempt.find({
        userId,
        status: 'completed'
    }).sort({ completedAt: -1 }).limit(10);

    const recommendations = [];

    // Analyze performance trends
    if (recentAttempts.length >= 3) {
        const recentScores = recentAttempts.slice(0, 3).map(a => a.score);
        const averageRecent = recentScores.reduce((a, b) => a + b, 0) / recentScores.length;

        if (averageRecent < 60) {
            recommendations.push({
                type: 'improvement',
                title: 'Focus on Fundamentals',
                description: 'Your recent scores suggest reviewing basic concepts would be helpful',
                action: 'practice-basics',
                priority: 'high'
            });
        } else if (averageRecent > 85) {
            recommendations.push({
                type: 'challenge',
                title: 'Ready for Advanced Topics',
                description: 'Your performance shows you\'re ready for more challenging material',
                action: 'try-advanced',
                priority: 'medium'
            });
        }
    }

    // Topic-based recommendations
    const topicPerformance = {};
    recentAttempts.forEach(attempt => {
        if (!topicPerformance[attempt.topicId]) {
            topicPerformance[attempt.topicId] = [];
        }
        topicPerformance[attempt.topicId].push(attempt.score);
    });

    Object.keys(topicPerformance).forEach(topic => {
        const scores = topicPerformance[topic];
        const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
        
        if (avg < 70) {
            recommendations.push({
                type: 'topic-focus',
                title: `Improve ${topic.charAt(0).toUpperCase() + topic.slice(1)}`,
                description: `Your ${topic} average is ${Math.round(avg)}%. More practice recommended.`,
                action: `study-${topic}`,
                priority: 'medium'
            });
        }
    });

    return recommendations.slice(0, 5);
}

async function getProgressTracking(userId) {
    const user = await User.findById(userId);
    const allAttempts = await QuizAttempt.find({
        userId,
        status: 'completed'
    }).sort({ completedAt: 1 });

    if (allAttempts.length === 0) {
        return {
            totalProgress: 0,
            weeklyProgress: 0,
            streak: 0,
            milestones: []
        };
    }

    // Calculate overall progress
    const firstScore = allAttempts[0].score;
    const latestScore = allAttempts[allAttempts.length - 1].score;
    const totalProgress = latestScore - firstScore;

    // Calculate weekly progress
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    const weeklyAttempts = allAttempts.filter(a => a.completedAt >= oneWeekAgo);
    const weeklyProgress = weeklyAttempts.length;

    // Calculate learning streak
    const streak = calculateLearningStreak(allAttempts);

    // Generate milestones
    const milestones = generateMilestones(user.stats);

    return {
        totalProgress: Math.round(totalProgress),
        weeklyProgress,
        streak,
        milestones,
        totalQuizzes: allAttempts.length,
        improvementRate: calculateImprovementRate(allAttempts)
    };
}

async function getTopicMastery(userId) {
    const topicData = await QuizAttempt.aggregate([
        {
            $match: {
                userId: new mongoose.Types.ObjectId(userId),
                status: 'completed'
            }
        },
        {
            $group: {
                _id: '$topicId',
                attempts: { $sum: 1 },
                averageScore: { $avg: '$score' },
                bestScore: { $max: '$score' },
                totalTimeSpent: { $sum: '$timeSpent' },
                lastAttempt: { $max: '$completedAt' }
            }
        },
        {
            $project: {
                topic: '$_id',
                attempts: 1,
                averageScore: { $round: ['$averageScore', 1] },
                bestScore: 1,
                masteryLevel: {
                    $switch: {
                        branches: [
                            { case: { $gte: ['$averageScore', 90] }, then: 'expert' },
                            { case: { $gte: ['$averageScore', 75] }, then: 'advanced' },
                            { case: { $gte: ['$averageScore', 60] }, then: 'intermediate' },
                            { case: { $gte: ['$averageScore', 40] }, then: 'beginner' }
                        ],
                        default: 'novice'
                    }
                },
                totalTimeSpent: { $round: [{ $divide: ['$totalTimeSpent', 60] }, 0] }, // Convert to minutes
                lastAttempt: 1,
                _id: 0
            }
        },
        { $sort: { averageScore: -1 } }
    ]);

    return topicData;
}

function calculateLearningStreak(attempts) {
    if (attempts.length === 0) return 0;

    let streak = 0;
    const today = new Date();
    
    // Check for consecutive days of learning
    for (let i = attempts.length - 1; i >= 0; i--) {
        const attemptDate = new Date(attempts[i].completedAt);
        const daysDiff = Math.floor((today - attemptDate) / (1000 * 60 * 60 * 24));
        
        if (daysDiff === streak) {
            streak++;
        } else if (daysDiff > streak) {
            break;
        }
    }

    return streak;
}

function generateMilestones(userStats) {
    const milestones = [];
    
    // Quiz count milestones
    const quizMilestones = [10, 25, 50, 100, 250, 500];
    const currentQuizCount = userStats?.totalQuizzesTaken || 0;
    
    quizMilestones.forEach(milestone => {
        if (currentQuizCount >= milestone) {
            milestones.push({
                type: 'quizzes',
                title: `${milestone} Quizzes Completed`,
                achieved: true,
                achievedAt: new Date(),
                description: `You've completed ${milestone} quizzes!`
            });
        } else if (milestone === quizMilestones.find(m => m > currentQuizCount)) {
            milestones.push({
                type: 'quizzes',
                title: `${milestone} Quizzes Goal`,
                achieved: false,
                progress: Math.round((currentQuizCount / milestone) * 100),
                description: `Complete ${milestone - currentQuizCount} more quizzes to unlock this milestone`
            });
        }
    });

    return milestones.slice(0, 10);
}

function calculateImprovementRate(attempts) {
    if (attempts.length < 5) return 0;

    const firstFive = attempts.slice(0, 5);
    const lastFive = attempts.slice(-5);
    
    const firstAvg = firstFive.reduce((sum, a) => sum + a.score, 0) / firstFive.length;
    const lastAvg = lastFive.reduce((sum, a) => sum + a.score, 0) / lastFive.length;
    
    return lastAvg - firstAvg;
}

function createDefaultGoals() {
    return [
        {
            id: 'quiz-streak',
            title: 'Take a quiz every day for 7 days',
            type: 'streak',
            target: 7,
            current: 0,
            deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            status: 'active'
        },
        {
            id: 'score-improvement',
            title: 'Achieve 80% average score',
            type: 'performance',
            target: 80,
            current: 0,
            deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            status: 'active'
        }
    ];
}

async function calculateGoalProgress(userId, goal) {
    switch (goal.type) {
        case 'streak':
            const streakDays = await calculateCurrentStreak(userId);
            return {
                current: streakDays,
                percentage: Math.min(100, (streakDays / goal.target) * 100),
                completed: streakDays >= goal.target
            };

        case 'performance':
            const user = await User.findById(userId);
            const currentAvg = user.stats?.averageScore || 0;
            return {
                current: currentAvg,
                percentage: Math.min(100, (currentAvg / goal.target) * 100),
                completed: currentAvg >= goal.target
            };

        default:
            return { current: 0, percentage: 0, completed: false };
    }
}

async function calculateCurrentStreak(userId) {
    const attempts = await QuizAttempt.find({
        userId,
        status: 'completed'
    }).sort({ completedAt: -1 });

    return calculateLearningStreak(attempts);
}

// Routes
// @route   GET /api/dashboard
// @desc    Get user dashboard data
// @access  Private
router.get('/', auth, async (req, res) => {
    try {
        const userId = req.userId;

        // Get user basic info
        const user = await User.findById(userId).select('-password');

        // Get recent quiz attempts
        const recentQuizzes = await QuizAttempt.find({
            userId,
            status: 'completed'
        }).sort({ completedAt: -1 }).limit(5).lean();

        // Get performance analytics
        const performanceData = await getPerformanceAnalytics(userId);

        // Get learning recommendations
        const recommendations = await getLearningRecommendations(userId);

        // Get progress tracking
        const progressData = await getProgressTracking(userId);

        // Get topic mastery levels
        const topicMastery = await getTopicMastery(userId);

        res.json({
            success: true,
            data: {
                user: {
                    username: user.username,
                    profile: user.profile,
                    stats: user.stats,
                    preferences: user.preferences
                },
                recentQuizzes: recentQuizzes.map(quiz => ({
                    id: quiz._id,
                    topicId: quiz.topicId,
                    score: quiz.score,
                    completedAt: quiz.completedAt,
                    timeSpent: Math.round((quiz.timeSpent || 0) / 60), // Convert to minutes
                    questionsAnswered: quiz.answers?.length || 0
                })),
                performance: performanceData,
                recommendations,
                progress: progressData,
                topicMastery
            }
        });

    } catch (error) {
        console.error('Dashboard error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to load dashboard data'
        });
    }
});

// @route   GET /api/dashboard/analytics
// @desc    Get detailed analytics for the user
// @access  Private
router.get('/analytics', auth, async (req, res) => {
    try {
        const userId = req.userId;
        const { timeframe = '30d' } = req.query;

        // Calculate date range
        const daysBack = timeframe === '7d' ? 7 : timeframe === '30d' ? 30 : 90;
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - daysBack);

        // Get quiz attempts in timeframe
        const attempts = await QuizAttempt.find({
            userId,
            status: 'completed',
            completedAt: { $gte: startDate }
        }).populate('questions').sort({ completedAt: 1 });

        // Generate analytics
        const analytics = {
            overview: {
                totalQuizzes: attempts.length,
                averageScore: attempts.length > 0 ? 
                    Math.round(attempts.reduce((sum, a) => sum + a.score, 0) / attempts.length) : 0,
                totalTimeStudied: Math.round(attempts.reduce((sum, a) => sum + (a.timeSpent || 0), 0) / 3600),
                improvementRate: calculateImprovementRate(attempts)
            },
            performance: {
                scoreDistribution: { '0-25': 0, '26-50': 0, '51-75': 0, '76-100': 0 },
                consistencyScore: 0
            },
            topics: attempts.reduce((acc, attempt) => {
                if (!acc[attempt.topicId]) {
                    acc[attempt.topicId] = {
                        scores: [],
                        attempts: 0,
                        totalTime: 0
                    };
                }
                acc[attempt.topicId].scores.push(attempt.score);
                acc[attempt.topicId].attempts++;
                acc[attempt.topicId].totalTime += attempt.timeSpent || 0;
                return acc;
            }, {}),
            trends: { trend: 'stable', trendScore: 0 },
            streaks: { currentStreak: 0, longestStreak: 0 },
            timeAnalysis: { averageTimePerQuiz: 0, totalTimeStudied: 0 }
        };

        res.json({
            success: true,
            analytics,
            timeframe,
            dataPoints: attempts.length
        });

    } catch (error) {
        console.error('Analytics error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to generate analytics'
        });
    }
});

// @route   GET /api/dashboard/leaderboard
// @desc    Get leaderboard data
// @access  Private
router.get('/leaderboard', auth, async (req, res) => {
    try {
        const { topicId, timeframe = '30d' } = req.query;
        const userId = req.userId;

        // Calculate date range
        const daysBack = timeframe === '7d' ? 7 : timeframe === '30d' ? 30 : 90;
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - daysBack);

        // Build aggregation pipeline
        const matchStage = {
            status: 'completed',
            completedAt: { $gte: startDate }
        };

        if (topicId) {
            matchStage.topicId = topicId;
        }

        const leaderboard = await QuizAttempt.aggregate([
            { $match: matchStage },
            {
                $group: {
                    _id: '$userId',
                    totalQuizzes: { $sum: 1 },
                    averageScore: { $avg: '$score' },
                    totalPoints: { $sum: '$score' },
                    bestScore: { $max: '$score' }
                }
            },
            {
                $lookup: {
                    from: 'users',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'userInfo'
                }
            },
            { $unwind: '$userInfo' },
            {
                $project: {
                    username: '$userInfo.username',
                    avatar: '$userInfo.profile.avatar',
                    totalQuizzes: 1,
                    averageScore: { $round: ['$averageScore', 1] },
                    totalPoints: 1,
                    bestScore: 1,
                    isCurrentUser: { $eq: ['$_id', new mongoose.Types.ObjectId(userId)] }
                }
            },
            { $sort: { averageScore: -1, totalQuizzes: -1 } },
            { $limit: 20 }
        ]);

        // Find current user's rank
        const userRank = leaderboard.findIndex(entry => entry.isCurrentUser) + 1;

        res.json({
            success: true,
            leaderboard,
            userRank: userRank || null,
            totalParticipants: leaderboard.length,
            timeframe
        });

    } catch (error) {
        console.error('Leaderboard error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to load leaderboard'
        });
    }
});

// @route   GET /api/dashboard/goals
// @desc    Get and manage user learning goals
// @access  Private
router.get('/goals', auth, async (req, res) => {
    try {
        const userId = req.userId;
        const user = await User.findById(userId);

        // Get or create default goals
        const goals = user.learningGoals || createDefaultGoals();

        // Calculate progress for each goal
        const goalsWithProgress = await Promise.all(
            goals.map(async (goal) => {
                const progress = await calculateGoalProgress(userId, goal);
                return { ...goal, progress };
            })
        );

        res.json({
            success: true,
            goals: goalsWithProgress
        });

    } catch (error) {
        console.error('Goals error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to load goals'
        });
    }
});

// @route   POST /api/dashboard/goals
// @desc    Set new learning goals
// @access  Private
router.post('/goals', auth, async (req, res) => {
    try {
        const userId = req.userId;
        const { goals } = req.body;

        const user = await User.findById(userId);
        user.learningGoals = goals.map(goal => ({
            ...goal,
            createdAt: new Date(),
            status: 'active'
        }));

        await user.save();

        res.json({
            success: true,
            message: 'Goals updated successfully',
            goals: user.learningGoals
        });

    } catch (error) {
        console.error('Goals update error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update goals'
        });
    }
});

module.exports = router;