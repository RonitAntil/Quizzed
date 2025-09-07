const mongoose = require('mongoose');

const QuestionSchema = new mongoose.Schema({
    questionText: {
        type: String,
        required: true,
        trim: true
    },
    questionType: {
        type: String,
        enum: ['multiple-choice', 'true-false', 'short-answer', 'essay'],
        required: true
    },
    options: [{
        text: String,
        isCorrect: Boolean
    }],
    correctAnswer: String, // For short answer and essay questions
    explanation: {
        type: String,
        trim: true
    },
    difficulty: {
        type: String,
        enum: ['easy', 'medium', 'hard'],
        default: 'medium'
    },
    topics: [String], // Main topics this question covers
    tags: [String], // Advanced tagging for personalization
    metadata: {
        subject: String,
        grade: String,
        estimatedTime: Number, // in seconds
        points: {
            type: Number,
            default: 1
        }
    },
    analytics: {
        totalAttempts: {
            type: Number,
            default: 0
        },
        correctAttempts: {
            type: Number,
            default: 0
        },
        averageTime: {
            type: Number,
            default: 0
        }
    },
    aiPersonalization: {
        adaptiveHints: [String],
        conceptualConnections: [String],
        prerequisiteTopics: [String]
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    status: {
        type: String,
        enum: ['draft', 'active', 'archived'],
        default: 'active'
    }
}, {
    timestamps: true
});

// Index for better search performance
QuestionSchema.index({ topics: 1, difficulty: 1, status: 1 });
QuestionSchema.index({ tags: 1 });
QuestionSchema.index({ 'metadata.subject': 1 });

module.exports = mongoose.model('Question', QuestionSchema);