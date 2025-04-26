const { MongoClient } = require('mongodb');

const MONGODB_URI = 'mongodb://localhost:27017';
const DB_NAME = 'scholarshipApp';

async function seedSettings() {
  const client = new MongoClient(MONGODB_URI);
  try {
    await client.connect();
    const db = client.db(DB_NAME);
    
    // Create settings collection if it doesn't exist
    const collections = await db.listCollections().toArray();
    if (!collections.some(col => col.name === 'settings')) {
      await db.createCollection('settings');
    }
    
    // Insert default settings
    const settings = [
      {
        type: 'autoSync',
        enabled: true,
        lastUpdated: new Date()
      }
    ];
    
    await db.collection('settings').insertMany(settings);
    console.log('Settings seeded successfully');
  } catch (error) {
    console.error('Error seeding settings:', error);
  } finally {
    await client.close();
  }
}

seedSettings().catch(console.error); 