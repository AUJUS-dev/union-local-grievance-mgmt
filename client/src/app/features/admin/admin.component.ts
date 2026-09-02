import {
  Component,
  inject,
  OnInit,
  signal,
  computed,
  effect,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatTabsModule } from '@angular/material/tabs';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDividerModule } from '@angular/material/divider';
import { collection, getDocs, doc, updateDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { FirebaseService } from '../../core/services/firebase.service';
import { CBAService } from '../../core/services/cba.service';
import {
  UserProfile,
  UserRole,
  CBAArticle,
  StepDeadlineConfig,
} from '@union-local/shared';
import {
  CBAArticleDialogComponent,
  CBAArticleDialogResult,
} from './cba-article-dialog/cba-article-dialog.component';

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatCardModule,
    MatTableModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatTabsModule,
    MatProgressBarModule,
    MatFormFieldModule,
    MatInputModule,
    MatDialogModule,
    MatSnackBarModule,
    MatTooltipModule,
    MatDividerModule,
  ],
  templateUrl: './admin.component.html',
  styleUrl: './admin.component.scss',
})
export class AdminComponent implements OnInit {
  private fb = inject(FormBuilder);
  private firebase = inject(FirebaseService);
  public cbaService = inject(CBAService);
  private dialog = inject(MatDialog);
  private snackBar = inject(MatSnackBar);

  public userColumns: string[] = ['name', 'info', 'role', 'actions'];
  public users = signal<UserProfile[]>([]);
  public isLoading = signal(false);
  public isSavingDeadlines = signal(false);

  // Article filters
  public articleSearchQuery = signal<string>('');
  public selectedCategoryFilter = signal<string>('ALL');

  public readonly categories: CBAArticle['category'][] = [
    'Discipline',
    'Seniority',
    'Wages & Hours',
    'Health & Safety',
    'Overtime',
    'Benefits',
    'General',
  ];

  public deadlinesForm: FormGroup = this.fb.group({
    step1Days: [
      10,
      [Validators.required, Validators.min(1), Validators.max(365)],
    ],
    step2EmployerResponseDays: [
      5,
      [Validators.required, Validators.min(1), Validators.max(365)],
    ],
    step2UnionEscalationDays: [
      10,
      [Validators.required, Validators.min(1), Validators.max(365)],
    ],
    step3EmployerResponseDays: [
      15,
      [Validators.required, Validators.min(1), Validators.max(365)],
    ],
    arbitrationFilingDays: [
      30,
      [Validators.required, Validators.min(1), Validators.max(365)],
    ],
  });

  public filteredArticles = computed(() => {
    let list = this.cbaService.articles();
    const query = this.articleSearchQuery().toLowerCase().trim();
    const cat = this.selectedCategoryFilter();

    if (cat !== 'ALL') {
      list = list.filter((a) => a.category === cat);
    }

    if (query) {
      list = list.filter(
        (a) =>
          (a.articleNumber && a.articleNumber.toLowerCase().includes(query)) ||
          (a.title && a.title.toLowerCase().includes(query)) ||
          (a.section && a.section.toLowerCase().includes(query)) ||
          (a.description && a.description.toLowerCase().includes(query)),
      );
    }

    return list;
  });

  constructor() {
    effect(() => {
      const contract = this.cbaService.selectedContract();
      if (contract?.deadlines) {
        this.deadlinesForm.patchValue(
          {
            step1Days: contract.deadlines.step1Days ?? 10,
            step2EmployerResponseDays:
              contract.deadlines.step2EmployerResponseDays ?? 5,
            step2UnionEscalationDays:
              contract.deadlines.step2UnionEscalationDays ?? 10,
            step3EmployerResponseDays:
              contract.deadlines.step3EmployerResponseDays ?? 15,
            arbitrationFilingDays:
              contract.deadlines.arbitrationFilingDays ?? 30,
          },
          { emitEvent: false },
        );
      }
    });
  }

  async ngOnInit(): Promise<void> {
    await Promise.all([this.loadUsers(), this.cbaService.loadCBAData()]);
    this.syncDeadlinesForm();
  }

  public syncDeadlinesForm(): void {
    const contract = this.cbaService.selectedContract();
    if (contract?.deadlines) {
      this.deadlinesForm.patchValue({
        step1Days: contract.deadlines.step1Days ?? 10,
        step2EmployerResponseDays:
          contract.deadlines.step2EmployerResponseDays ?? 5,
        step2UnionEscalationDays:
          contract.deadlines.step2UnionEscalationDays ?? 10,
        step3EmployerResponseDays:
          contract.deadlines.step3EmployerResponseDays ?? 15,
        arbitrationFilingDays: contract.deadlines.arbitrationFilingDays ?? 30,
      });
    }
  }

  public onContractSelect(contractId: string): void {
    this.cbaService.setSelectedContract(contractId);
    this.syncDeadlinesForm();
  }

