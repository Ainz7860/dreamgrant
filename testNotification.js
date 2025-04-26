const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccount.json');

// Initialize Firebase Admin with service account
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

async function sendTestNotification() {
    try {
        const message = {
            notification: {
                title: 'New Scholarship Available',
                body: 'A new government scholarship has been added'
            },
            data: {
                type: 'government',
                count: '1',
                timestamp: new Date().toISOString()
            },
            topic: 'scholarships_government'
        };

        const response = await admin.messaging().send(message);
        console.log('Successfully sent notification:', response);
    } catch (error) {
        console.error('Error sending notification:', error);
        console.error('Error details:', error.errorInfo);
    }
}

sendTestNotification(); 