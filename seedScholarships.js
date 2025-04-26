const { MongoClient } = require('mongodb');
const fs = require('fs');
const path = require('path');

// MongoDB connection URL
const MONGODB_URI = 'mongodb://localhost:27017';
const DB_NAME = 'dreamgrant';
const COLLECTION_NAME = 'scholarships';

async function seedScholarships() {
    const client = new MongoClient(MONGODB_URI);
    
    try {
        // Connect to MongoDB
        await client.connect();
        console.log('Connected to MongoDB');

        const db = client.db(DB_NAME);
        const collection = db.collection(COLLECTION_NAME);

        // Read the scholarships JSON file
        const scholarshipsData = JSON.parse(
            fs.readFileSync(path.join(__dirname, 'app/src/main/assets/scholarships.json'), 'utf8')
        );

        // Drop existing collection to avoid duplicates
        await collection.drop().catch(err => {
            if (err.code !== 26) { // Error code 26 is "ns does not exist"
                console.error('Error dropping collection:', err);
            }
        });

        // Insert scholarships
        const result = await collection.insertMany(scholarshipsData.scholarships);
        console.log(`${result.insertedCount} scholarships inserted successfully`);

        // Create indexes for better query performance
        await collection.createIndex({ "title": "text", "organization": "text", "tags": "text" });
        await collection.createIndex({ "type": 1 });
        await collection.createIndex({ "category": 1 });
        await collection.createIndex({ "location": 1 });
        await collection.createIndex({ "stream": 1 });
        await collection.createIndex({ "gender": 1 });
        await collection.createIndex({ "deadline": 1 });
        await collection.createIndex({ "eligibility.educationLevel": 1 });
        console.log('Indexes created successfully');

    } catch (err) {
        console.error('Error seeding scholarships:', err);
    } finally {
        // Close the connection
        await client.close();
        console.log('MongoDB connection closed');
    }
}

// Run the seeder
seedScholarships(); 