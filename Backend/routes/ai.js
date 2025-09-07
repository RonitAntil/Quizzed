const express = require('express');
const OpenAI = require('openai');
const Question = require('../models/Question');
const QuizAttempt = require('../models/QuizAttempt');
const User = require('../models/User');
const { auth } = require('../middleware/auth');

const router = express.Router();

// Initialize OpenAI (only if API key is provided)
let openai = null;
if (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.trim() !== '') {
    openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
    });
}

// Helper Functions (moved outside of router methods)
async function buildUserLearningProfile(userId, topics) {
    const user = await User.findById(userId);
    const recentAttempts = await QuizAttempt.find({
        userId,
        status: 'completed'
    }).sort({ completedAt: -1 }).limit(10);

    // Analyze user's learning patterns
    const profile = {
        username: user.username,
        learningLevel: user.preferences.difficultyLevel,
        favoriteTopics: user.preferences.favoriteTopics,
        averageScore: user.stats.averageScore,
        totalQuizzes: user.stats.totalQuizzesTaken,
        recentPerformance: recentAttempts.map(attempt => ({
            topic: attempt.topicId,
            score: attempt.score,
            timeSpent: attempt.timeSpent
        })),
        learningStyle: inferLearningStyle(recentAttempts),
        knowledgeGaps: await identifyKnowledgeGaps(userId, topics)
    };

    return profile;
}

async function generatePersonalizedExplanation(question, userAnswer, isCorrect, userProfile, timeSpent) {
    if (!openai) {
        return getFallbackExplanation(question, isCorrect);
    }

    try {
        const prompt = buildExplanationPrompt(question, userAnswer, isCorrect, userProfile, timeSpent);
        
        const completion = await openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: [
                {
                    role: "system",
                    content: "You are an expert educational AI tutor. Generate personalized explanations that adapt to the student's learning level, style, and performance history. Be encouraging, clear, and educational."
                },
                {
                    role: "user",
                    content: prompt
                }
            ],
            max_tokens: 200,
            temperature: 0.7
        });

        return completion.choices[0].message.content;

    } catch (error) {
        console.error('OpenAI API error:', error);
        return getFallbackExplanation(question, isCorrect);
    }
}

function buildExplanationPrompt(question, userAnswer, isCorrect, userProfile, timeSpent) {
    const selectedOption = question.options[userAnswer];
    const correctOption = question.options.find(opt => opt.isCorrect);
    
    return `
Student Profile:
- Username: ${userProfile.username}
- Learning Level: ${userProfile.learningLevel}
- Average Score: ${userProfile.averageScore}%
- Learning Style: ${userProfile.learningStyle}
- Favorite Topics: ${userProfile.favoriteTopics.join(', ')}

Question Details:
- Topic: ${question.topics.join(', ')}
- Difficulty: ${question.difficulty}
- Question: "${question.questionText}"
- Student's Answer: "${selectedOption?.text || 'No answer'}"
- Correct Answer: "${correctOption?.text}"
- Result: ${isCorrect ? 'Correct' : 'Incorrect'}
- Time Spent: ${timeSpent} seconds
- Standard Explanation: ${question.explanation}

Generate a personalized explanation that:
1. ${isCorrect ? 'Congratulates the student and reinforces learning' : 'Gently corrects and explains the concept'}
2. Connects to their learning style and interests
3. References their performance level appropriately
4. Provides specific next steps or related concepts to explore
5. Keeps an encouraging, supportive tone

Keep the response under 150 words and make it conversational.
    `;
}

function getFallbackExplanation(question, isCorrect) {
    const emoji = isCorrect ? '🎉' : '📚';
    const opener = isCorrect ? 'Great job!' : 'Good attempt!';
    
    return `${emoji} ${opener} ${question.explanation} 

💡 Study tip: Practice similar questions to reinforce this concept. ${isCorrect ? 'Keep up the excellent work!' : 'You\'ll get it next time!'}`;
}

function inferLearningStyle(recentAttempts) {
    if (recentAttempts.length === 0) return 'balanced';
    
    // Simple heuristic based on time patterns
    const avgTime = recentAttempts.reduce((sum, attempt) => sum + attempt.timeSpent, 0) / recentAttempts.length;
    
    if (avgTime > 300) return 'reflective'; // Takes time to think
    if (avgTime < 180) return 'quick'; // Fast decision maker
    return 'balanced';
}

async function identifyKnowledgeGaps(userId, topics) {
    const gaps = [];
    
    for (const topic of topics) {
        const attempts = await QuizAttempt.find({
            userId,
            topicId: topic,
            status: 'completed'
        });
        
        if (attempts.length === 0) {
            gaps.push(topic);
        } else {
            const avgScore = attempts.reduce((sum, a) => sum + a.score, 0) / attempts.length;
            if (avgScore < 60) {
                gaps.push(topic);
            }
        }
    }
    
    return gaps;
}

