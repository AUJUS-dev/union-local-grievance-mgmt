import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatTabsModule } from '@angular/material/tabs';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { collection, getDocs, doc, updateDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { FirebaseService } from '../../core/services/firebase.service';
import { CBAService } from '../../core/services/cba.service';
import { UserProfile, UserRole } from '@union-local/shared';

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatTableModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatTabsModule,
    MatProgressBarModule
  ],
  templateUrl: './admin.component.html',
  styleUrl: './admin.component.scss'
})
export class AdminComponent implements OnInit {
  private firebase = inject(FirebaseService);
  public cbaService = inject(CBAService);

  public userColumns: string[] = ['name', 'info', 'role', 'actions'];
  public users = signal<UserProfile[]>([]);
  public isLoading = signal(false);

  async ngOnInit(): Promise<void> {
    await this.loadUsers();
    await this.cbaService.loadCBAData();
  }

  public async loadUsers(): Promise<void> {
    this.isLoading.set(true);
    try {
      const snap = await getDocs(collection(this.firebase.firestore, 'users'));
      const list: UserProfile[] = [];
      snap.forEach((d) => list.push(d.data() as UserProfile));
      this.users.set(list);
    } finally {
      this.isLoading.set(false);
    }
  }

  public async updateUserRole(uid: string, role: UserRole): Promise<void> {
    this.isLoading.set(true);
    try {
      // Call Admin Cloud Function or direct Firestore update
      try {
        const setUserRoleCallable = httpsCallable(this.firebase.functions, 'setUserRole');
        await setUserRoleCallable({ targetUid: uid, role });
      } catch {
        // Fallback to direct Firestore update
        await updateDoc(doc(this.firebase.firestore, 'users', uid), {
          role,
          updatedAt: new Date().toISOString()
        });
      }

      await this.loadUsers();
    } catch (err) {
      console.error('Error updating user role:', err);
      alert('Failed to update user role.');
    } finally {
      this.isLoading.set(false);
    }
  }

  public formatRole(role: string): string {
    switch (role) {
      case 'business_agent': return 'Business Agent';
      case 'chief_steward': return 'Chief Steward';
      case 'steward': return 'Shop Steward';
      case 'admin': return 'Union Admin';
      case 'member': return 'Member';
      default: return role?.replace(/_/g, ' ') || 'Member';
    }
  }
}
