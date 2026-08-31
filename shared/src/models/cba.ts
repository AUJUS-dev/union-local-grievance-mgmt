export interface BargainingUnit {
  id: string;
  name: string;
  employerName: string;
  location: string;
  contractId: string;
}

export interface CBAArticle {
  articleNumber: string;
  title: string;
  section?: string;
  description: string;
  category: 'Discipline' | 'Seniority' | 'Wages & Hours' | 'Health & Safety' | 'Overtime' | 'Benefits' | 'General';
}

export interface StepDeadlineConfig {
  step1Days: number; // e.g. 10 business days from incident
  step2EmployerResponseDays: number; // e.g. 5 business days
  step2UnionEscalationDays: number; // e.g. 10 business days
  step3EmployerResponseDays: number; // e.g. 15 business days
  arbitrationFilingDays: number; // e.g. 30 business days
}

export interface CBAContract {
  id: string;
  localNumber: string;
  employerName: string;
  title: string;
  effectiveDate: string;
  expirationDate: string;
  articles: CBAArticle[];
  deadlines: StepDeadlineConfig;
}
