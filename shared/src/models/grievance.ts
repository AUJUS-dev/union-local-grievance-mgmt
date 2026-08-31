export type GrievanceStep = 
  | 'STEP_1_INFORMAL'
  | 'STEP_2_FORMAL'
  | 'STEP_3_MEDIATION'
  | 'STEP_4_ARBITRATION'
  | 'SETTLED'
  | 'WITHDRAWN'
  | 'CLOSED';

export type GrievanceStatus = 
  | 'DRAFT'
  | 'SUBMITTED'
  | 'UNDER_INVESTIGATION'
  | 'AWAITING_EMPLOYER_RESPONSE'
  | 'AWAITING_UNION_DECISION'
  | 'HEARING_SCHEDULED'
  | 'RESOLVED'
  | 'CLOSED';

export type GrievancePriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export interface GrievanceTimelineEvent {
  step: GrievanceStep;
  date: string;
  note?: string;
  updatedBy: {
    uid: string;
    name: string;
    role: string;
  };
}

export interface GrievanceDeadlines {
  currentDeadline: string; // ISO 8601 string
  deadlineType: 'EMPLOYER_RESPONSE' | 'UNION_ESCALATION' | 'ARBITRATION_FILING' | 'STEP_1_FILING';
  daysRemaining?: number;
  isOverdue?: boolean;
}

export interface GrievanceAttachment {
  id: string;
  name: string;
  fileUrl: string;
  storagePath: string;
  fileType: string;
  fileSizeBytes: number;
  uploadedBy: {
    uid: string;
    name: string;
  };
  uploadedAt: string;
  category: 'WITNESS_STATEMENT' | 'DISCIPLINE_NOTICE' | 'EMPLOYER_CORRESPONDENCE' | 'PAY_STUB' | 'OTHER';
}

export interface GrievanceActivityLog {
  id: string;
  grievanceId: string;
  action: 'CREATED' | 'STEP_CHANGED' | 'STATUS_CHANGED' | 'STEWARD_ASSIGNED' | 'ATTACHMENT_ADDED' | 'NOTE_ADDED' | 'DEADLINE_EXTENDED' | 'SETTLED';
  description: string;
  performedBy: {
    uid: string;
    name: string;
    role: string;
  };
  metadata?: Record<string, any>;
  timestamp: string;
}

export interface GrievanceNote {
  id: string;
  grievanceId: string;
  authorUid: string;
  authorName: string;
  authorRole: string;
  content: string;
  isConfidentialUnionOnly: boolean; // Stewards/Admins only
  createdAt: string;
}

export interface Grievance {
  id: string;
  grievanceNumber: string; // e.g. "GR-2026-0042"
  title: string;
  description: string;
  incidentDate: string; // ISO 8601 date
  filingDate: string;
  
  // Bargaining unit & member info
  bargainingUnitId: string;
  bargainingUnitName: string;
  employerName: string;
  memberUid: string;
  memberName: string;
  memberId?: string;
  memberDepartment?: string;
  memberJobTitle?: string;
  supervisorName?: string;

  // Steward representation
  assignedStewardUid?: string;
  assignedStewardName?: string;

  // Contract violations & remedy
  contractId: string;
  violatedArticles: Array<{
    articleNumber: string;
    title: string;
    section?: string;
  }>;
  remedyRequested: string;

  // Lifecycle
  currentStep: GrievanceStep;
  status: GrievanceStatus;
  priority: GrievancePriority;
  
  // Deadlines
  deadlines: GrievanceDeadlines;
  timeline: GrievanceTimelineEvent[];

  // Outcome
  settlementDetails?: {
    settlementDate: string;
    terms: string;
    financialRemedyAmount?: number;
    settledBy: string;
  };

  createdAt: string;
  updatedAt: string;
}
