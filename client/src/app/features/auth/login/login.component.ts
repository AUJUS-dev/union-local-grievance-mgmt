import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule
  ],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss'
})
export class LoginComponent {
  private auth = inject(AuthService);

  public isLoading = signal(false);
  public errorMessage = signal<string | null>(null);

  public async signInWithGoogle(): Promise<void> {
    this.isLoading.set(true);
    this.errorMessage.set(null);
    try {
      await this.auth.loginWithGoogle();
    } catch (err: any) {
      console.error('Google Sign-In error:', err);
      this.errorMessage.set(err.message || 'Google sign-in failed. Please try again.');
    } finally {
      this.isLoading.set(false);
    }
  }

  public async signInWithApple(): Promise<void> {
    this.isLoading.set(true);
    this.errorMessage.set(null);
    try {
      await this.auth.loginWithApple();
    } catch (err: any) {
      console.error('Apple Sign-In error:', err);
      this.errorMessage.set(err.message || 'Apple sign-in failed. Please try again.');
    } finally {
      this.isLoading.set(false);
    }
  }

  public async loginAsDemo(role: 'admin' | 'steward' | 'member'): Promise<void> {
    this.isLoading.set(true);
    this.errorMessage.set(null);
    try {
      await this.auth.demoLogin(role);
    } catch (err: any) {
      console.error('Demo login error:', err);
      this.errorMessage.set(err.message || 'Error logging into demo account. Please ensure emulator is running or seeded.');
    } finally {
      this.isLoading.set(false);
    }
  }
}
