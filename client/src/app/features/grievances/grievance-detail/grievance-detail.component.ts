import { Component, inject, OnInit, OnDestroy, signal, computed, effect, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { GrievanceService } from '../../../core/services/grievance.service';
import { AuthService } from '../../../core/services/auth.service';
import { PdfService } from '../../../core/services/pdf.service';
import { Grievance, GrievanceStep, GrievanceActivityLog, GrievanceNote } from '@union-local/shared';

@Component({
  selector: 'app-grievance-detail',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    FormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatTabsModule,
    MatChipsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatProgressBarModule,
    MatTooltipModule
  ],
  templateUrl: './grievance-detail.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './grievance-detail.component.scss'
})
export class GrievanceDetailComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  public grievanceService = inject(GrievanceService);
  public auth = inject(AuthService);
  private pdfService = inject(PdfService);

  public grievanceId = '';
  public grievance = this.grievanceService.selectedGrievance;
  public activities = signal<GrievanceActivityLog[]>([]);
  public notes = signal<GrievanceNote[]>([]);

  public selectedNextStep = signal<GrievanceStep>('STEP_2_FORMAL');
  public stepTransitionNotes = '';
  public newNoteContent = '';

  public reopenTargetStep = signal<GrievanceStep>('STEP_1_INFORMAL');
  public reopenNotes = '';

  public isCompleted = computed(() => {
    const g = this.grievance();
    if (!g) return false;
    return (
      g.currentStep === 'SETTLED' ||
      g.currentStep === 'CLOSED' ||
      g.currentStep === 'WITHDRAWN' ||
      g.status === 'RESOLVED' ||
      g.status === 'CLOSED'
    );
  });

  constructor() {
    effect(() => {
      const g = this.grievance();
      if (g) {
        if (this.isCompleted()) {
          this.reopenTargetStep.set(this.getPreviousActiveStep(g));
        } else if (g.currentStep) {
          this.selectedNextStep.set(this.getNextStep(g.currentStep));
        }
      }
    });
  }

  public getNextStep(currentStep?: GrievanceStep): GrievanceStep {
    switch (currentStep) {
      case 'STEP_1_INFORMAL':
        return 'STEP_2_FORMAL';
      case 'STEP_2_FORMAL':
        return 'STEP_3_MEDIATION';
      case 'STEP_3_MEDIATION':
        return 'STEP_4_ARBITRATION';
      case 'STEP_4_ARBITRATION':
        return 'SETTLED';
      default:
        return 'SETTLED';
    }
  }

  public getPreviousActiveStep(g: Grievance): GrievanceStep {
    if (g.timeline && g.timeline.length > 0) {
      for (let i = g.timeline.length - 1; i >= 0; i--) {
        const s = g.timeline[i].step;
        if (s !== 'SETTLED' && s !== 'CLOSED' && s !== 'WITHDRAWN') {
          return s;
        }
      }
    }
    return 'STEP_1_INFORMAL';
  }

  async ngOnInit(): Promise<void> {
    this.grievanceId = this.route.snapshot.paramMap.get('id') || '';
    if (this.grievanceId) {
      this.grievanceService.subscribeToGrievanceDetail(this.grievanceId);
      await this.loadActivitiesAndNotes();
    }
  }

  ngOnDestroy(): void {
    this.grievanceService.unsubscribe();
  }

  private async loadActivitiesAndNotes(): Promise<void> {
    const act = await this.grievanceService.getActivities(this.grievanceId);
    this.activities.set(act);

    const n = await this.grievanceService.getNotes(this.grievanceId);
    this.notes.set(n);
  }

  public async escalateStep(): Promise<void> {
    const nextStep = this.selectedNextStep();
    if (!nextStep) return;
    try {
      const notes = this.stepTransitionNotes;
      this.stepTransitionNotes = '';
      await this.grievanceService.escalateStep(this.grievanceId, nextStep, notes);
      await this.loadActivitiesAndNotes();
    } catch (err) {
      console.error('Error transitioning step:', err);
    }
  }

  public async reopenGrievance(): Promise<void> {
    const target = this.reopenTargetStep();
    if (!target) return;
    try {
      const notes = this.reopenNotes;
      this.reopenNotes = '';
      await this.grievanceService.reopenGrievance(this.grievanceId, target, notes);
      await this.loadActivitiesAndNotes();
    } catch (err) {
      console.error('Error re-opening grievance:', err);
    }
  }

  public async assignSteward(stewardUid: string): Promise<void> {
    const name = stewardUid === 'steward-uid-001' ? 'Marcus Brody' : 'Sarah Connor';
    await this.grievanceService.assignSteward(this.grievanceId, stewardUid, name);
    await this.loadActivitiesAndNotes();
  }

  public async addNote(): Promise<void> {
    if (!this.newNoteContent.trim()) return;
    await this.grievanceService.addNote(this.grievanceId, this.newNoteContent, true);
    this.newNoteContent = '';
    const n = await this.grievanceService.getNotes(this.grievanceId);
    this.notes.set(n);
  }

  public async downloadPdf(): Promise<void> {
    try {
      await this.pdfService.downloadGrievancePdf(this.grievanceId);
    } catch (e) {
      alert('PDF generation failed. Please ensure Firebase Cloud Functions emulator is running.');
    }
  }

  public getStepState(step: string): string {
    const g = this.grievance();
    if (!g) return '';
    const stepOrder = ['STEP_1_INFORMAL', 'STEP_2_FORMAL', 'STEP_3_MEDIATION', 'STEP_4_ARBITRATION'];
    const currentIndex = stepOrder.indexOf(g.currentStep);
    const stepIndex = stepOrder.indexOf(step);

    if (g.currentStep === 'SETTLED' || stepIndex < currentIndex) {
      return 'completed';
    } else if (stepIndex === currentIndex) {
      return 'active';
    }
    return '';
  }

  public getConnectorState(nextStep: string): string {
    const g = this.grievance();
    if (!g) return '';
    const stepOrder = ['STEP_1_INFORMAL', 'STEP_2_FORMAL', 'STEP_3_MEDIATION', 'STEP_4_ARBITRATION'];
    const currentIndex = stepOrder.indexOf(g.currentStep);
    const targetIndex = stepOrder.indexOf(nextStep);

    if (g.currentStep === 'SETTLED' || targetIndex <= currentIndex) {
      return 'completed';
    }
    return '';
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
