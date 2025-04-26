const express = require('express');
const cors = require('cors');
const { MongoClient } = require('mongodb');
const moment = require('moment');

const app = express();
const port = process.env.PORT || 3000;

// MongoDB configuration
const MONGODB_URI = 'mongodb://localhost:27017';
const DB_NAME = 'scholarshipDB';
const COLLECTION_NAME = 'Scholarships';

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB connection
let db;

async function connectToMongoDB() {
    const client = new MongoClient(MONGODB_URI);
    await client.connect();
    return client.db(DB_NAME);
}

// Initialize MongoDB connection
connectToMongoDB()
    .then(database => {
        db = database;
        console.log('Connected to MongoDB');
    })
    .catch(err => {
        console.error('MongoDB connection error:', err);
        process.exit(1);
    });

// API Routes
app.get('/api/scholarships/latest', async (req, res) => {
    try {
        const collection = db.collection(COLLECTION_NAME);
        
        // Calculate date 24 hours ago
        const twentyFourHoursAgo = moment().subtract(24, 'hours').toDate();
        
        // Query for scholarships updated or created in the last 24 hours
        const scholarships = await collection
            .find({
                $or: [
                    { updatedAt: { $gte: twentyFourHoursAgo } },
                    { createdAt: { $gte: twentyFourHoursAgo } }
                ]
            })
            .sort({ updatedAt: -1, createdAt: -1 })
            .toArray();
        
        // Format dates for response
        const formattedScholarships = scholarships.map(scholarship => ({
            ...scholarship,
            createdAt: moment(scholarship.createdAt).format('YYYY-MM-DD HH:mm:ss'),
            updatedAt: moment(scholarship.updatedAt).format('YYYY-MM-DD HH:mm:ss'),
            deadline: moment(scholarship.deadline).format('YYYY-MM-DD')
        }));
        
        res.json({
            count: formattedScholarships.length,
            scholarships: formattedScholarships
        });
        
    } catch (error) {
        console.error('Error fetching latest scholarships:', error);
        res.status(500).json({
            error: 'Failed to fetch latest scholarships',
            message: error.message
        });
    }
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({
        error: 'Something went wrong!',
        message: err.message
    });
});

// Start server
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
}); 