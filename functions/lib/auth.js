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
exports.setUserRole = exports.onUserCreated = void 0;
const admin = __importStar(require("firebase-admin"));
const functions = __importStar(require("firebase-functions/v1"));
const https_1 = require("firebase-functions/v2/https");
const db = admin.firestore();
/**
 * Automatically assign the 'member' role and create a user profile document
 * in Firestore when a new Firebase Auth account is created.
 */
exports.onUserCreated = functions.auth.user().onCreate(async (user) => {
    const role = 'member';
    const defaultLocal = 'Local 1118';
    const customClaims = {
        role,
        localNumber: defaultLocal
    };
    try {
        // 1. Set Custom Claims on the Auth record
        await admin.auth().setCustomUserClaims(user.uid, customClaims);
        // 2. Create the Firestore User Profile document
        const userProfile = {
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
    }
    catch (error) {
        console.error(`Failed to provision user ${user.uid}:`, error);
    }
});
/**
 * Admin-only callable function to update a user's role and steward bargaining unit assignments.
 */
exports.setUserRole = (0, https_1.onCall)(async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'User must be authenticated to perform this operation.');
    }
    // Check if caller is an admin
    const callerToken = request.auth.token;
    if (callerToken.role !== 'admin') {
        throw new https_1.HttpsError('permission-denied', 'Only Union Administrators can change user roles.');
    }
    const { targetUid, role, stewardUnits } = request.data;
    if (!targetUid || !role) {
        throw new https_1.HttpsError('invalid-argument', 'targetUid and role are required parameters.');
    }
    const validRoles = ['admin', 'steward', 'member'];
    if (!validRoles.includes(role)) {
        throw new https_1.HttpsError('invalid-argument', `Invalid role. Must be one of: ${validRoles.join(', ')}`);
    }
    try {
        // 1. Update Auth Custom Claims
        const currentClaims = (await admin.auth().getUser(targetUid)).customClaims || {};
        const newClaims = {
            ...currentClaims,
            role,
            stewardUnits: role === 'steward' ? stewardUnits || [] : []
        };
        await admin.auth().setCustomUserClaims(targetUid, newClaims);
        // 2. Update Firestore User Profile
        const updateData = {
            role,
            stewardUnitIds: role === 'steward' ? stewardUnits || [] : [],
            updatedAt: new Date().toISOString()
        };
        await db.collection('users').doc(targetUid).update(updateData);
        return {
            success: true,
            message: `User ${targetUid} updated to role '${role}'.`
        };
    }
    catch (error) {
        console.error(`Error updating role for ${targetUid}:`, error);
        throw new https_1.HttpsError('internal', error.message || 'Failed to update user role.');
    }
});
//# sourceMappingURL=auth.js.map