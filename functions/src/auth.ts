import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions/v1';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { SetUserRoleRequest, UserCustomClaims, UserProfile, UserRole } from '@union-local/shared';

const db = admin.firestore();

/**
 * Automatically assign the 'member' role and create a user profile document
 * in Firestore when a new Firebase Auth account is created.
 */
export const onUserCreated = functions.auth.user().onCreate(async (user) => {
  const role: UserRole = 'member';
  const defaultLocal = 'Local 1118';

  const customClaims: UserCustomClaims = {
    role,
    localNumber: defaultLocal
  };

  try {
    // 1. Set Custom Claims on the Auth record
    await admin.auth().setCustomUserClaims(user.uid, customClaims);

    // 2. Create the Firestore User Profile document
    const userProfile: UserProfile = {
      uid: user.uid,
      email: user.email || '',
      displayName: user.displayName || user.email?.split('@')[0] || 'Union Member',
      role,
      localNumber: defaultLocal,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await db.collection('users').doc(user.uid).set(userProfile, { merge: true });

    console.log(`Successfully provisioned user ${user.uid} with role: ${role}`);
  } catch (error) {
    console.error(`Failed to provision user ${user.uid}:`, error);
  }
});

/**
 * Admin-only callable function to update a user's role and steward bargaining unit assignments.
 */
export const setUserRole = onCall<SetUserRoleRequest>(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated to perform this operation.');
  }

  // Check if caller is an admin
  const callerToken = request.auth.token;
  if (callerToken.role !== 'admin') {
    throw new HttpsError('permission-denied', 'Only Union Administrators can change user roles.');
  }

  const { targetUid, role, stewardUnits } = request.data;
  if (!targetUid || !role) {
    throw new HttpsError('invalid-argument', 'targetUid and role are required parameters.');
  }

  const validRoles: UserRole[] = ['admin', 'steward', 'member'];
  if (!validRoles.includes(role)) {
    throw new HttpsError('invalid-argument', `Invalid role. Must be one of: ${validRoles.join(', ')}`);
  }

  try {
    // 1. Update Auth Custom Claims
    const currentClaims = (await admin.auth().getUser(targetUid)).customClaims || {};
    const newClaims: UserCustomClaims = {
      ...currentClaims,
      role,
      stewardUnits: role === 'steward' ? stewardUnits || [] : []
    };

    await admin.auth().setCustomUserClaims(targetUid, newClaims);

    // 2. Update Firestore User Profile
    const updateData: Partial<UserProfile> = {
      role,
      stewardUnitIds: role === 'steward' ? stewardUnits || [] : [],
      updatedAt: new Date().toISOString()
    };

    await db.collection('users').doc(targetUid).update(updateData);

    return {
      success: true,
      message: `User ${targetUid} updated to role '${role}'.`
    };
  } catch (error: any) {
    console.error(`Error updating role for ${targetUid}:`, error);
    throw new HttpsError('internal', error.message || 'Failed to update user role.');
  }
});
