import * as admin from 'firebase-admin';

// Initialize Firebase Admin SDK
admin.initializeApp();
admin.firestore().settings({ ignoreUndefinedProperties: true });

// Export Auth functions
export { onUserCreated, setUserRole } from './auth';

// Export Audit & Grievance trigger functions
export { onGrievanceWrite } from './audit';

// Export PDF generation function
export { generateGrievancePdf } from './pdf';
