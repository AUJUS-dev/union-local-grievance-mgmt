import { Injectable, signal, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import {
  signInWithPopup,
  GoogleAuthProvider,
  OAuthProvider,
  signInWithEmailAndPassword,
  signOut,
  onIdTokenChanged,
  getAdditionalUserInfo,
  User
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { FirebaseService } from './firebase.service';
import { UserProfile, UserRole } from '@union-local/shared';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private firebase = inject(FirebaseService);
  private router = inject(Router);

  // State Signals
  public readonly currentUser = signal<User | null>(null);
  public readonly userProfile = signal<UserProfile | null>(null);
  public readonly userRole = signal<UserRole | null>(null);
  public readonly isLoading = signal<boolean>(true);

  // Computed Signals
  public readonly isAuthenticated = computed(() => !!this.currentUser());
  public readonly isRegistered = computed(() => {
    const profile = this.userProfile();
    if (!profile) return false;
    if (profile.isRegistered === true) return true;
    if (['admin', 'business_agent', 'chief_steward', 'steward'].includes(profile.role)) return true;
    return !!(profile.memberId && profile.bargainingUnitId);
  });
  public readonly isAdmin = computed(() => this.userRole() === 'admin');
  public readonly isBusinessAgent = computed(() => this.userRole() === 'business_agent');
  public readonly isChiefSteward = computed(() => this.userRole() === 'chief_steward');
  public readonly isSteward = computed(() => {
    const role = this.userRole();
    return role === 'steward' || role === 'chief_steward' || role === 'business_agent' || role === 'admin';
  });
  public readonly isMember = computed(() => !!this.currentUser());

  constructor() {
    this.initAuthStateListener();
  }

  private initAuthStateListener(): void {
    onIdTokenChanged(this.firebase.auth, async (user) => {
      this.isLoading.set(true);
      if (user) {
        this.currentUser.set(user);

        // 1. Fetch Firestore profile
        const profile = await this.loadUserProfile(user.uid);

        // 2. Fetch custom claims token
        let roleFromClaim: UserRole | undefined;
        try {
          const idTokenResult = await user.getIdTokenResult(true);
          roleFromClaim = idTokenResult.claims['role'] as UserRole;
        } catch (e) {
          console.warn('Could not fetch custom claims:', e);
        }

        // 3. Determine role (profile role or claim, fallback to member)
        const finalRole = profile?.role || roleFromClaim || 'member';
        this.userRole.set(finalRole);
      } else {
        this.currentUser.set(null);
        this.userProfile.set(null);
        this.userRole.set(null);
      }
      this.isLoading.set(false);
    });
  }

  public async loadUserProfile(uid: string, fallbackRole: UserRole = 'member'): Promise<UserProfile | null> {
    try {
      const userDocRef = doc(this.firebase.firestore, 'users', uid);
      const snap = await getDoc(userDocRef);
      if (snap.exists()) {
        const profile = snap.data() as UserProfile;
        this.userProfile.set(profile);
        if (profile.role) {
          this.userRole.set(profile.role);
        }
        return profile;
      } else {
        this.userProfile.set(null);
        return null;
      }
    } catch (err) {
      console.error('Error fetching user profile from Firestore:', err);
      return null;
    }
  }

  public async completeRegistration(data: {
    displayName: string;
    memberId: string;
    phoneNumber: string;
    bargainingUnitId: string;
    localNumber?: string;
    department?: string;
    jobTitle?: string;
  }): Promise<UserProfile> {
    const user = this.currentUser();
    if (!user) {
      throw new Error('No authenticated user found. Please sign in with an authentication provider first.');
    }

    const now = new Date().toISOString();
    const newProfile: UserProfile = {
      uid: user.uid,
      email: user.email || '',
      displayName: data.displayName || user.displayName || 'Union Member',
      role: (this.userRole() as UserRole) || 'member',
      localNumber: data.localNumber || 'Local 1118',
      memberId: data.memberId,
      phoneNumber: data.phoneNumber,
      bargainingUnitId: data.bargainingUnitId,
      department: data.department || '',
      jobTitle: data.jobTitle || '',
      isRegistered: true,
      createdAt: this.userProfile()?.createdAt || now,
      updatedAt: now
    };

    const userDocRef = doc(this.firebase.firestore, 'users', user.uid);
    await setDoc(userDocRef, newProfile, { merge: true });
    this.userProfile.set(newProfile);
    this.userRole.set(newProfile.role);

    return newProfile;
  }

  public async loginWithGoogle(): Promise<{ isNewUser: boolean; profile: UserProfile | null }> {
    this.isLoading.set(true);
    try {
      const provider = new GoogleAuthProvider();
      provider.addScope('email');
      provider.addScope('profile');
      const cred = await signInWithPopup(this.firebase.auth, provider);
      const isNewUserFromAuth = getAdditionalUserInfo(cred)?.isNewUser ?? false;
      const profile = await this.loadUserProfile(cred.user.uid);
      const isProfileRegistered = !!profile?.isRegistered || (!!profile?.memberId && !!profile?.bargainingUnitId);

      if (isNewUserFromAuth || !isProfileRegistered) {
        await this.router.navigate(['/auth/register']);
        return { isNewUser: true, profile };
      } else {
        await this.router.navigate(['/dashboard']);
        return { isNewUser: false, profile };
      }
    } finally {
      this.isLoading.set(false);
    }
  }

  public async loginWithApple(): Promise<{ isNewUser: boolean; profile: UserProfile | null }> {
    this.isLoading.set(true);
    try {
      const provider = new OAuthProvider('apple.com');
      provider.addScope('email');
      provider.addScope('name');
      const cred = await signInWithPopup(this.firebase.auth, provider);
      const isNewUserFromAuth = getAdditionalUserInfo(cred)?.isNewUser ?? false;
      const profile = await this.loadUserProfile(cred.user.uid);
      const isProfileRegistered = !!profile?.isRegistered || (!!profile?.memberId && !!profile?.bargainingUnitId);

      if (isNewUserFromAuth || !isProfileRegistered) {
        await this.router.navigate(['/auth/register']);
        return { isNewUser: true, profile };
      } else {
        await this.router.navigate(['/dashboard']);
        return { isNewUser: false, profile };
      }
    } finally {
      this.isLoading.set(false);
    }
  }

  public async demoLogin(role: 'admin' | 'business_agent' | 'chief_steward' | 'steward' | 'member'): Promise<void> {
    const demoAccounts = {
      admin: { email: 'admin@unionlocal.org', password: 'password123' },
      business_agent: { email: 'agent@unionlocal.org', password: 'password123' },
      chief_steward: { email: 'chiefsteward@unionlocal.org', password: 'password123' },
      steward: { email: 'steward@unionlocal.org', password: 'password123' },
      member: { email: 'member@unionlocal.org', password: 'password123' }
    };

    const target = demoAccounts[role];
    if (target) {
      this.isLoading.set(true);
      try {
        await signInWithEmailAndPassword(this.firebase.auth, target.email, target.password);
        await this.router.navigate(['/dashboard']);
      } finally {
        this.isLoading.set(false);
      }
    }
  }

  public async logout(): Promise<void> {
    await signOut(this.firebase.auth);
    this.currentUser.set(null);
    this.userProfile.set(null);
    this.userRole.set(null);
    await this.router.navigate(['/auth/login']);
  }
}

