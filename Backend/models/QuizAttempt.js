const mongoose = require('mongoose');

const QuizAttemptSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    topicId: {
        type: String,
        required: true
    },
    questions: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Question'
    }],
    answers: [{
        questionId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Question',
            required: true
        },
        selectedIndex: {
            type: Number,
            required: true
        },
        isCorrect: {
            type: Boolean,
            required: true
        },
        timeSpent: {
            type: Number, // seconds
            default: 0
        },
        submittedAt: {
            type: Date,
            default: Date.now
        }
    }],
    score: {
        type: Number,
        min: 0,
        max: 100
    },
    timeLimit: {
        type: Number, // seconds
        default: 600 // 10 minutes
    },
    timeSpent: {
        type: Number, // total seconds spent
        default: 0
    },
    startedAt: {
        type: Date,
        default: Date.now
    },
    completedAt: {
        type: Date
    },
    status: {
        type: String,
        enum: ['in-progress', 'completed', 'abandoned'],
        default: 'in-progress'
    },
    metadata: {
        difficulty: String,
        questionCount: Number,
        deviceInfo: String,
        ipAddress: String
    }
}, {
    timestamps: true
});

// Index for better query performance
QuizAttemptSchema.index({ userId: 1, completedAt: -1 });
QuizAttemptSchema.index({ topicId: 1, score: -1 });
QuizAttemptSchema.index({ status: 1, startedAt: -1 });

// Virtual for calculating completion percentage
QuizAttemptSchema.virtual('completionPercentage').get(function() {
    if (this.questions.length === 0) return 0;
    return Math.round((this.answers.length / this.questions.length) * 100);
});

// Method to calculate accuracy
QuizAttemptSchema.methods.calculateAccuracy = function() {
    if (this.answers.length === 0) return 0;
    const correctAnswers = this.answers.filter(answer => answer.isCorrect).length;
    return Math.round((correctAnswers / this.answers.length) * 100);
};

// Static method to get user statistics
QuizAttemptSchema.statics.getUserStats = async function(userId) {
    const stats = await this.aggregate([
        { $match: { userId: new mongoose.Types.ObjectId(userId), status: 'completed' } },
        {
            $group: {
                _id: null,
                totalQuizzes: { $sum: 1 },
                averageScore: { $avg: '$score' },
                totalTimeSpent: { $sum: '$timeSpent' },
                topicsStudied: { $addToSet: '$topicId' }
            }
        }
    ]);

    return stats[0] || {
        totalQuizzes: 0,
        averageScore: 0,
        totalTimeSpent: 0,
        topicsStudied: []
    };
};

module.exports = mongoose.model('QuizAttempt', QuizAttemptSchema);