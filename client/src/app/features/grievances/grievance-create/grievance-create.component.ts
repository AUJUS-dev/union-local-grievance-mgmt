import { Component, inject, OnInit, signal, ChangeDetectionStrategy } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { BreakpointObserver } from '@angular/cdk/layout';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import {
  MatStepperModule,
  StepperOrientation,
} from '@angular/material/stepper';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatRadioModule } from '@angular/material/radio';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatTimepickerModule } from '@angular/material/timepicker';
import { map } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import { GrievanceService } from '../../../core/services/grievance.service';
import { CBAService } from '../../../core/services/cba.service';
import { CBAArticle, Grievance } from '@union-local/shared';

@Component({
  selector: 'app-grievance-create',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterModule,
    MatCardModule,
    MatStepperModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatCheckboxModule,
    MatRadioModule,
    MatProgressBarModule,
    MatDatepickerModule,
    MatTimepickerModule,
  ],
  templateUrl: './grievance-create.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './grievance-create.component.scss',
})
export class GrievanceCreateComponent implements OnInit {
  private fb = inject(FormBuilder);
  private auth = inject(AuthService);
  private grievanceService = inject(GrievanceService);
  private cbaService = inject(CBAService);
  private router = inject(Router);
  private breakpointObserver = inject(BreakpointObserver);

  public readonly stepperOrientation = toSignal(
    this.breakpointObserver
      .observe('(max-width: 800px)')
      .pipe(
        map(
          ({ matches }) =>
            (matches ? 'vertical' : 'horizontal') as StepperOrientation,
        ),
      ),
    { initialValue: 'horizontal' as StepperOrientation },
  );

  public isSubmitting = signal(false);
  public selectedArticles: CBAArticle[] = [];

  public availableArticles: CBAArticle[] = [
    {
      articleNumber: 'Article 8',
      title: 'Discipline and Discharge',
      section: 'Section 8.2 (Just Cause Standard)',
      category: 'Discipline',
      description:
        'No employee shall be disciplined or discharged without just cause.',
    },
    {
      articleNumber: 'Article 14',
      title: 'Overtime Allocation & Premium Pay',
      section: 'Section 14.4 (Equalization Rotation)',
      category: 'Overtime',
      description:
        'Equitable distribution of overtime by seniority and classification.',
    },
    {
      articleNumber: 'Article 19',
      title: 'Health and Safety Standards',
      section: 'Section 19.1 (PPE and Hazard Abatement)',
      category: 'Health & Safety',
      description:
        'Employer must provide required PPE and maintain safe conditions.',
    },
    {
      articleNumber: 'Article 22',
      title: 'Seniority and Job Bidding',
      section: 'Section 22.3 (Shift Selection)',
      category: 'Seniority',
      description:
        'Preference for vacant shifts and job postings granted by seniority.',
    },
  ];

  public partiesForm: FormGroup = this.fb.group({
    memberName: ['', Validators.required],
    memberId: ['MEM-8842'],
    bargainingUnitId: ['unit-main-mfg', Validators.required],
    employerName: ['Acme Heavy Industries', Validators.required],
    memberDepartment: ['Operations'],
    supervisorName: ['', Validators.required],
  });

  public incidentForm: FormGroup = this.fb.group({
    priority: ['MEDIUM', Validators.required],
  });

  private getDefaultNoonTime(): Date {
    const noon = new Date();
    noon.setHours(12, 0, 0, 0);
    return noon;
  }

  public statementForm: FormGroup = this.fb.group({
    title: ['', Validators.required],
    incidentDate: [new Date(), Validators.required],
    incidentTime: [this.getDefaultNoonTime()],
    description: ['', Validators.required],
    remedyRequested: [
      'Make the grievant whole in every respect, including all lost wages and benefits.',
      Validators.required,
    ],
  });

  async ngOnInit(): Promise<void> {
    const profile = this.auth.userProfile();
    if (profile) {
      this.partiesForm.patchValue({
        memberName: profile.displayName,
        memberId: profile.memberId || 'MEM-8842',
        bargainingUnitId: profile.bargainingUnitId || 'unit-main-mfg',
      });
    }

    await this.cbaService.loadCBAData();
    const cbaArticles = this.cbaService.articles();
    if (cbaArticles && cbaArticles.length > 0) {
      this.availableArticles = cbaArticles;
    }
  }

  public isArticleSelected(art: CBAArticle): boolean {
    return this.selectedArticles.some(
      (a) => a.articleNumber === art.articleNumber,
    );
  }

  public toggleArticle(art: CBAArticle, isChecked: boolean): void {
    if (isChecked) {
      if (!this.isArticleSelected(art)) {
        this.selectedArticles.push(art);
      }
    } else {
      this.selectedArticles = this.selectedArticles.filter(
        (a) => a.articleNumber !== art.articleNumber,
      );
    }
  }

  public async submitGrievance(): Promise<void> {
    this.isSubmitting.set(true);
    try {
      const parties = this.partiesForm.value;
      const incident = this.incidentForm.value;
      const statement = this.statementForm.value;

      let incidentDateISO: string;
      const rawDate = statement.incidentDate || incident.incidentDate;
      const dateObj =
        rawDate instanceof Date
          ? new Date(rawDate)
          : typeof rawDate === 'string' && rawDate
            ? new Date(rawDate)
            : new Date();

      if (statement.incidentTime instanceof Date) {
        dateObj.setHours(
          statement.incidentTime.getHours(),
          statement.incidentTime.getMinutes(),
          0,
          0,
        );
      } else if (
        typeof statement.incidentTime === 'string' &&
        statement.incidentTime
      ) {
        const timeMatch = statement.incidentTime.match(/(\d+):(\d+)/);
        if (timeMatch) {
          dateObj.setHours(
            parseInt(timeMatch[1], 10),
            parseInt(timeMatch[2], 10),
            0,
            0,
          );
        }
      }

      incidentDateISO = isNaN(dateObj.getTime())
        ? new Date().toISOString()
        : dateObj.toISOString();

      const grievancePayload: Partial<Grievance> = {
        title: statement.title,
        description: statement.description,
        incidentDate: incidentDateISO,
        bargainingUnitId: parties.bargainingUnitId,
        bargainingUnitName:
          parties.bargainingUnitId === 'unit-main-mfg'
            ? 'Main Manufacturing Plant'
            : 'Regional Logistics Center',
        employerName: parties.employerName,
        memberName: parties.memberName,
        memberId: parties.memberId,
        memberDepartment: parties.memberDepartment,
        supervisorName: parties.supervisorName,
        violatedArticles: this.selectedArticles.map((a) => ({
          articleNumber: a.articleNumber,
          title: a.title,
          section: a.section,
        })),
        remedyRequested: statement.remedyRequested,
        priority: incident.priority,
      };

      const newId =
        await this.grievanceService.createGrievance(grievancePayload);
      await this.router.navigate(['/grievances', newId]);
    } catch (err: any) {
      console.error('Error filing grievance:', err);
      alert(`Failed to file grievance: ${err?.message || err}`);
    } finally {
      this.isSubmitting.set(false);
    }
  }
}
