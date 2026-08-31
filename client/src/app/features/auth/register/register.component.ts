import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule
  ],
  templateUrl: './register.component.html',
  styleUrl: './register.component.scss'
})
export class RegisterComponent {
  private auth = inject(AuthService);

  public isLoading = signal(false);
  public errorMessage = signal<string | null>(null);

  public async signUpWithGoogle(): Promise<void> {
    this.isLoading.set(true);
    this.errorMessage.set(null);
    try {
      await this.auth.loginWithGoogle();
    } catch (err: any) {
      console.error('Google Sign-Up error:', err);
      this.errorMessage.set(err.message || 'Google registration failed. Please try again.');
    } finally {
      this.isLoading.set(false);
    }
  }

  public async signUpWithApple(): Promise<void> {
    this.isLoading.set(true);
    this.errorMessage.set(null);
    try {
      await this.auth.loginWithApple();
    } catch (err: any) {
      console.error('Apple Sign-Up error:', err);
      this.errorMessage.set(err.message || 'Apple registration failed. Please try again.');
    } finally {
      this.isLoading.set(false);
    }
  }
}
