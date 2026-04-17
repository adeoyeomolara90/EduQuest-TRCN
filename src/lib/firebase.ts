import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

// Validate connection
async function testConnection() {
  try {
    // Try to reach Firestore to verify configuration
    await getDocFromServer(doc(db, '_connection_test_', 'ping'));
  } catch (error: any) {
    // These errors typically mean Firestore is not enabled or the config is wrong
    if (
      error?.message?.includes('the client is offline') || 
      error?.code === 'unavailable' ||
      error?.code === 'failed-precondition'
    ) {
      console.error(
        "Firebase Connection Error: Likely Firestore is not initialized.\n" +
        "1. Go to Firebase Console: https://console.firebase.google.com/project/fireaibot/firestore\n" +
        "2. Click 'Create Database' if you haven't already.\n" +
        "3. Ensure the database ID matches '(default)' or update your config."
      );
    } else {
      console.warn("Initial Firestore connection test resulted in an expected error (this is normal if the document doesn't exist, but it confirms reachability):", error.message);
    }
  }
}

testConnection();
