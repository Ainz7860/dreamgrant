require('dotenv').config();
const admin = require('firebase-admin');

// Initialize Firebase Admin with environment variables
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert({
            projectId: process.env.FIREBASE_PROJECT_ID,
            privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL
        })
    });
}

async function testFirebaseConnection() {
    try {
        // Test Firebase Admin SDK initialization
        console.log('Testing Firebase Admin SDK initialization...');
        
        // Test sending a test notification
        const message = {
            notification: {
                title: 'Test Notification',
                body: 'This is a test notification from the backend'
            },
            topic: 'test_topic'
        };

        const response = await admin.messaging().send(message);
        console.log('Successfully sent test notification:', response);
        
        return true;
    } catch (error) {
        console.error('Error testing Firebase connection:', error);
        return false;
    }
}

// Run the test
testFirebaseConnection().then(success => {
    if (success) {
        console.log('Firebase configuration test passed!');
    } else {
        console.log('Firebase configuration test failed!');
    }
    process.exit(0);
}); 