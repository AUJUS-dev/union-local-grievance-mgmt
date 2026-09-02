import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import {
  MatDialogModule,
  MatDialogRef,
  MAT_DIALOG_DATA,
} from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { CBAArticle } from '@union-local/shared';

export interface CBAArticleDialogData {
  article?: CBAArticle;
  isEdit?: boolean;
}

export interface CBAArticleDialogResult {
  article: CBAArticle;
  originalArticleNumber?: string;
}

@Component({
  selector: 'app-cba-article-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
  ],
  templateUrl: './cba-article-dialog.component.html',
  styleUrl: './cba-article-dialog.component.scss',
})
export class CBAArticleDialogComponent implements OnInit {
  private fb = inject(FormBuilder);
  public dialogRef = inject(MatDialogRef<CBAArticleDialogComponent>);
  public data: CBAArticleDialogData = inject(MAT_DIALOG_DATA) || {};

  public readonly categories: CBAArticle['category'][] = [
    'Discipline',
    'Seniority',
    'Wages & Hours',
    'Health & Safety',
    'Overtime',
    'Benefits',
    'General',
  ];

  public articleForm: FormGroup = this.fb.group({
    articleNumber: ['', [Validators.required]],
    title: ['', [Validators.required]],
    section: [''],
    category: ['General', [Validators.required]],
    description: ['', [Validators.required]],
  });

  public isEdit = false;

  ngOnInit(): void {
    this.isEdit = !!this.data.isEdit;
    if (this.data.article) {
      this.articleForm.patchValue({
        articleNumber: this.data.article.articleNumber,
        title: this.data.article.title,
        section: this.data.article.section || '',
        category: this.data.article.category || 'General',
        description: this.data.article.description || '',
      });
    }
  }

  public onSubmit(): void {
    if (this.articleForm.invalid) {
      this.articleForm.markAllAsTouched();
      return;
    }

    const formVal = this.articleForm.value;
    const article: CBAArticle = {
      articleNumber: formVal.articleNumber.trim(),
      title: formVal.title.trim(),
      category: formVal.category,
      description: formVal.description.trim(),
    };

    if (formVal.section && formVal.section.trim()) {
      article.section = formVal.section.trim();
    }

    const result: CBAArticleDialogResult = {
      article,
      originalArticleNumber: this.isEdit
        ? this.data.article?.articleNumber
        : undefined,
    };

    this.dialogRef.close(result);
  }

  public onCancel(): void {
    this.dialogRef.close();
  }
}
