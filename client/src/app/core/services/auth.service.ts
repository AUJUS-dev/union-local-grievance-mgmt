import { Injectable, signal, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import {
  signInWithPopup,
  GoogleAuthProvider,
  OAuthProvider,
  signInWithEmailAndPassword,
  signOut,
  onIdTokenChanged,
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

  // Computed Role Signals
  public readonly isAuthenticated = computed(() => !!this.currentUser());
  public readonly isAdmin = computed(() => this.userRole() === 'admin');
  public readonly isSteward = computed(() => this.userRole() === 'steward' || this.userRole() === 'admin');
  public readonly isMember = computed(() => !!this.currentUser());

  constructor() {
    this.initAuthStateListener();
  }

  private initAuthStateListener(): void {
    onIdTokenChanged(this.firebase.auth, async (user) => {
      this.isLoading.set(true);
      if (user) {
        this.currentUser.set(user);
        
        // Fetch custom claims token
        const idTokenResult = await user.getIdTokenResult(true);
        const roleFromClaim = (idTokenResult.claims['role'] as UserRole) || 'member';
        this.userRole.set(roleFromClaim);

        // Fetch / initialize Firestore profile
        await this.loadUserProfile(user.uid, roleFromClaim);
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
        const user = this.currentUser();
        const defaultProfile: UserProfile = {
          uid,
          email: user?.email || '',
          displayName: user?.displayName || user?.email?.split('@')[0] || 'Union Member',
          role: fallbackRole,
          localNumber: 'Local 1118',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        await setDoc(userDocRef, defaultProfile);
        this.userProfile.set(defaultProfile);
        return defaultProfile;
      }
    } catch (err) {
      console.error('Error fetching user profile from Firestore:', err);
      return null;
    }
  }

  public async loginWithGoogle(): Promise<void> {
    this.isLoading.set(true);
    try {
      const provider = new GoogleAuthProvider();
      provider.addScope('email');
      provider.addScope('profile');
      await signInWithPopup(this.firebase.auth, provider);
      await this.router.navigate(['/dashboard']);
    } finally {
      this.isLoading.set(false);
    }
  }

  public async loginWithApple(): Promise<void> {
    this.isLoading.set(true);
    try {
      const provider = new OAuthProvider('apple.com');
      provider.addScope('email');
      provider.addScope('name');
      await signInWithPopup(this.firebase.auth, provider);
      await this.router.navigate(['/dashboard']);
    } finally {
      this.isLoading.set(false);
    }
  }

  public async demoLogin(role: 'admin' | 'steward' | 'member'): Promise<void> {
    const demoAccounts = {
      admin: { email: 'admin@unionlocal.org', password: 'password123' },
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
