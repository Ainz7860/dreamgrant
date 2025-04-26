const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const { MongoClient } = require('mongodb');
const pLimit = require('p-limit');
const moment = require('moment');
const cron = require('node-cron');
const admin = require('firebase-admin');
const path = require('path');
require('dotenv').config();

// Initialize Firebase Admin
let serviceAccount;
try {
    // Try to load from file first
    serviceAccount = require('./firebase-service-account.json');
} catch (error) {
    // Fallback to environment variables
    if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_CLIENT_EMAIL) {
        serviceAccount = {
            project_id: process.env.FIREBASE_PROJECT_ID,
            private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
            client_email: process.env.FIREBASE_CLIENT_EMAIL
        };
    } else {
        console.error('Firebase configuration not found. Please provide either firebase-service-account.json or environment variables.');
        process.exit(1);
    }
}

// Check if Firebase app is already initialized
if (!admin.apps.length) {
    try {
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
            projectId: serviceAccount.project_id
        });
    } catch (error) {
        console.error('Error initializing Firebase:', error.message);
        process.exit(1);
    }
}

// Rate limiting configuration
const limit = pLimit(3); // Maximum 3 concurrent requests
const DELAY_BETWEEN_REQUESTS = 2000; // 2 seconds delay between requests

// MongoDB configuration
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const DB_NAME = process.env.DB_NAME || 'scholarshipDB';
const COLLECTION_NAME = 'Scholarships';

// Logging configuration
const LOG_FILE = path.join(__dirname, 'scholarship_updates.log');

// Statistics tracking
let stats = {
    newEntries: 0,
    updatedEntries: 0,
    startTime: null,
    endTime: null
};

// Notification preferences configuration
const notificationPreferences = {
    defaultTypes: ['Government', 'Private', 'International', 'University'],
    maxTitlesInNotification: 3,
    groupNotifications: true,
    notificationGroups: {
        'Government': 'Government Scholarships',
        'Private': 'Private Scholarships',
        'International': 'International Scholarships',
        'University': 'University Scholarships'
    }
};

// Configuration for different sources
const sources = {
    scholarshipsGovIn: {
        url: 'https://scholarships.gov.in',
        baseUrl: 'https://scholarships.gov.in',
        pagination: {
            enabled: true,
            pattern: '?page={page}',
            maxPages: 5
        },
        selectors: {
            scholarships: '.scholarship-item',
            title: '.scholarship-title',
            organization: '.scholarship-org',
            type: '.scholarship-type',
            eligibility: '.scholarship-eligibility',
            benefits: '.scholarship-benefits',
            deadline: '.scholarship-deadline',
            applyLink: '.scholarship-apply-link'
        }
    },
    buddy4study: {
        url: 'https://buddy4study.com/scholarships',
        baseUrl: 'https://buddy4study.com',
        pagination: {
            enabled: true,
            pattern: '/page/{page}',
            maxPages: 10
        },
        selectors: {
            scholarships: '.scholarship-card',
            title: '.scholarship-name',
            organization: '.scholarship-provider',
            type: '.scholarship-category',
            eligibility: '.scholarship-eligibility',
            benefits: '.scholarship-amount',
            deadline: '.scholarship-deadline',
            applyLink: '.scholarship-apply-link'
        }
    },
    delhiGov: {
        url: 'https://edistrict.delhigovt.nic.in/scholarships',
        baseUrl: 'https://edistrict.delhigovt.nic.in',
        pagination: {
            enabled: false
        },
        selectors: {
            scholarships: '.scholarship-list-item',
            title: '.scholarship-title',
            organization: '.scholarship-department',
            type: '.scholarship-type',
            eligibility: '.scholarship-criteria',
            benefits: '.scholarship-details',
            deadline: '.scholarship-last-date',
            applyLink: '.scholarship-apply-button'
        }
    }
};

// Function to check if auto-sync is enabled
async function isAutoSyncEnabled() {
    const client = new MongoClient(MONGODB_URI);
    try {
        await client.connect();
        const db = client.db(DB_NAME);
        const settings = await db.collection('settings').findOne({ type: 'autoSync' });
        return settings ? settings.enabled : true; // Default to true if no setting exists
    } catch (error) {
        console.error('Error checking auto-sync status:', error.message);
        return true; // Default to true on error
    } finally {
        await client.close();
    }
}

