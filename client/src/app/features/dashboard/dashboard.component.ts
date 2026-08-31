import { Component, inject, OnInit, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { AuthService } from '../../core/services/auth.service';
import { GrievanceService } from '../../core/services/grievance.service';
import { Grievance } from '@union-local/shared';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatTableModule,
    MatChipsModule,
    MatProgressBarModule
  ],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss'
})
export class DashboardComponent implements OnInit {
  public auth = inject(AuthService);
  public grievanceService = inject(GrievanceService);

  public displayedColumns: string[] = ['grievanceNumber', 'title', 'currentStep', 'deadline', 'actions'];

  // Signals computed metrics
  public totalCount = computed(() => this.grievanceService.grievances().length);
  public step1Count = computed(() => this.grievanceService.grievances().filter(g => g.currentStep === 'STEP_1_INFORMAL').length);
  public step2Count = computed(() => this.grievanceService.grievances().filter(g => g.currentStep === 'STEP_2_FORMAL').length);
  public step3Count = computed(() => this.grievanceService.grievances().filter(g => g.currentStep === 'STEP_3_MEDIATION').length);
  public step4Count = computed(() => this.grievanceService.grievances().filter(g => g.currentStep === 'STEP_4_ARBITRATION').length);
  public settledCount = computed(() => this.grievanceService.grievances().filter(g => g.currentStep === 'SETTLED').length);

  public urgentGrievances = computed(() => {
    return this.grievanceService.grievances().filter(g => 
      g.currentStep !== 'SETTLED' && 
      g.currentStep !== 'CLOSED' && 
      g.deadlines?.daysRemaining !== undefined && 
      g.deadlines.daysRemaining <= 5
    );
  });

  public recentGrievances = computed(() => {
    return this.grievanceService.grievances().slice(0, 5);
  });

  ngOnInit(): void {
    this.grievanceService.subscribeToGrievances();
  }

  public formatStep(step: string): string {
    return step ? step.replace(/_/g, ' ') : '';
  }

  public getStepClass(step: string): string {
    switch (step) {
      case 'STEP_1_INFORMAL': return 'step-1';
      case 'STEP_2_FORMAL': return 'step-2';
      case 'STEP_3_MEDIATION': return 'step-3';
      case 'STEP_4_ARBITRATION': return 'step-4';
      case 'SETTLED': return 'step-settled';
      default: return 'step-closed';
    }
  }

  public getPriorityClass(priority: string): string {
    switch (priority) {
      case 'URGENT': return 'badge-danger';
      case 'HIGH': return 'badge-warning';
      case 'MEDIUM': return 'badge-primary';
      default: return 'badge-neutral';
    }
  }
}
