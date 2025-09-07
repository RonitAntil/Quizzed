class QuizzedApp {
    constructor() {
        this.currentUser = null;
        this.currentQuiz = null;
        this.currentQuestionIndex = 0;
        this.userAnswers = [];
        this.quizTimer = null;
        this.timeRemaining = 0;
        this.apiBase = 'https://quizzed-im87.onrender.com';
        
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.checkAuthStatus();
        this.loadInitialData();
    }

    // Event Listeners Setup
    setupEventListeners() {
        // Navigation
        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const section = e.target.getAttribute('href').substring(1);
                this.showSection(section);
            });
        });

        // Authentication buttons
        document.getElementById('login-btn')?.addEventListener('click', () => this.showModal('login-modal'));
        document.getElementById('signup-btn')?.addEventListener('click', () => this.showModal('signup-modal'));
        document.getElementById('logout-btn')?.addEventListener('click', () => this.logout());

        // Modal controls
        document.querySelectorAll('.close').forEach(closeBtn => {
            closeBtn.addEventListener('click', (e) => {
                this.hideModal(e.target.closest('.modal').id);
            });
        });

        // Forms
        document.getElementById('login-form')?.addEventListener('submit', (e) => this.handleLogin(e));
        document.getElementById('signup-form')?.addEventListener('submit', (e) => this.handleSignup(e));

        // CTA Button
        document.querySelector('.cta-btn')?.addEventListener('click', () => {
            if (this.currentUser) {
                this.showSection('topics');
            } else {
                this.showModal('signup-modal');
            }
        });

        // Quiz controls
        document.getElementById('submit-answer')?.addEventListener('click', () => this.submitAnswer());
        document.getElementById('next-btn')?.addEventListener('click', () => this.nextQuestion());
        document.getElementById('prev-btn')?.addEventListener('click', () => this.previousQuestion());

        // Filters
        document.getElementById('difficulty-filter')?.addEventListener('change', (e) => this.filterTopics());
        document.getElementById('search-topics')?.addEventListener('input', (e) => this.searchTopics(e.target.value));

        // Click outside modal to close
        window.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                this.hideModal(e.target.id);
            }
        });
    }

    // Authentication Methods
    async checkAuthStatus() {
        const token = localStorage.getItem('quizzed_token');
        if (token) {
            try {
                const response = await this.apiCall('/auth/verify', {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                
                if (response.success) {
                    this.currentUser = response.user;
                    this.updateUIForAuthenticatedUser();
                } else {
                    localStorage.removeItem('quizzed_token');
                }
            } catch (error) {
                console.error('Auth check failed:', error);
                localStorage.removeItem('quizzed_token');
            }
        }
    }

    async handleLogin(e) {
        e.preventDefault();
        this.showLoading();

        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;

        try {
            const response = await this.apiCall('/auth/login', {
                method: 'POST',
                body: JSON.stringify({ email, password })
            });

            if (response.success) {
                localStorage.setItem('quizzed_token', response.token);
                this.currentUser = response.user;
                this.updateUIForAuthenticatedUser();
                this.hideModal('login-modal');
                this.showAlert('Welcome back!', 'success');
            } else {
                this.showAlert(response.message || 'Login failed', 'error');
            }
        } catch (error) {
            this.showAlert('Login failed. Please try again.', 'error');
        } finally {
            this.hideLoading();
        }
    }

    async handleSignup(e) {
        e.preventDefault();
        this.showLoading();

        const username = document.getElementById('signup-username').value;
        const email = document.getElementById('signup-email').value;
        const password = document.getElementById('signup-password').value;

        try {
            const response = await this.apiCall('/auth/signup', {
                method: 'POST',
                body: JSON.stringify({ username, email, password })
            });

            if (response.success) {
                localStorage.setItem('quizzed_token', response.token);
                this.currentUser = response.user;
                this.updateUIForAuthenticatedUser();
                this.hideModal('signup-modal');
                this.showAlert('Account created successfully!', 'success');
            } else {
                this.showAlert(response.message || 'Signup failed', 'error');
            }
        } catch (error) {
            this.showAlert('Signup failed. Please try again.', 'error');
        } finally {
            this.hideLoading();
        }
    }

    logout() {
        localStorage.removeItem('quizzed_token');
        this.currentUser = null;
        this.updateUIForUnauthenticatedUser();
        this.showSection('home');
        this.showAlert('Logged out successfully', 'success');
    }

    updateUIForAuthenticatedUser() {
        document.getElementById('login-btn').style.display = 'none';
        document.getElementById('signup-btn').style.display = 'none';
        document.getElementById('user-menu').classList.remove('hidden');
        document.getElementById('username').textContent = this.currentUser.username;
    }

    updateUIForUnauthenticatedUser() {
        document.getElementById('login-btn').style.display = 'block';
        document.getElementById('signup-btn').style.display = 'block';
        document.getElementById('user-menu').classList.add('hidden');
    }

    // Section Navigation
    showSection(sectionName) {
        // Hide all sections
        document.querySelectorAll('section').forEach(section => {
            section.classList.add('hidden');
        });

        // Show target section
        const targetSection = document.getElementById(sectionName);
        if (targetSection) {
            targetSection.classList.remove('hidden');
            targetSection.classList.add('fade-in');
        }

        // Update active nav link
        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.remove('active');
            if (link.getAttribute('href') === `#${sectionName}`) {
                link.classList.add('active');
            }
        });

        // Load section-specific data
        this.loadSectionData(sectionName);
    }

    async loadSectionData(sectionName) {
        switch (sectionName) {
            case 'topics':
                await this.loadTopics();
                break;
            case 'dashboard':
                if (this.currentUser) {
                    await this.loadDashboard();
                } else {
                    this.showModal('login-modal');
                }
                break;
        }
    }

    // Topics Management
    async loadTopics() {
        this.showLoading();
        try {
            const response = await this.apiCall('/topics');
            if (response.success) {
                this.renderTopics(response.topics);
            } else {
                // Load sample topics if API fails
                this.renderSampleTopics();
            }
        } catch (error) {
            console.error('Failed to load topics:', error);
            this.renderSampleTopics();
        } finally {
            this.hideLoading();
        }
    }

    renderTopics(topics) {
        const grid = document.getElementById('topics-grid');
        grid.innerHTML = topics.map(topic => `
            <div class="topic-card slide-up" data-topic="${topic.id}" onclick="app.startQuiz('${topic.id}')">
                <div class="topic-icon">
                    <i class="${topic.icon}"></i>
                </div>
                <h3 class="topic-title">${topic.name}</h3>
                <p class="topic-description">${topic.description}</p>
                <div class="topic-stats">
                    <span>${topic.questionCount} questions</span>
                    <span class="difficulty-${topic.difficulty}">${topic.difficulty}</span>
                </div>
            </div>
        `).join('');
    }

    renderSampleTopics() {
        const sampleTopics = [
            { id: 'mathematics', name: 'Mathematics', description: 'Algebra, Calculus, Geometry', icon: 'fas fa-calculator', questionCount: 150, difficulty: 'medium' },
            { id: 'science', name: 'Science', description: 'Physics, Chemistry, Biology', icon: 'fas fa-atom', questionCount: 200, difficulty: 'hard' },
            { id: 'history', name: 'History', description: 'World History, Ancient Civilizations', icon: 'fas fa-landmark', questionCount: 120, difficulty: 'easy' },
            { id: 'literature', name: 'Literature', description: 'Classic Literature, Poetry', icon: 'fas fa-book', questionCount: 100, difficulty: 'medium' },
            { id: 'geography', name: 'Geography', description: 'World Geography, Capitals', icon: 'fas fa-globe', questionCount: 80, difficulty: 'easy' },
            { id: 'programming', name: 'Programming', description: 'JavaScript, Python, Algorithms', icon: 'fas fa-code', questionCount: 180, difficulty: 'hard' }
        ];
        this.renderTopics(sampleTopics);
    }

    filterTopics() {
        const difficulty = document.getElementById('difficulty-filter').value;
        const cards = document.querySelectorAll('.topic-card');
        
        cards.forEach(card => {
            const cardDifficulty = card.querySelector('.topic-stats span:last-child').textContent;
            if (!difficulty || cardDifficulty.includes(difficulty)) {
                card.style.display = 'block';
            } else {
                card.style.display = 'none';
            }
        });
    }

    searchTopics(searchTerm) {
        const cards = document.querySelectorAll('.topic-card');
        const term = searchTerm.toLowerCase();
        
        cards.forEach(card => {
            const title = card.querySelector('.topic-title').textContent.toLowerCase();
            const description = card.querySelector('.topic-description').textContent.toLowerCase();
            
            if (title.includes(term) || description.includes(term)) {
                card.style.display = 'block';
            } else {
                card.style.display = 'none';
            }
        });
    }

    // Quiz Management
    async startQuiz(topicId) {
        if (!this.currentUser) {
            this.showModal('login-modal');
            return;
        }

        this.showLoading();
        try {
            const response = await this.apiCall(`/quiz/start/${topicId}`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${localStorage.getItem('quizzed_token')}` }
            });

            if (response.success) {
                this.currentQuiz = response.quiz;
                this.currentQuestionIndex = 0;
                this.userAnswers = [];
                this.showSection('quiz');
                this.displayQuestion();
                this.startTimer();
            } else {
                this.showAlert('Failed to start quiz', 'error');
            }
        } catch (error) {
            console.error('Failed to start quiz:', error);
            // Load sample quiz for demo
            this.loadSampleQuiz(topicId);
        } finally {
            this.hideLoading();
        }
    }

    loadSampleQuiz(topicId) {
        // Sample quiz data for demo purposes
        this.currentQuiz = {
            id: `quiz_${topicId}_${Date.now()}`,
            topicId: topicId,
            questions: [
                {
                    id: 1,
                    questionText: "What is the capital of France?",
                    questionType: "multiple-choice",
                    options: [
                        { text: "London", isCorrect: false },
                        { text: "Berlin", isCorrect: false },
                        { text: "Paris", isCorrect: true },
                        { text: "Madrid", isCorrect: false }
                    ],
                    explanation: "Paris has been the capital of France since 987 AD.",
                    difficulty: "easy",
                    topics: ["geography", "europe"],
                    estimatedTime: 30
                },
                {
                    id: 2,
                    questionText: "Which programming language is known for its simplicity and readability?",
                    questionType: "multiple-choice",
                    options: [
                        { text: "C++", isCorrect: false },
                        { text: "Python", isCorrect: true },
                        { text: "Assembly", isCorrect: false },
                        { text: "Java", isCorrect: false }
                    ],
                    explanation: "Python emphasizes code readability and simplicity.",
                    difficulty: "easy",
                    topics: ["programming", "languages"],
                    estimatedTime: 45
                }
            ],
            timeLimit: 600, // 10 minutes
            totalQuestions: 2
        };

        this.currentQuestionIndex = 0;
        this.userAnswers = [];
        this.showSection('quiz');
        this.displayQuestion();
        this.startTimer();
    }

    displayQuestion() {
        const question = this.currentQuiz.questions[this.currentQuestionIndex];
        if (!question) return;

        // Update question counter
        document.getElementById('question-counter').textContent = 
            `${this.currentQuestionIndex + 1} / ${this.currentQuiz.questions.length}`;

        // Update progress bar
        const progress = ((this.currentQuestionIndex + 1) / this.currentQuiz.questions.length) * 100;
        document.getElementById('progress-fill').style.width = `${progress}%`;

        // Display question
        document.getElementById('question-text').textContent = question.questionText;

        // Display options
        const optionsContainer = document.getElementById('question-options');
        optionsContainer.innerHTML = question.options.map((option, index) => `
            <div class="option" data-index="${index}" onclick="app.selectOption(${index})">
                <span class="option-letter">${String.fromCharCode(65 + index)}</span>
                <span class="option-text">${option.text}</span>
            </div>
        `).join('');

        // Hide AI explanation initially
        document.getElementById('ai-explanation').classList.add('hidden');

        // Update button states
        document.getElementById('prev-btn').disabled = this.currentQuestionIndex === 0;
        document.getElementById('submit-answer').disabled = false;
        document.getElementById('next-btn').disabled = true;
    }

    selectOption(optionIndex) {
        // Remove previous selections
        document.querySelectorAll('.option').forEach(opt => opt.classList.remove('selected'));
        
        // Add selection to clicked option
        document.querySelector(`[data-index="${optionIndex}"]`).classList.add('selected');
        
        // Enable submit button
        document.getElementById('submit-answer').disabled = false;
    }

    async submitAnswer() {
        const selectedOption = document.querySelector('.option.selected');
        if (!selectedOption) {
            this.showAlert('Please select an answer', 'error');
            return;
        }

        const selectedIndex = parseInt(selectedOption.dataset.index);
        const question = this.currentQuiz.questions[this.currentQuestionIndex];
        const isCorrect = question.options[selectedIndex].isCorrect;

        // Store user answer
        this.userAnswers[this.currentQuestionIndex] = {
            questionId: question.id,
            selectedIndex: selectedIndex,
            isCorrect: isCorrect,
            timeSpent: this.calculateTimeSpent()
        };

        // Show correct/incorrect styling
        document.querySelectorAll('.option').forEach((opt, index) => {
            if (question.options[index].isCorrect) {
                opt.classList.add('correct');
            } else if (index === selectedIndex && !isCorrect) {
                opt.classList.add('incorrect');
            }
        });

        // Generate and show AI explanation
        await this.generateAIExplanation(question, isCorrect, selectedIndex);

        // Update button states
        document.getElementById('submit-answer').disabled = true;
        document.getElementById('next-btn').disabled = false;
    }

    async generateAIExplanation(question, isCorrect, selectedIndex) {
        const aiExplanation = document.getElementById('ai-explanation');
        const aiText = document.getElementById('ai-explanation-text');
        
        aiExplanation.classList.remove('hidden');
        aiText.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generating personalized explanation...';

        try {
            // In a real implementation, this would call your backend API
            // which then calls OpenAI API with user's learning history
            const personalizedExplanation = await this.getPersonalizedExplanation(question, isCorrect, selectedIndex);
            
            aiText.innerHTML = personalizedExplanation;
        } catch (error) {
            console.error('Failed to generate AI explanation:', error);
            // Fallback to standard explanation
            aiText.innerHTML = `
                <strong>${isCorrect ? 'Correct!' : 'Not quite right.'}</strong><br>
                ${question.explanation}<br><br>
                <em>💡 Tip: ${this.getStudyTip(question.topics[0])}</em>
            `;
        }
    }

    async getPersonalizedExplanation(question, isCorrect, selectedIndex) {
        // This would normally call your backend API
        // For demo purposes, we'll simulate AI responses
        const userHistory = this.getUserLearningHistory();
        
        const explanations = {
            correct: [
                `🎉 Excellent work! You've shown strong understanding of ${question.topics[0]}. Based on your learning history, you're doing well with these types of questions. Keep building on this foundation!`,
                `✅ Perfect! Your answer shows you're grasping the key concepts. Since you've been studying ${question.topics[0]}, try tackling some harder questions in this area next.`,
                `🌟 Great job! This aligns with your learning pattern in ${question.topics[0]}. You might enjoy exploring related topics like ${this.getRelatedTopics(question.topics[0]).join(', ')}.`
            ],
            incorrect: [
                `📚 Don't worry! This is a common challenge in ${question.topics[0]}. Based on your learning style, try breaking this concept down into smaller parts. ${question.explanation}`,
                `💪 Learning opportunity! Your past performance shows you learn best through examples. Here's the concept explained step-by-step: ${question.explanation}`,
                `🔍 This is tricky! Since you've been working on ${question.topics[0]}, let's connect this to what you already know: ${question.explanation}`
            ]
        };

        const type = isCorrect ? 'correct' : 'incorrect';
        return explanations[type][Math.floor(Math.random() * explanations[type].length)];
    }

    getUserLearningHistory() {
        // Simulate user learning history analysis
        return {
            strongTopics: ['mathematics', 'science'],
            weakTopics: ['history', 'literature'],
            learningStyle: 'visual',
            preferredDifficulty: 'medium'
        };
    }

    getRelatedTopics(topic) {
        const relations = {
            'mathematics': ['physics', 'computer-science', 'engineering'],
            'science': ['mathematics', 'technology', 'research'],
            'history': ['geography', 'politics', 'culture'],
            'literature': ['writing', 'philosophy', 'arts'],
            'geography': ['history', 'climate', 'cultures'],
            'programming': ['mathematics', 'logic', 'algorithms']
        };
        return relations[topic] || ['general-knowledge'];
    }

    getStudyTip(topic) {
        const tips = {
            'mathematics': 'Practice similar problems daily to build muscle memory',
            'science': 'Try to connect concepts to real-world applications',
            'history': 'Create timelines to visualize historical connections',
            'literature': 'Read actively and take notes on themes and characters',
            'geography': 'Use maps and visual aids to remember locations',
            'programming': 'Code along with examples and build small projects'
        };
        return tips[topic] || 'Regular practice and review will help reinforce learning';
    }

    nextQuestion() {
        if (this.currentQuestionIndex < this.currentQuiz.questions.length - 1) {
            this.currentQuestionIndex++;
            this.displayQuestion();
        } else {
            this.finishQuiz();
        }
    }

    previousQuestion() {
        if (this.currentQuestionIndex > 0) {
            this.currentQuestionIndex--;
            this.displayQuestion();
            
            // Restore previous answer if exists
            const previousAnswer = this.userAnswers[this.currentQuestionIndex];
            if (previousAnswer) {
                document.querySelector(`[data-index="${previousAnswer.selectedIndex}"]`).classList.add('selected');
                document.getElementById('submit-answer').disabled = true;
                document.getElementById('next-btn').disabled = false;
            }
        }
    }

    calculateTimeSpent() {
        // Calculate time spent on current question
        return 30; // Placeholder
    }

    startTimer() {
        this.timeRemaining = this.currentQuiz.timeLimit;
        this.updateTimerDisplay();
        
        this.quizTimer = setInterval(() => {
            this.timeRemaining--;
            this.updateTimerDisplay();
            
            if (this.timeRemaining <= 0) {
                this.finishQuiz();
            }
        }, 1000);
    }

    updateTimerDisplay() {
        const minutes = Math.floor(this.timeRemaining / 60);
        const seconds = this.timeRemaining % 60;
        const timerElement = document.getElementById('timer');
        
        timerElement.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        
        // Add warning classes for low time
        if (this.timeRemaining <= 60) {
            timerElement.classList.add('timer-danger');
        } else if (this.timeRemaining <= 120) {
            timerElement.classList.add('timer-warning');
        }
    }

    async finishQuiz() {
        clearInterval(this.quizTimer);
        
        // Calculate results
        const correctAnswers = this.userAnswers.filter(answer => answer.isCorrect).length;
        const totalQuestions = this.currentQuiz.questions.length;
        const percentage = Math.round((correctAnswers / totalQuestions) * 100);
        
        // Save results
        if (this.currentUser) {
            await this.saveQuizResults({
                quizId: this.currentQuiz.id,
                topicId: this.currentQuiz.topicId,
                answers: this.userAnswers,
                score: percentage,
                completedAt: new Date().toISOString()
            });
        }

        // Show results
        this.showQuizResults(correctAnswers, totalQuestions, percentage);
    }

    showQuizResults(correct, total, percentage) {
        const resultHTML = `
            <div class="quiz-results fade-in">
                <h2>Quiz Complete!</h2>
                <div class="score-circle">
                    <span class="score">${percentage}%</span>
                </div>
                <p>You got <strong>${correct}</strong> out of <strong>${total}</strong> questions correct!</p>
                <div class="result-actions">
                    <button class="btn btn-primary" onclick="app.showSection('topics')">Try Another Quiz</button>
                    <button class="btn btn-outline" onclick="app.showSection('dashboard')">View Dashboard</button>
                </div>
            </div>
        `;
        
        document.querySelector('.quiz-container').innerHTML = resultHTML;
    }

    async saveQuizResults(results) {
        try {
            await this.apiCall('/quiz/results', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${localStorage.getItem('quizzed_token')}` },
                body: JSON.stringify(results)
            });
        } catch (error) {
            console.error('Failed to save quiz results:', error);
        }
    }

    // Dashboard Management
    async loadDashboard() {
        this.showLoading();
        try {
            const response = await this.apiCall('/dashboard', {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('quizzed_token')}` }
            });

            if (response.success) {
                this.renderDashboard(response.data);
            } else {
                this.renderSampleDashboard();
            }
        } catch (error) {
            console.error('Failed to load dashboard:', error);
            this.renderSampleDashboard();
        } finally {
            this.hideLoading();
        }
    }

    renderSampleDashboard() {
        // Recent Quizzes
        document.getElementById('recent-quizzes').innerHTML = `
            <div class="recent-quiz-item">
                <span class="quiz-topic">Mathematics</span>
                <span class="quiz-score">85%</span>
                <span class="quiz-date">2 days ago</span>
            </div>
            <div class="recent-quiz-item">
                <span class="quiz-topic">Science</span>
                <span class="quiz-score">92%</span>
                <span class="quiz-date">1 week ago</span>
            </div>
        `;

        // Performance Chart (simplified)
        document.getElementById('performance-chart').innerHTML = `
            <div class="performance-summary">
                <div class="perf-stat">
                    <span class="perf-label">Average Score</span>
                    <span class="perf-value">88%</span>
                </div>
                <div class="perf-stat">
                    <span class="perf-label">Quizzes Taken</span>
                    <span class="perf-value">12</span>
                </div>
                <div class="perf-stat">
                    <span class="perf-label">Topics Studied</span>
                    <span class="perf-value">6</span>
                </div>
            </div>
        `;

        // Recommended Topics
        document.getElementById('recommended-topics').innerHTML = `
            <div class="recommendation">
                <span class="rec-topic">Advanced Mathematics</span>
                <span class="rec-reason">Based on your strong algebra performance</span>
            </div>
            <div class="recommendation">
                <span class="rec-topic">Physics</span>
                <span class="rec-reason">Complements your science interests</span>
            </div>
        `;
    }

    // Utility Methods
    async apiCall(endpoint, options = {}) {
        const defaultOptions = {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            }
        };

        const config = { ...defaultOptions, ...options };
        
        try {
            const response = await fetch(`${this.apiBase}${endpoint}`, config);
            return await response.json();
        } catch (error) {
            console.error('API call failed:', error);
            throw error;
        }
    }

    showModal(modalId) {
        document.getElementById(modalId).classList.remove('hidden');
        document.body.style.overflow = 'hidden';
    }

    hideModal(modalId) {
        document.getElementById(modalId).classList.add('hidden');
        document.body.style.overflow = 'auto';
    }

    showLoading() {
        document.getElementById('loading-spinner').classList.remove('hidden');
    }

    hideLoading() {
        document.getElementById('loading-spinner').classList.add('hidden');
    }

    showAlert(message, type = 'info') {
        // Create alert element
        const alert = document.createElement('div');
        alert.className = `alert alert-${type} fade-in`;
        alert.textContent = message;
        
        // Insert at top of main content
        const mainContent = document.querySelector('.main-content');
        mainContent.insertBefore(alert, mainContent.firstChild);
        
        // Auto remove after 5 seconds
        setTimeout(() => {
            alert.remove();
        }, 5000);
    }

    async loadInitialData() {
        // Load any initial data needed for the app
        try {
            const healthCheck = await this.apiCall('/health');
            console.log('Backend health:', healthCheck);
        } catch (error) {
            console.log('Backend not available, running in demo mode');
        }
    }
}