// Enhanced notification sending function
async function sendFCMNotification(newScholarships) {
    try {
        // Group scholarships by type
        const groupedScholarships = newScholarships.reduce((acc, scholarship) => {
            const type = scholarship.type || 'Other';
            if (!acc[type]) {
                acc[type] = [];
            }
            acc[type].push(scholarship);
            return acc;
        }, {});

        // Send notifications for each group
        for (const [type, scholarships] of Object.entries(groupedScholarships)) {
            if (!notificationPreferences.defaultTypes.includes(type)) continue;

            const groupTitle = notificationPreferences.notificationGroups[type] || type;
            const titles = scholarships
                .slice(0, notificationPreferences.maxTitlesInNotification)
                .map(s => s.title);
            
            const remainingCount = scholarships.length - titles.length;
            const body = titles.join('\n') + 
                (remainingCount > 0 ? `\n...and ${remainingCount} more` : '');

            const message = {
                notification: {
                    title: `${groupTitle} Available!`,
                    body: body
                },
                data: {
                    type: type,
                    count: scholarships.length.toString(),
                    timestamp: new Date().toISOString()
                },
                android: {
                    priority: 'high',
                    notification: {
                        channelId: 'scholarship_updates',
                        clickAction: 'FLUTTER_NOTIFICATION_CLICK',
                        sound: 'default',
                        tag: type
                    }
                },
                topic: `scholarships_${type.toLowerCase()}`
            };

            try {
                const response = await admin.messaging().send(message);
                logMessage(`FCM notification sent for ${type}: ${response}`);
            } catch (error) {
                logMessage(`Error sending notification for ${type}: ${error.message}`);
                // Implement retry logic if needed
                if (error.code === 'messaging/unknown-error') {
                    // Wait for 5 seconds and retry
                    await new Promise(resolve => setTimeout(resolve, 5000));
                    try {
                        const retryResponse = await admin.messaging().send(message);
                        logMessage(`Retry successful for ${type}: ${retryResponse}`);
                    } catch (retryError) {
                        logMessage(`Retry failed for ${type}: ${retryError.message}`);
                    }
                }
            }
        }
    } catch (error) {
        logMessage(`Error in sendFCMNotification: ${error.message}`);
    }
}

function logMessage(message) {
    const timestamp = moment().format('YYYY-MM-DD HH:mm:ss');
    const logEntry = `[${timestamp}] ${message}\n`;
    console.log(logEntry.trim());
    fs.appendFileSync(LOG_FILE, logEntry);
}

async function connectToMongoDB() {
    const client = new MongoClient(MONGODB_URI);
    await client.connect();
    return client.db(DB_NAME);
}

async function scrapeScholarships() {
    // Check if auto-sync is enabled
    const syncEnabled = await isAutoSyncEnabled();
    if (!syncEnabled) {
        logMessage('Auto-sync is disabled. Skipping this run.');
        return;
    }

    logMessage('Auto-sync is enabled. Starting scraping process');
    
    stats.startTime = new Date();
    stats.newEntries = 0;
    stats.updatedEntries = 0;
    
    const db = await connectToMongoDB();
    const collection = db.collection(COLLECTION_NAME);
    
    const allNewScholarships = [];
    
    for (const [sourceName, source] of Object.entries(sources)) {
        try {
            logMessage(`Scraping ${sourceName}...`);
            
            if (source.pagination.enabled) {
                for (let page = 1; page <= source.pagination.maxPages; page++) {
                    const pageUrl = source.url + source.pagination.pattern.replace('{page}', page);
                    const newScholarships = await scrapePage(pageUrl, source, sourceName, collection);
                    allNewScholarships.push(...newScholarships);
                    await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_REQUESTS));
                }
            } else {
                const newScholarships = await scrapePage(source.url, source, sourceName, collection);
                allNewScholarships.push(...newScholarships);
            }
            
        } catch (error) {
            logMessage(`Error scraping ${sourceName}: ${error.message}`);
        }
    }
    
    // Filter scholarships based on notification preferences
    const filteredScholarships = allNewScholarships.filter(scholarship => 
        notificationPreferences.defaultTypes.includes(scholarship.type)
    );
    
    // Send FCM notifications if new scholarships were found
    if (filteredScholarships.length > 0) {
        await sendFCMNotification(filteredScholarships);
    }
    
    stats.endTime = new Date();
    const duration = moment.duration(stats.endTime - stats.startTime);
    
    logMessage(`Update completed in ${duration.hours()}h ${duration.minutes()}m ${duration.seconds()}s`);
    logMessage(`New entries: ${stats.newEntries}`);
    logMessage(`Updated entries: ${stats.updatedEntries}`);
    logMessage('----------------------------------------');
}

