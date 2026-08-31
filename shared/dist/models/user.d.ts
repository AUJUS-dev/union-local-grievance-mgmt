export type UserRole = 'admin' | 'business_agent' | 'chief_steward' | 'steward' | 'member';
export interface UserCustomClaims {
    role: UserRole;
    localNumber?: string;
    stewardUnits?: string[];
}
export interface UserProfile {
    uid: string;
    email: string;
    displayName: string;
    role: UserRole;
    localNumber: string;
    memberId?: string;
    phoneNumber?: string;
    bargainingUnitId?: string;
    stewardUnitIds?: string[];
    department?: string;
    jobTitle?: string;
    isRegistered?: boolean;
    createdAt: string;
    updatedAt: string;
}
export interface SetUserRoleRequest {
    targetUid: string;
    role: UserRole;
    stewardUnits?: string[];
}
