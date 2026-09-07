import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatChipsModule } from '@angular/material/chips';
import { MatDividerModule } from '@angular/material/divider';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatToolbarModule,
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
    MatChipsModule,
    MatDividerModule
  ],
  templateUrl: './navbar.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './navbar.component.scss'
})
export class NavbarComponent {
  public auth = inject(AuthService);

  public formatRole(role: string): string {
    switch (role) {
      case 'business_agent': return 'Business Agent';
      case 'chief_steward': return 'Chief Steward';
      case 'steward': return 'Shop Steward';
      case 'admin': return 'Admin';
      case 'member': return 'Member';
      default: return role?.replace(/_/g, ' ') || 'Member';
    }
  }

  public getRoleIcon(role: string): string {
    switch (role) {
      case 'admin': return 'security';
      case 'business_agent': return 'business_center';
      case 'chief_steward': return 'stars';
      case 'steward': return 'badge';
      default: return 'person';
    }
  }
}
