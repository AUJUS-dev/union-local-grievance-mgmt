"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.onGrievanceWrite = void 0;
const admin = __importStar(require("firebase-admin"));
const firestore_1 = require("firebase-functions/v2/firestore");
const db = admin.firestore();
/**
 * Automatically records immutable audit activities when a Grievance is created or modified.
 */
exports.onGrievanceWrite = (0, firestore_1.onDocumentWritten)('grievances/{grievanceId}', async (event) => {
    const grievanceId = event.params.grievanceId;
    const before = event.data?.before?.data();
    const after = event.data?.after?.data();
    // Case 1: Document deleted
    if (!after) {
        console.log(`Grievance ${grievanceId} was deleted.`);
        return;
    }
    const activitiesRef = db.collection('grievances').doc(grievanceId).collection('activities');
    const now = new Date().toISOString();
    // Case 2: Document newly created
    if (!before) {
        const createActivity = {
            id: db.collection('_').doc().id,
            grievanceId,
            action: 'CREATED',
            description: `Grievance #${after.grievanceNumber} filed under ${after.bargainingUnitName}. Initial Step: ${after.currentStep.replace(/_/g, ' ')}.`,
            performedBy: {
                uid: after.memberUid || 'system',
                name: after.memberName || 'Union Member',
                role: 'member'
            },
            metadata: {
                initialStep: after.currentStep,
                incidentDate: after.incidentDate,
                remedyRequested: after.remedyRequested
            },
            timestamp: now
        };
        await activitiesRef.doc(createActivity.id).set(createActivity);
        return;
    }
    // Case 3: Step changed
    if (before.currentStep !== after.currentStep) {
        const stepActivity = {
            id: db.collection('_').doc().id,
            grievanceId,
            action: 'STEP_CHANGED',
            description: `Grievance escalated/transitioned from ${before.currentStep.replace(/_/g, ' ')} to ${after.currentStep.replace(/_/g, ' ')}.`,
            performedBy: {
                uid: 'system',
                name: 'Grievance Officer / Steward',
                role: 'steward'
            },
            metadata: {
                previousStep: before.currentStep,
                newStep: after.currentStep,
                newDeadline: after.deadlines?.currentDeadline
            },
            timestamp: now
        };
        await activitiesRef.doc(stepActivity.id).set(stepActivity);
    }
    // Case 4: Status changed
    if (before.status !== after.status) {
        const statusActivity = {
            id: db.collection('_').doc().id,
            grievanceId,
            action: 'STATUS_CHANGED',
            description: `Status updated from ${before.status.replace(/_/g, ' ')} to ${after.status.replace(/_/g, ' ')}.`,
            performedBy: {
                uid: 'system',
                name: 'Grievance System',
                role: 'system'
            },
            metadata: {
                previousStatus: before.status,
                newStatus: after.status
            },
            timestamp: now
        };
        await activitiesRef.doc(statusActivity.id).set(statusActivity);
    }
    // Case 5: Steward assignment changed
    if (before.assignedStewardUid !== after.assignedStewardUid && after.assignedStewardUid) {
        const stewardActivity = {
            id: db.collection('_').doc().id,
            grievanceId,
            action: 'STEWARD_ASSIGNED',
            description: `Assigned Steward set to ${after.assignedStewardName || after.assignedStewardUid}.`,
            performedBy: {
                uid: 'system',
                name: 'Union Admin',
                role: 'admin'
            },
            metadata: {
                stewardUid: after.assignedStewardUid,
                stewardName: after.assignedStewardName
            },
            timestamp: now
        };
        await activitiesRef.doc(stewardActivity.id).set(stewardActivity);
    }
});
//# sourceMappingURL=audit.js.map