// Additional CSS for dashboard elements (add to your CSS file)
const additionalCSS = `
/* Dashboard Specific Styles */
.quiz-results {
    text-align: center;
    padding: var(--spacing-2xl);
}

.quiz-results h2 {
    font-size: 2rem;
    margin-bottom: var(--spacing-lg);
    background: var(--gradient-primary);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
}

.score-circle {
    width: 120px;
    height: 120px;
    border-radius: 50%;
    background: var(--gradient-primary);
    display: flex;
    align-items: center;
    justify-content: center;
    margin: var(--spacing-lg) auto;
    box-shadow: var(--shadow-lg);
}

.score {
    font-size: 2rem;
    font-weight: 800;
    color: white;
}

.result-actions {
    display: flex;
    gap: var(--spacing-md);
    justify-content: center;
    margin-top: var(--spacing-lg);
}

.recent-quiz-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--spacing-md);
    background: rgba(51, 65, 85, 0.3);
    border-radius: var(--radius-md);
    margin-bottom: var(--spacing-sm);
}

.quiz-score {
    font-weight: 600;
    color: var(--success-color);
}

.quiz-date {
    font-size: 0.75rem;
    color: var(--text-secondary);
}

.performance-summary {
    display: grid;
    gap: var(--spacing-md);
}

.perf-stat {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--spacing-sm) 0;
    border-bottom: 1px solid var(--border-color);
}

.perf-value {
    font-weight: 700;
    color: var(--primary-color);
}

.recommendation {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-xs);
    padding: var(--spacing-md);
    background: rgba(99, 102, 241, 0.05);
    border-radius: var(--radius-md);
    border-left: 4px solid var(--primary-color);
    margin-bottom: var(--spacing-sm);
}

.rec-topic {
    font-weight: 600;
}

.rec-reason {
    font-size: 0.75rem;
    color: var(--text-secondary);
}

.option {
    display: flex;
    align-items: center;
    gap: var(--spacing-md);
}

.option-letter {
    width: 30px;
    height: 30px;
    background: var(--primary-color);
    color: white;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 600;
    font-size: 0.875rem;
}

.option-text {
    flex: 1;
}

/* Responsive adjustments */
@media (max-width: 768px) {
    .result-actions {
        flex-direction: column;
    }
    
    .hero-content h1 {
        font-size: 2rem;
    }
    
    .quiz-container {
        padding: var(--spacing-lg);
        margin: var(--spacing-md);
    }
    
    .nav-menu {
        flex-wrap: wrap;
    }
}
`;

// Initialize the application
let app;
document.addEventListener('DOMContentLoaded', () => {
    app = new QuizzedApp();
    
    // Add additional CSS to the page
    const style = document.createElement('style');
    style.textContent = additionalCSS;
    document.head.appendChild(style);

});

