import * as admin from 'firebase-admin';
import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { Grievance, GrievanceActivityLog } from '@union-local/shared';

const db = admin.firestore();

/**
 * Automatically records immutable audit activities when a Grievance is created or modified.
 */
export const onGrievanceWrite = onDocumentWritten('grievances/{grievanceId}', async (event) => {
  const grievanceId = event.params.grievanceId;
  const before = event.data?.before?.data() as Grievance | undefined;
  const after = event.data?.after?.data() as Grievance | undefined;

  // Case 1: Document deleted
  if (!after) {
    console.log(`Grievance ${grievanceId} was deleted.`);
    return;
  }

  const activitiesRef = db.collection('grievances').doc(grievanceId).collection('activities');
  const now = new Date().toISOString();

  // Case 2: Document newly created
  if (!before) {
    const createActivity: GrievanceActivityLog = {
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
    const stepActivity: GrievanceActivityLog = {
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
    const statusActivity: GrievanceActivityLog = {
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
    const stewardActivity: GrievanceActivityLog = {
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