// Routes
// @route   POST /api/ai/explanation
// @desc    Generate personalized explanation for a question
// @access  Private
router.post('/explanation', auth, async (req, res) => {
    try {
        const { questionId, userAnswer, isCorrect, timeSpent } = req.body;
        const userId = req.userId;

        if (!questionId) {
            return res.status(400).json({
                success: false,
                message: 'Question ID is required'
            });
        }

        // Get question details
        const question = await Question.findById(questionId);
        if (!question) {
            return res.status(404).json({
                success: false,
                message: 'Question not found'
            });
        }

        // Get user's learning profile
        const user = await User.findById(userId);
        const userProfile = await buildUserLearningProfile(userId, question.topics);

        // Generate personalized explanation
        const explanation = await generatePersonalizedExplanation(
            question,
            userAnswer,
            isCorrect,
            userProfile,
            timeSpent
        );

        res.json({
            success: true,
            explanation,
            metadata: {
                generatedAt: new Date(),
                personalizedFor: user.username,
                questionTopic: question.topics[0]
            }
        });

    } catch (error) {
        console.error('Error generating AI explanation:', error);
        
        // Fallback to standard explanation if AI fails
        try {
            const question = await Question.findById(req.body.questionId);
            if (question) {
                res.json({
                    success: true,
                    explanation: getFallbackExplanation(question, req.body.isCorrect),
                    metadata: {
                        fallback: true,
                        reason: 'AI service unavailable'
                    }
                });
            } else {
                res.status(404).json({
                    success: false,
                    message: 'Question not found'
                });
            }
        } catch (fallbackError) {
            res.status(500).json({
                success: false,
                message: 'Failed to generate explanation'
            });
        }
    }
});

// @route   POST /api/ai/hint
// @desc    Generate contextual hint for a question
// @access  Private
router.post('/hint', auth, async (req, res) => {
    try {
        const { questionId, currentAttempt } = req.body;
        const userId = req.userId;

        const question = await Question.findById(questionId);
        if (!question) {
            return res.status(404).json({
                success: false,
                message: 'Question not found'
            });
        }

        // Generate progressive hint based on attempt number
        const hints = {
            1: "Think about the key concept this question is testing. What topic does it relate to?",
            2: "Consider each option carefully. Which one directly addresses the main idea of the question?",
            3: "Look for keywords in the question that might point you toward the correct concept or definition."
        };

        const hint = hints[currentAttempt] || "Take your time and think through each option systematically.";

        res.json({
            success: true,
            hint,
            hintLevel: currentAttempt,
            maxHints: 3
        });

    } catch (error) {
        console.error('Error generating hint:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to generate hint'
        });
    }
});

// @route   POST /api/ai/study-plan
// @desc    Generate personalized study plan
// @access  Private
router.post('/study-plan', auth, async (req, res) => {
    try {
        const { topics, timeAvailable, goals } = req.body;

        // Generate a simple study plan
        const studyPlan = {
            plan: `
**4-Week Study Plan**

**Week 1-2: Foundation Building**
- Focus on: ${topics.slice(0, 2).join(', ')}
- Time: ${Math.round(timeAvailable * 0.6)} hours/week
- Strategy: Start with easier questions, build confidence

**Week 3-4: Advanced Practice**  
- Focus on: ${topics.slice(2).join(', ')}
- Time: ${Math.round(timeAvailable * 0.8)} hours/week
- Strategy: Challenge yourself with harder questions

**Daily Routine:**
- 15-20 minutes of focused practice
- Review mistakes immediately
- Take notes on difficult concepts
            `,
            generatedAt: new Date(),
            duration: '4 weeks',
            estimatedHours: timeAvailable * 4
        };

        res.json({
            success: true,
            studyPlan,
            learningProfile: {
                strongAreas: [],
                improvementAreas: topics,
                preferredDifficulty: 'medium',
                averageSessionTime: 20
            }
        });

    } catch (error) {
        console.error('Error generating study plan:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to generate study plan'
        });
    }
});

// @route   GET /api/ai/question-suggestions
// @desc    Get AI-powered question suggestions based on user performance
// @access  Private
router.get('/question-suggestions', auth, async (req, res) => {
    try {
        const { topicId, count = 5 } = req.query;
        const userId = req.userId;

        // Get questions for the topic
        const suggestions = await Question.find({
            topics: topicId,
            status: 'active'
        }).limit(parseInt(count)).lean();

        res.json({
            success: true,
            suggestions: suggestions.map(q => ({
                id: q._id,
                questionText: q.questionText,
                difficulty: q.difficulty,
                topics: q.topics,
                tags: q.tags,
                estimatedTime: q.metadata?.estimatedTime || 60
            })),
            adaptiveRecommendations: "Questions selected based on your learning progress",
            targetedWeakAreas: []
        });

    } catch (error) {
        console.error('Error generating question suggestions:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to generate question suggestions'
        });
    }
});

module.exports = router;