async function scrapePage(url, source, sourceName, collection) {
    try {
        const response = await limit(() => axios.get(url));
        const $ = cheerio.load(response.data);
        
        const newScholarships = [];
        const promises = $(source.selectors.scholarships).map(async (index, element) => {
            const scholarship = {
                source: sourceName,
                title: $(element).find(source.selectors.title).text().trim(),
                organization: $(element).find(source.selectors.organization).text().trim(),
                type: $(element).find(source.selectors.type).text().trim(),
                eligibility: $(element).find(source.selectors.eligibility).text().trim(),
                benefits: $(element).find(source.selectors.benefits).text().trim(),
                deadline: $(element).find(source.selectors.deadline).text().trim(),
                applyLink: $(element).find(source.selectors.applyLink).attr('href') || '',
                createdAt: new Date(),
                updatedAt: new Date()
            };
            
            if (!validateScholarship(scholarship)) {
                logMessage(`Invalid scholarship data: ${scholarship.title}`);
                return null;
            }
            
            scholarship.type = normalizeType(scholarship.type);
            scholarship.deadline = normalizeDate(scholarship.deadline);
            scholarship.applyLink = normalizeUrl(scholarship.applyLink, source.baseUrl);
            
            const existingScholarship = await collection.findOne({ title: scholarship.title });
            
            if (existingScholarship) {
                await collection.updateOne(
                    { _id: existingScholarship._id },
                    { 
                        $set: {
                            ...scholarship,
                            createdAt: existingScholarship.createdAt,
                            updatedAt: new Date()
                        }
                    }
                );
                stats.updatedEntries++;
                logMessage(`Updated scholarship: ${scholarship.title}`);
            } else {
                await collection.insertOne(scholarship);
                stats.newEntries++;
                newScholarships.push(scholarship);
                logMessage(`Added new scholarship: ${scholarship.title}`);
            }
            
            return scholarship;
        }).get();
        
        await Promise.all(promises);
        return newScholarships;
        
    } catch (error) {
        logMessage(`Error scraping page ${url}: ${error.message}`);
        return [];
    }
}

function validateScholarship(scholarship) {
    if (!scholarship.title || scholarship.title.length < 3) return false;
    if (!scholarship.organization || scholarship.organization.length < 2) return false;
    if (!scholarship.eligibility || scholarship.eligibility.length < 10) return false;
    if (!scholarship.benefits || scholarship.benefits.length < 5) return false;
    return true;
}

function normalizeType(type) {
    const typeMap = {
        'government': 'Government',
        'gov': 'Government',
        'private': 'Private',
        'international': 'International',
        'central': 'Government',
        'state': 'Government',
        'university': 'University'
    };
    
    const normalized = type.toLowerCase();
    return typeMap[normalized] || type;
}

function normalizeDate(dateStr) {
    if (!dateStr) return null;
    
    const formats = [
        'DD/MM/YYYY',
        'MM/DD/YYYY',
        'YYYY-MM-DD',
        'DD-MM-YYYY',
        'MMMM DD, YYYY'
    ];
    
    for (const format of formats) {
        const parsed = moment(dateStr, format);
        if (parsed.isValid()) {
            return parsed.toDate();
        }
    }
    
    return null;
}

function normalizeUrl(url, baseUrl) {
    if (!url) return '';
    if (url.startsWith('http')) return url;
    if (url.startsWith('/')) {
        return new URL(url, baseUrl).toString();
    }
    return `${baseUrl}/${url}`;
}

// Schedule the scraper to run every 6 hours
cron.schedule('0 */6 * * *', () => {
    logMessage('Scheduled update triggered');
    scrapeScholarships().catch(error => {
        logMessage(`Error in scheduled update: ${error.message}`);
    });
});

// Run immediately on startup
logMessage('Initial update triggered');
scrapeScholarships().catch(error => {
    logMessage(`Error in initial update: ${error.message}`);
}); 