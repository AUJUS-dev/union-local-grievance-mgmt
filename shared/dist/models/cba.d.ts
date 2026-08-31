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
    step1Days: number;
    step2EmployerResponseDays: number;
    step2UnionEscalationDays: number;
    step3EmployerResponseDays: number;
    arbitrationFilingDays: number;
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
