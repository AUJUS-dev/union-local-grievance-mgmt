import { Injectable, signal, inject } from '@angular/core';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  addDoc,
  Unsubscribe
} from 'firebase/firestore';
import { FirebaseService } from './firebase.service';
import { AuthService } from './auth.service';
import {
  Grievance,
  GrievanceStep,
  GrievanceStatus,
  GrievanceActivityLog,
  GrievanceNote,
  GrievancePriority
} from '@union-local/shared';

@Injectable({
  providedIn: 'root'
})
export class GrievanceService {
  private firebase = inject(FirebaseService);
  private auth = inject(AuthService);

  public readonly grievances = signal<Grievance[]>([]);
  public readonly isLoading = signal<boolean>(false);
  public readonly selectedGrievance = signal<Grievance | null>(null);

  private grievancesUnsubscribe: Unsubscribe | null = null;
  private currentDocUnsubscribe: Unsubscribe | null = null;

  public subscribeToGrievances(): void {
    const role = this.auth.userRole();
    const user = this.auth.currentUser();

    if (this.grievancesUnsubscribe) {
      this.grievancesUnsubscribe();
    }

    this.isLoading.set(true);
    const grievancesRef = collection(this.firebase.firestore, 'grievances');

    let q;
    // Members only see their own grievances; Stewards & Admins see all
    if (role === 'member' && user) {
      q = query(grievancesRef, where('memberUid', '==', user.uid), orderBy('createdAt', 'desc'));
    } else {
      q = query(grievancesRef, orderBy('createdAt', 'desc'));
    }

    this.grievancesUnsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list: Grievance[] = [];
        snapshot.forEach((d) => list.push({ ...(d.data() as Grievance), id: d.id }));
        this.grievances.set(list);
        this.isLoading.set(false);
      },
      (err) => {
        console.error('Error streaming grievances:', err);
        this.isLoading.set(false);
      }
    );
  }

  public subscribeToGrievanceDetail(id: string): void {
    if (this.currentDocUnsubscribe) {
      this.currentDocUnsubscribe();
    }

    const docRef = doc(this.firebase.firestore, 'grievances', id);
    this.currentDocUnsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        this.selectedGrievance.set({ ...(docSnap.data() as Grievance), id: docSnap.id });
      } else {
        this.selectedGrievance.set(null);
      }
    });
  }

  public async getGrievanceById(id: string): Promise<Grievance | null> {
    const docRef = doc(this.firebase.firestore, 'grievances', id);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const data = { ...(snap.data() as Grievance), id: snap.id };
      this.selectedGrievance.set(data);
      return data;
    }
    return null;
  }

  public async createGrievance(data: Partial<Grievance>): Promise<string> {
    const user = this.auth.currentUser();
    const profile = this.auth.userProfile();
    const now = new Date();
    
    // Generate random grievance number e.g. GR-2026-1042
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    const grievanceNumber = `GR-${now.getFullYear()}-${randomNum}`;
    const grievanceId = doc(collection(this.firebase.firestore, 'grievances')).id;

    // Default 10 days for initial step response
    const deadlineDate = new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000).toISOString();

    const newGrievance: Record<string, any> = {
      id: grievanceId,
      grievanceNumber,
      title: data.title || 'Untitled Grievance',
      description: data.description || '',
      incidentDate: data.incidentDate || now.toISOString(),
      filingDate: now.toISOString(),
      bargainingUnitId: data.bargainingUnitId || profile?.bargainingUnitId || 'unit-main-mfg',
      bargainingUnitName: data.bargainingUnitName || 'Main Manufacturing Plant',
      employerName: data.employerName || 'Acme Heavy Industries',
      memberUid: user?.uid || '',
      memberName: profile?.displayName || user?.displayName || 'Union Member',
      memberDepartment: data.memberDepartment || 'Operations',
      supervisorName: data.supervisorName || 'Supervisor',
      contractId: data.contractId || 'cba-local-1118',
      violatedArticles: (data.violatedArticles || []).map((a) => {
        const art: Record<string, any> = {
          articleNumber: a.articleNumber,
          title: a.title
        };
        if (a.section) art['section'] = a.section;
        return art;
      }),
      remedyRequested: data.remedyRequested || 'Make the grievant whole in every respect.',
      currentStep: 'STEP_1_INFORMAL',
      status: 'SUBMITTED',
      priority: (data.priority as GrievancePriority) || 'MEDIUM',
      deadlines: {
        currentDeadline: deadlineDate,
        deadlineType: 'EMPLOYER_RESPONSE',
        daysRemaining: 10,
        isOverdue: false
      },
      timeline: [
        {
          step: 'STEP_1_INFORMAL',
          date: now.toISOString(),
          note: 'Grievance submitted by grievant/steward.',
          updatedBy: {
            uid: user?.uid || 'unknown',
            name: profile?.displayName || user?.displayName || 'Union Member',
            role: this.auth.userRole() || 'member'
          }
        }
      ],
      createdAt: now.toISOString(),
      updatedAt: now.toISOString()
    };

    if (profile?.memberId || data.memberId) {
      newGrievance['memberId'] = profile?.memberId || data.memberId;
    }
    if (data.memberJobTitle) {
      newGrievance['memberJobTitle'] = data.memberJobTitle;
    }
    if (data.assignedStewardUid) {
      newGrievance['assignedStewardUid'] = data.assignedStewardUid;
    }
    if (data.assignedStewardName) {
      newGrievance['assignedStewardName'] = data.assignedStewardName;
    }

    await setDoc(doc(this.firebase.firestore, 'grievances', grievanceId), newGrievance);
    return grievanceId;
  }

  public async escalateStep(grievanceId: string, nextStep: GrievanceStep, noteText?: string): Promise<void> {
    const user = this.auth.currentUser();
    const profile = this.auth.userProfile();
    const now = new Date();

    const g = await this.getGrievanceById(grievanceId);
    if (!g) throw new Error('Grievance not found');

    const previousStep = g.currentStep;
    const authorName = profile?.displayName || user?.displayName || 'Union Steward';
    const authorRole = this.auth.userRole() || 'steward';
    const trimmedNotes = noteText?.trim() || '';

    // 1. If step transition notes were provided, log them under Notes & Statements
    if (trimmedNotes) {
      const formattedNote = `[Step Transition: ${this.formatStep(previousStep)} → ${this.formatStep(nextStep)}]\n${trimmedNotes}`;
      await this.addNote(grievanceId, formattedNote, true);
    }

    // 2. Log step transition execution in Audit Trail
    const transitionDesc = trimmedNotes
      ? `Grievance transitioned from ${this.formatStep(previousStep)} to ${this.formatStep(nextStep)}. Transition Note: "${trimmedNotes}"`
      : `Grievance transitioned from ${this.formatStep(previousStep)} to ${this.formatStep(nextStep)}.`;

    await this.addActivity(grievanceId, {
      grievanceId,
      action: 'STEP_CHANGED',
      description: transitionDesc,
      performedBy: {
        uid: user?.uid || '',
        name: authorName,
        role: authorRole
      },
      metadata: {
        previousStep,
        newStep: nextStep,
        transitionNotes: trimmedNotes
      },
      timestamp: now.toISOString()
    });

    // 3. Calculate deadline based on step
    let daysToAdd = 5;
    let deadlineType: 'EMPLOYER_RESPONSE' | 'UNION_ESCALATION' | 'ARBITRATION_FILING' = 'EMPLOYER_RESPONSE';

    if (nextStep === 'STEP_2_FORMAL') {
      daysToAdd = 5;
      deadlineType = 'EMPLOYER_RESPONSE';
    } else if (nextStep === 'STEP_3_MEDIATION') {
      daysToAdd = 15;
      deadlineType = 'EMPLOYER_RESPONSE';
    } else if (nextStep === 'STEP_4_ARBITRATION') {
      daysToAdd = 30;
      deadlineType = 'ARBITRATION_FILING';
    }

    const newDeadline = new Date(now.getTime() + daysToAdd * 24 * 60 * 60 * 1000).toISOString();

    const newTimelineEvent = {
      step: nextStep,
      date: now.toISOString(),
      note: trimmedNotes || `Escalated to ${this.formatStep(nextStep)}`,
      updatedBy: {
        uid: user?.uid || '',
        name: authorName,
        role: authorRole
      }
    };

    const updatePayload: Partial<Grievance> = {
      currentStep: nextStep,
      status: nextStep === 'SETTLED' ? 'RESOLVED' : nextStep === 'CLOSED' ? 'CLOSED' : 'UNDER_INVESTIGATION',
      deadlines: {
        currentDeadline: newDeadline,
        deadlineType,
        daysRemaining: daysToAdd,
        isOverdue: false
      },
      timeline: [...(g.timeline || []), newTimelineEvent],
      updatedAt: now.toISOString()
    };

    await updateDoc(doc(this.firebase.firestore, 'grievances', grievanceId), updatePayload);
  }

  public async reopenGrievance(grievanceId: string, targetStep: GrievanceStep, reasonNotes?: string): Promise<void> {
    const user = this.auth.currentUser();
    const profile = this.auth.userProfile();
    const now = new Date();

    const g = await this.getGrievanceById(grievanceId);
    if (!g) throw new Error('Grievance not found');

    const previousStep = g.currentStep;
    const authorName = profile?.displayName || user?.displayName || 'Union Steward';
    const authorRole = this.auth.userRole() || 'steward';
    const trimmedNotes = reasonNotes?.trim() || '';

    // 1. Calculate active deadline for re-opened step
    let daysToAdd = 5;
    let deadlineType: 'EMPLOYER_RESPONSE' | 'UNION_ESCALATION' | 'ARBITRATION_FILING' = 'EMPLOYER_RESPONSE';

    if (targetStep === 'STEP_2_FORMAL') {
      daysToAdd = 5;
      deadlineType = 'EMPLOYER_RESPONSE';
    } else if (targetStep === 'STEP_3_MEDIATION') {
      daysToAdd = 15;
      deadlineType = 'EMPLOYER_RESPONSE';
    } else if (targetStep === 'STEP_4_ARBITRATION') {
      daysToAdd = 30;
      deadlineType = 'ARBITRATION_FILING';
    }

    const newDeadline = new Date(now.getTime() + daysToAdd * 24 * 60 * 60 * 1000).toISOString();

    // 2. Log under Notes & Statements
    const formattedNote = trimmedNotes
      ? `[Re-opened Case: Restored from ${this.formatStep(previousStep)} to ${this.formatStep(targetStep)}]\nReason: ${trimmedNotes}`
      : `[Re-opened Case: Restored from ${this.formatStep(previousStep)} to ${this.formatStep(targetStep)}]`;
    await this.addNote(grievanceId, formattedNote, true);

    // 3. Log in Audit Trail
    const activityDesc = trimmedNotes
      ? `Grievance re-opened and restored from ${this.formatStep(previousStep)} to ${this.formatStep(targetStep)}. Reason: "${trimmedNotes}"`
      : `Grievance re-opened and restored from ${this.formatStep(previousStep)} to ${this.formatStep(targetStep)}.`;

    await this.addActivity(grievanceId, {
      grievanceId,
      action: 'STEP_CHANGED',
      description: activityDesc,
      performedBy: {
        uid: user?.uid || '',
        name: authorName,
        role: authorRole
      },
      metadata: {
        actionType: 'REOPEN',
        previousStep,
        newStep: targetStep,
        reason: trimmedNotes
      },
      timestamp: now.toISOString()
    });

    // 4. Create timeline event
    const newTimelineEvent = {
      step: targetStep,
      date: now.toISOString(),
      note: trimmedNotes || `Grievance re-opened to ${this.formatStep(targetStep)}`,
      updatedBy: {
        uid: user?.uid || '',
        name: authorName,
        role: authorRole
      }
    };

    // 5. Update Grievance in Firestore
    const updatePayload: Partial<Grievance> = {
      currentStep: targetStep,
      status: 'UNDER_INVESTIGATION',
      deadlines: {
        currentDeadline: newDeadline,
        deadlineType,
        daysRemaining: daysToAdd,
        isOverdue: false
      },
      timeline: [...(g.timeline || []), newTimelineEvent],
      updatedAt: now.toISOString()
    };

    await updateDoc(doc(this.firebase.firestore, 'grievances', grievanceId), updatePayload);
  }

  public async updateStatus(grievanceId: string, status: GrievanceStatus): Promise<void> {
    const user = this.auth.currentUser();
    const profile = this.auth.userProfile();
    const now = new Date();

    await updateDoc(doc(this.firebase.firestore, 'grievances', grievanceId), {
      status,
      updatedAt: now.toISOString()
    });

    await this.addActivity(grievanceId, {
      grievanceId,
      action: 'STATUS_CHANGED',
      description: `Grievance status changed to ${status.replace(/_/g, ' ')}.`,
      performedBy: {
        uid: user?.uid || '',
        name: profile?.displayName || user?.displayName || 'Union Officer',
        role: this.auth.userRole() || 'steward'
      },
      metadata: { status },
      timestamp: now.toISOString()
    });
  }

  public async assignSteward(grievanceId: string, stewardUid: string, stewardName: string): Promise<void> {
    const user = this.auth.currentUser();
    const profile = this.auth.userProfile();
    const now = new Date();

    await updateDoc(doc(this.firebase.firestore, 'grievances', grievanceId), {
      assignedStewardUid: stewardUid,
      assignedStewardName: stewardName,
      updatedAt: now.toISOString()
    });

    await this.addActivity(grievanceId, {
      grievanceId,
      action: 'STEWARD_ASSIGNED',
      description: `Assigned Steward updated to ${stewardName}.`,
      performedBy: {
        uid: user?.uid || '',
        name: profile?.displayName || user?.displayName || 'Union Officer',
        role: this.auth.userRole() || 'steward'
      },
      metadata: { stewardUid, stewardName },
      timestamp: now.toISOString()
    });
  }

  public async addNote(grievanceId: string, content: string, isConfidential = true): Promise<void> {
    const user = this.auth.currentUser();
    const profile = this.auth.userProfile();
    const now = new Date();
    const note: GrievanceNote = {
      id: '',
      grievanceId,
      authorUid: user?.uid || '',
      authorName: profile?.displayName || user?.displayName || 'Union Steward',
      authorRole: this.auth.userRole() || 'steward',
      content,
      isConfidentialUnionOnly: isConfidential,
      createdAt: now.toISOString()
    };

    const notesRef = collection(this.firebase.firestore, 'grievances', grievanceId, 'notes');
    const docRef = await addDoc(notesRef, note);
    await updateDoc(docRef, { id: docRef.id });
  }

  public async addActivity(grievanceId: string, activity: Omit<GrievanceActivityLog, 'id'>): Promise<void> {
    const actRef = collection(this.firebase.firestore, 'grievances', grievanceId, 'activities');
    const docRef = await addDoc(actRef, { ...activity, id: '' });
    await updateDoc(docRef, { id: docRef.id });
  }

  public async getActivities(grievanceId: string): Promise<GrievanceActivityLog[]> {
    const actRef = collection(this.firebase.firestore, 'grievances', grievanceId, 'activities');
    const q = query(actRef, orderBy('timestamp', 'desc'));
    const snap = await getDocs(q);
    const logs: GrievanceActivityLog[] = [];
    snap.forEach((d) => logs.push({ ...(d.data() as GrievanceActivityLog), id: d.id }));
    return logs;
  }

  public async getNotes(grievanceId: string): Promise<GrievanceNote[]> {
    const notesRef = collection(this.firebase.firestore, 'grievances', grievanceId, 'notes');
    const q = query(notesRef, orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    const notes: GrievanceNote[] = [];
    snap.forEach((d) => notes.push({ ...(d.data() as GrievanceNote), id: d.id }));
    return notes;
  }

  public formatStep(step?: string): string {
    return step ? step.replace(/_/g, ' ') : '';
  }

  public unsubscribe(): void {
    if (this.grievancesUnsubscribe) this.grievancesUnsubscribe();
    if (this.currentDocUnsubscribe) this.currentDocUnsubscribe();
  }
}
