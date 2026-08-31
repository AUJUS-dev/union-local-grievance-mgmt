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
  try {
    // 1. Check if user already has custom claims with a defined role
    const authUser = await admin.auth().getUser(user.uid);
    const existingClaims = authUser.customClaims as UserCustomClaims | undefined;
    if (existingClaims && existingClaims.role) {
      console.log(`User ${user.uid} already has custom claim role: ${existingClaims.role}, preserving role.`);
      return;
    }

    // 2. Check if Firestore user document already exists with a role
    const userDocRef = db.collection('users').doc(user.uid);
    const userDoc = await userDocRef.get();
    if (userDoc.exists && userDoc.data()?.['role']) {
      const existingRole = userDoc.data()?.['role'] as UserRole;
      console.log(`User ${user.uid} already has Firestore role: ${existingRole}, syncing custom claims.`);
      await admin.auth().setCustomUserClaims(user.uid, {
        role: existingRole,
        localNumber: userDoc.data()?.['localNumber'] || 'Local 1118',
        stewardUnits: userDoc.data()?.['stewardUnitIds'] || []
      });
      return;
    }

    // 3. Brand new unprovisioned user: set default member role
    const role: UserRole = 'member';
    const defaultLocal = 'Local 1118';
    const customClaims: UserCustomClaims = {
      role,
      localNumber: defaultLocal
    };

    await admin.auth().setCustomUserClaims(user.uid, customClaims);

    const userProfile: Partial<UserProfile> = {
      uid: user.uid,
      email: user.email || '',
      displayName: user.displayName || user.email?.split('@')[0] || 'Union Member',
      role,
      localNumber: defaultLocal,
      isRegistered: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await userDocRef.set(userProfile, { merge: true });
    console.log(`Successfully provisioned new user ${user.uid} with default role: ${role}`);
  } catch (error) {
    console.error(`Failed in onUserCreated for user ${user.uid}:`, error);
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

  const validRoles: UserRole[] = ['admin', 'business_agent', 'chief_steward', 'steward', 'member'];
  if (!validRoles.includes(role)) {
    throw new HttpsError('invalid-argument', `Invalid role. Must be one of: ${validRoles.join(', ')}`);
  }

  const isStewardRole = ['steward', 'chief_steward', 'business_agent'].includes(role);

  try {
    // 1. Update Auth Custom Claims
    const currentClaims = (await admin.auth().getUser(targetUid)).customClaims || {};
    const newClaims: UserCustomClaims = {
      ...currentClaims,
      role,
      stewardUnits: isStewardRole ? stewardUnits || [] : []
    };

    await admin.auth().setCustomUserClaims(targetUid, newClaims);

    // 2. Update Firestore User Profile
    const updateData: Partial<UserProfile> = {
      role,
      stewardUnitIds: isStewardRole ? stewardUnits || [] : [],
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