  public async saveDeadlines(): Promise<void> {
    if (this.deadlinesForm.invalid) {
      this.deadlinesForm.markAllAsTouched();
      return;
    }

    const contract = this.cbaService.selectedContract();
    if (!contract) {
      this.snackBar.open('No active CBA contract found.', 'Dismiss', {
        duration: 4000,
      });
      return;
    }

    this.isSavingDeadlines.set(true);
    try {
      const updatedDeadlines: StepDeadlineConfig = {
        step1Days: Number(this.deadlinesForm.value.step1Days),
        step2EmployerResponseDays: Number(
          this.deadlinesForm.value.step2EmployerResponseDays,
        ),
        step2UnionEscalationDays: Number(
          this.deadlinesForm.value.step2UnionEscalationDays,
        ),
        step3EmployerResponseDays: Number(
          this.deadlinesForm.value.step3EmployerResponseDays,
        ),
        arbitrationFilingDays: Number(
          this.deadlinesForm.value.arbitrationFilingDays,
        ),
      };

      await this.cbaService.updateDeadlines(contract.id, updatedDeadlines);
      this.snackBar.open(
        'Contractual deadlines updated successfully!',
        'Close',
        {
          duration: 3500,
        },
      );
    } catch (err: any) {
      console.error('Error saving contractual deadlines:', err);
      this.snackBar.open(
        `Failed to update deadlines: ${err?.message || err}`,
        'Close',
        { duration: 5000 },
      );
    } finally {
      this.isSavingDeadlines.set(false);
    }
  }

  public resetDeadlines(): void {
    this.syncDeadlinesForm();
    this.snackBar.open(
      'Deadline values reset to current contract settings.',
      'Close',
      { duration: 2500 },
    );
  }

  public openAddArticleDialog(): void {
    const dialogRef = this.dialog.open(CBAArticleDialogComponent, {
      width: '560px',
      data: { isEdit: false },
    });

    dialogRef
      .afterClosed()
      .subscribe(async (result: CBAArticleDialogResult | undefined) => {
        if (result?.article) {
          await this.handleSaveArticle(result.article);
        }
      });
  }

  public openEditArticleDialog(article: CBAArticle): void {
    const dialogRef = this.dialog.open(CBAArticleDialogComponent, {
      width: '560px',
      data: { article, isEdit: true },
    });

    dialogRef
      .afterClosed()
      .subscribe(async (result: CBAArticleDialogResult | undefined) => {
        if (result?.article) {
          await this.handleSaveArticle(
            result.article,
            result.originalArticleNumber,
          );
        }
      });
  }

  private async handleSaveArticle(
    article: CBAArticle,
    originalArticleNumber?: string,
  ): Promise<void> {
    const contract = this.cbaService.selectedContract();
    if (!contract) return;

    this.isLoading.set(true);
    try {
      await this.cbaService.saveArticle(
        contract.id,
        article,
        originalArticleNumber,
      );
      this.snackBar.open(
        originalArticleNumber
          ? `Updated ${article.articleNumber} successfully!`
          : `Added ${article.articleNumber} successfully!`,
        'Close',
        { duration: 3500 },
      );
    } catch (err: any) {
      console.error('Error saving article:', err);
      this.snackBar.open(
        `Failed to save article: ${err?.message || err}`,
        'Close',
        { duration: 5000 },
      );
    } finally {
      this.isLoading.set(false);
    }
  }

  public async deleteArticle(article: CBAArticle): Promise<void> {
    const confirmed = confirm(
      `Are you sure you want to remove "${article.articleNumber}: ${article.title}" from the active CBA contract?`,
    );
    if (!confirmed) return;

    const contract = this.cbaService.selectedContract();
    if (!contract) return;

    this.isLoading.set(true);
    try {
      await this.cbaService.deleteArticle(contract.id, article.articleNumber);
      this.snackBar.open(
        `Removed ${article.articleNumber} from contract.`,
        'Close',
        { duration: 3500 },
      );
    } catch (err: any) {
      console.error('Error deleting article:', err);
      this.snackBar.open(
        `Failed to delete article: ${err?.message || err}`,
        'Close',
        { duration: 5000 },
      );
    } finally {
      this.isLoading.set(false);
    }
  }

  public getCategoryClass(category: string): string {
    switch (category) {
      case 'Discipline':
        return 'badge-danger';
      case 'Health & Safety':
        return 'badge-warning';
      case 'Overtime':
        return 'badge-purple';
      case 'Wages & Hours':
        return 'badge-success';
      case 'Seniority':
        return 'badge-primary';
      case 'Benefits':
        return 'badge-info';
      default:
        return 'badge-neutral';
    }
  }

  public getCategoryCount(cat: string): number {
    if (cat === 'ALL') return this.cbaService.articles().length;
    return this.cbaService.articles().filter((a) => a.category === cat).length;
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
        const setUserRoleCallable = httpsCallable(
          this.firebase.functions,
          'setUserRole',
        );
        await setUserRoleCallable({ targetUid: uid, role });
      } catch {
        // Fallback to direct Firestore update
        await updateDoc(doc(this.firebase.firestore, 'users', uid), {
          role,
          updatedAt: new Date().toISOString(),
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
      case 'business_agent':
        return 'Business Agent';
      case 'chief_steward':
        return 'Chief Steward';
      case 'steward':
        return 'Shop Steward';
      case 'admin':
        return 'Union Admin';
      case 'member':
        return 'Member';
      default:
        return role?.replace(/_/g, ' ') || 'Member';
    }
  }
}
