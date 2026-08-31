import { Component, inject, OnInit, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatDividerModule } from '@angular/material/divider';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { AuthService } from '../../../core/services/auth.service';
import { CBAService } from '../../../core/services/cba.service';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    ReactiveFormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatDividerModule,
    MatSnackBarModule
  ],
  templateUrl: './register.component.html',
  styleUrl: './register.component.scss'
})
export class RegisterComponent implements OnInit {
  public auth = inject(AuthService);
  public cbaService = inject(CBAService);
  private router = inject(Router);
  private fb = inject(FormBuilder);
  private snackBar = inject(MatSnackBar);

  public isLoading = signal(false);
  public errorMessage = signal<string | null>(null);

  public registerForm!: FormGroup;

  constructor() {
    this.initForm();

    // Watch for auth changes to populate user info
    effect(() => {
      const user = this.auth.currentUser();
      const isRegistered = this.auth.isRegistered();

      if (user && isRegistered) {
        this.router.navigate(['/dashboard']);
      } else if (user && this.registerForm) {
        if (!this.registerForm.get('displayName')?.value) {
          this.registerForm.patchValue({
            displayName: user.displayName || user.email?.split('@')[0] || ''
          });
        }
      }
    });
  }

  async ngOnInit(): Promise<void> {
    await this.cbaService.loadCBAData();

    // Default bargaining unit if units are loaded
    const units = this.cbaService.bargainingUnits();
    if (units.length > 0 && !this.registerForm.get('bargainingUnitId')?.value) {
      this.registerForm.patchValue({
        bargainingUnitId: units[0].id
      });
    }
  }

  private initForm(): void {
    const user = this.auth.currentUser();
    this.registerForm = this.fb.group({
      displayName: [user?.displayName || '', [Validators.required, Validators.minLength(2)]],
      memberId: ['', [Validators.required, Validators.pattern(/^[a-zA-Z0-9\-_]{3,20}$/)]],
      phoneNumber: ['', [Validators.required, Validators.pattern(/^\(\d{3}\)\s\d{3}-\d{4}$/)]],
      bargainingUnitId: ['unit-main-mfg', Validators.required],
      localNumber: ['Local 1118', Validators.required],
      department: [''],
      jobTitle: ['']
    });
  }

  public onPhoneInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    let digits = input.value.replace(/\D/g, '');

    // Strip leading 1 if user typed country code with 11 digits
    if (digits.length === 11 && digits.startsWith('1')) {
      digits = digits.substring(1);
    }

    digits = digits.substring(0, 10);

    let formatted = '';
    if (digits.length === 0) {
      formatted = '';
    } else if (digits.length <= 3) {
      formatted = `(${digits}`;
    } else if (digits.length <= 6) {
      formatted = `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
    } else {
      formatted = `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
    }

    this.registerForm.get('phoneNumber')?.setValue(formatted, { emitEvent: false });
    input.value = formatted;
  }

  public async signUpWithGoogle(): Promise<void> {
    this.isLoading.set(true);
    this.errorMessage.set(null);
    try {
      const result = await this.auth.loginWithGoogle();
      if (!result.isNewUser && result.profile?.isRegistered) {
        await this.router.navigate(['/dashboard']);
      }
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
      const result = await this.auth.loginWithApple();
      if (!result.isNewUser && result.profile?.isRegistered) {
        await this.router.navigate(['/dashboard']);
      }
    } catch (err: any) {
      console.error('Apple Sign-Up error:', err);
      this.errorMessage.set(err.message || 'Apple registration failed. Please try again.');
    } finally {
      this.isLoading.set(false);
    }
  }

  public async onSubmit(): Promise<void> {
    if (this.registerForm.invalid) {
      this.registerForm.markAllAsTouched();
      return;
    }

    this.isLoading.set(true);
    this.errorMessage.set(null);

    try {
      const formVal = this.registerForm.value;
      const profile = await this.auth.completeRegistration({
        displayName: formVal.displayName.trim(),
        memberId: formVal.memberId.trim().toUpperCase(),
        phoneNumber: formVal.phoneNumber.trim(),
        bargainingUnitId: formVal.bargainingUnitId,
        localNumber: formVal.localNumber.trim(),
        department: formVal.department?.trim() || '',
        jobTitle: formVal.jobTitle?.trim() || ''
      });

      this.snackBar.open(`Welcome to CWA Local 1118, ${profile.displayName}!`, 'Close', {
        duration: 5000,
        horizontalPosition: 'end',
        verticalPosition: 'top'
      });

      await this.router.navigate(['/dashboard']);
    } catch (err: any) {
      console.error('Error completing registration:', err);
      this.errorMessage.set(err.message || 'Failed to complete registration. Please try again.');
    } finally {
      this.isLoading.set(false);
    }
  }

  public async cancelAndSignOut(): Promise<void> {
    await this.auth.logout();
  }
}

