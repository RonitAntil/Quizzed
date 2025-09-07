#!/usr/bin/env node

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Quizzed Platform Quick Start');
console.log('='.repeat(50));

// Check if required files exist
const requiredFiles = [
    'backend/server.js',
    'backend/models/User.js',
    'backend/models/Question.js',
    'backend/models/QuizAttempt.js',
    'backend/middleware/auth.js',
    'backend/routes/auth.js',
    'backend/routes/dashboard.js',
    'frontend/index.html',
    '.env'
];

console.log('📋 Checking required files...');
let missingFiles = [];

requiredFiles.forEach(file => {
    if (!fs.existsSync(file)) {
        missingFiles.push(file);
    } else {
        console.log(`✅ ${file}`);
    }
});

if (missingFiles.length > 0) {
    console.log('\n❌ Missing files:');
    missingFiles.forEach(file => console.log(`   - ${file}`));
    console.log('\nPlease create the missing files before starting.');
    process.exit(1);
}

// Check .env configuration
console.log('\n🔧 Checking environment configuration...');
const envContent = fs.readFileSync('.env', 'utf8');
const requiredEnvVars = ['MONGODB_URI', 'JWT_SECRET'];
const missingEnvVars = [];

requiredEnvVars.forEach(envVar => {
    if (!envContent.includes(envVar)) {
        missingEnvVars.push(envVar);
    } else {
        console.log(`✅ ${envVar} configured`);
    }
});

if (!envContent.includes('OPENAI_API_KEY')) {
    console.log('⚠️  OPENAI_API_KEY not set - AI features will use fallbacks');
} else {
    console.log('✅ OPENAI_API_KEY configured');
}

console.log('\n🌱 Starting database seeding...');

// Run database seeding
const seedProcess = spawn('node', ['database/seed.js'], { stdio: 'inherit' });

seedProcess.on('close', (code) => {
    if (code === 0) {
        console.log('\n✅ Database seeding completed!');
        console.log('\n🚀 Starting development server...');
        
        // Start the development server
        const serverProcess = spawn('npm', ['run', 'dev'], { stdio: 'inherit' });
        
        serverProcess.on('close', (serverCode) => {
            console.log(`\n👋 Server stopped with code ${serverCode}`);
        });
        
        // Handle Ctrl+C gracefully
        process.on('SIGINT', () => {
            console.log('\n🛑 Shutting down server...');
            serverProcess.kill('SIGINT');
        });
        
    } else {
        console.log('\n❌ Database seeding failed');
        console.log('Please check the error messages above and fix any issues.');
        process.exit(1);
    }
});

seedProcess.on('error', (err) => {
    console.error('❌ Failed to start seeding process:', err.message);
    process.exit(1);
});