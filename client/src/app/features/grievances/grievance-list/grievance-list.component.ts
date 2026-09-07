import { Component, inject, OnInit, signal, computed, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { GrievanceService } from '../../../core/services/grievance.service';
import { CBAService } from '../../../core/services/cba.service';
import { PdfService } from '../../../core/services/pdf.service';
import { Grievance, GrievanceStep } from '@union-local/shared';

@Component({
  selector: 'app-grievance-list',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    FormsModule,
    MatCardModule,
    MatTableModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatTabsModule,
    MatTooltipModule,
    MatProgressBarModule
  ],
  templateUrl: './grievance-list.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './grievance-list.component.scss'
})
export class GrievanceListComponent implements OnInit {
  public grievanceService = inject(GrievanceService);
  public cbaService = inject(CBAService);
  private pdfService = inject(PdfService);

  public columns: string[] = ['grievanceNumber', 'title', 'member', 'steward', 'step', 'deadline', 'actions'];

  public searchQuery = signal<string>('');
  public selectedStepFilter = signal<string>('ALL');
  public selectedPriority = signal<string>('ALL');
  public selectedUnit = signal<string>('ALL');

  public hasActiveFilters = computed(() => {
    return (
      this.searchQuery().trim() !== '' ||
      this.selectedStepFilter() !== 'ALL' ||
      this.selectedPriority() !== 'ALL' ||
      this.selectedUnit() !== 'ALL'
    );
  });

  public selectedTabIndex = computed(() => {
    const step = this.selectedStepFilter();
    switch (step) {
      case 'STEP_1_INFORMAL': return 1;
      case 'STEP_2_FORMAL': return 2;
      case 'STEP_3_MEDIATION': return 3;
      case 'STEP_4_ARBITRATION': return 4;
      case 'SETTLED': return 5;
      default: return 0;
    }
  });

  public filteredGrievances = computed(() => {
    let list = this.grievanceService.grievances();
    const query = this.searchQuery().toLowerCase().trim();
    const stepFilter = this.selectedStepFilter();
    const priority = this.selectedPriority();
    const unit = this.selectedUnit();

    if (query) {
      list = list.filter(g =>
        (g.grievanceNumber && g.grievanceNumber.toLowerCase().includes(query)) ||
        (g.title && g.title.toLowerCase().includes(query)) ||
        (g.description && g.description.toLowerCase().includes(query)) ||
        (g.memberName && g.memberName.toLowerCase().includes(query)) ||
        (g.supervisorName && g.supervisorName.toLowerCase().includes(query)) ||
        (g.assignedStewardName && g.assignedStewardName.toLowerCase().includes(query)) ||
        (g.bargainingUnitName && g.bargainingUnitName.toLowerCase().includes(query)) ||
        (g.violatedArticles && g.violatedArticles.some(a =>
          (a.articleNumber && a.articleNumber.toLowerCase().includes(query)) ||
          (a.title && a.title.toLowerCase().includes(query))
        ))
      );
    }

    if (stepFilter !== 'ALL') {
      if (stepFilter === 'SETTLED') {
        list = list.filter(g =>
          g.currentStep === 'SETTLED' ||
          g.currentStep === 'CLOSED' ||
          g.currentStep === 'WITHDRAWN' ||
          g.status === 'RESOLVED' ||
          g.status === 'CLOSED'
        );
      } else {
        list = list.filter(g => g.currentStep === stepFilter);
      }
    }

    if (priority !== 'ALL') {
      list = list.filter(g => g.priority === priority);
    }

    if (unit !== 'ALL') {
      list = list.filter(g => g.bargainingUnitId === unit);
    }

    return list;
  });

  public allCount = computed(() => this.grievanceService.grievances().length);
  public step1Count = computed(() => this.grievanceService.grievances().filter(g => g.currentStep === 'STEP_1_INFORMAL').length);
  public step2Count = computed(() => this.grievanceService.grievances().filter(g => g.currentStep === 'STEP_2_FORMAL').length);
  public step3Count = computed(() => this.grievanceService.grievances().filter(g => g.currentStep === 'STEP_3_MEDIATION').length);
  public step4Count = computed(() => this.grievanceService.grievances().filter(g => g.currentStep === 'STEP_4_ARBITRATION').length);
  public settledCount = computed(() => this.grievanceService.grievances().filter(g =>
    g.currentStep === 'SETTLED' ||
    g.currentStep === 'CLOSED' ||
    g.currentStep === 'WITHDRAWN' ||
    g.status === 'RESOLVED' ||
    g.status === 'CLOSED'
  ).length);

  ngOnInit(): void {
    this.grievanceService.subscribeToGrievances();
    this.cbaService.loadCBAData();
  }

  public resetFilters(): void {
    this.searchQuery.set('');
    this.selectedStepFilter.set('ALL');
    this.selectedPriority.set('ALL');
    this.selectedUnit.set('ALL');
  }

  public onTabChange(index: number): void {
    const tabMap: Record<number, string> = {
      0: 'ALL',
      1: 'STEP_1_INFORMAL',
      2: 'STEP_2_FORMAL',
      3: 'STEP_3_MEDIATION',
      4: 'STEP_4_ARBITRATION',
      5: 'SETTLED'
    };
    this.selectedStepFilter.set(tabMap[index] || 'ALL');
  }

  public async downloadPdf(grievanceId: string, event: Event): Promise<void> {
    event.stopPropagation();
    try {
      await this.pdfService.downloadGrievancePdf(grievanceId);
    } catch (e) {
      alert('PDF generation failed. Please ensure Firebase Cloud Functions emulator is running.');
    }
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
