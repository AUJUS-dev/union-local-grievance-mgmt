import * as admin from 'firebase-admin';
import { CBAContract, BargainingUnit, Grievance, UserProfile } from '@union-local/shared';

// If emulator host is not set, default to localhost
process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST || '127.0.0.1:9099';

if (!admin.apps.length) {
  admin.initializeApp({
    projectId: 'demo-union-local'
  });
}

const auth = admin.auth();
const db = admin.firestore();
db.settings({ ignoreUndefinedProperties: true });

async function seed() {
  console.log('🌱 Starting Firebase Local Emulator Seeder for Union Local Grievance Mgmt...');

  // 1. Create Demo Users in Auth and Firestore
  const usersToSeed = [
    {
      uid: 'admin-uid-001',
      email: 'admin@unionlocal.org',
      password: 'password123',
      displayName: 'Sarah Connor (Admin)',
      role: 'admin' as const,
      localNumber: 'Local 1118'
    },
    {
      uid: 'steward-uid-001',
      email: 'steward@unionlocal.org',
      password: 'password123',
      displayName: 'Marcus Brody (Chief Steward)',
      role: 'steward' as const,
      localNumber: 'Local 1118',
      stewardUnits: ['unit-main-mfg', 'unit-logistics']
    },
    {
      uid: 'member-uid-001',
      email: 'member@unionlocal.org',
      password: 'password123',
      displayName: 'Elena Rodriguez (Member)',
      role: 'member' as const,
      localNumber: 'Local 1118',
      memberId: 'MEM-8842',
      bargainingUnitId: 'unit-main-mfg'
    }
  ];

  for (const u of usersToSeed) {
    try {
      try {
        await auth.deleteUser(u.uid);
      } catch (e) {
        // Ignore if user didn't exist
      }

      await auth.createUser({
        uid: u.uid,
        email: u.email,
        password: u.password,
        displayName: u.displayName
      });

      await auth.setCustomUserClaims(u.uid, {
        role: u.role,
        localNumber: u.localNumber,
        stewardUnits: (u as any).stewardUnits || []
      });

      const profile: Record<string, any> = {
        uid: u.uid,
        email: u.email,
        displayName: u.displayName,
        role: u.role,
        localNumber: u.localNumber,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      if ((u as any).memberId) profile['memberId'] = (u as any).memberId;
      if ((u as any).stewardUnits) profile['stewardUnitIds'] = (u as any).stewardUnits;
      if ((u as any).bargainingUnitId) profile['bargainingUnitId'] = (u as any).bargainingUnitId;

      await db.collection('users').doc(u.uid).set(profile);
      console.log(`✅ Seeded user: ${u.email} [${u.role}]`);
    } catch (err) {
      console.error(`❌ Error seeding user ${u.email}:`, err);
    }
  }

  // 2. Seed Bargaining Units
  const bargainingUnits: BargainingUnit[] = [
    {
      id: 'unit-main-mfg',
      name: 'Main Manufacturing Plant',
      employerName: 'Acme Heavy Industries',
      location: 'Detroit, MI',
      contractId: 'cba-local-1118'
    },
    {
      id: 'unit-logistics',
      name: 'Regional Logistics Center',
      employerName: 'Acme Logistics Corp',
      location: 'Warren, MI',
      contractId: 'cba-local-1118'
    }
  ];

  for (const unit of bargainingUnits) {
    await db.collection('bargaining_units').doc(unit.id).set(unit);
  }
  console.log('✅ Seeded Bargaining Units');

  // 3. Seed CBA Contract & Articles
  const cbaContract: CBAContract = {
    id: 'cba-local-1118',
    localNumber: 'Local 1118',
    employerName: 'Acme Heavy Industries',
    title: 'Master Collective Bargaining Agreement (2024-2028)',
    effectiveDate: '2024-06-01',
    expirationDate: '2028-05-31',
    deadlines: {
      step1Days: 10,
      step2EmployerResponseDays: 5,
      step2UnionEscalationDays: 10,
      step3EmployerResponseDays: 15,
      arbitrationFilingDays: 30
    },
    articles: [
      {
        articleNumber: 'Article 8',
        title: 'Discipline and Discharge',
        section: 'Section 8.2 (Just Cause Standard)',
        category: 'Discipline',
        description: 'No employee shall be disciplined, suspended, or discharged without just cause. Progressive discipline principles must be adhered to.'
      },
      {
        articleNumber: 'Article 14',
        title: 'Overtime Allocation & Premium Pay',
        section: 'Section 14.4 (Equalization & Seniority Rotation)',
        category: 'Overtime',
        description: 'Overtime opportunities shall be distributed as equitably as practicable among employees within the same classification and department.'
      },
      {
        articleNumber: 'Article 19',
        title: 'Health and Safety Standards',
        section: 'Section 19.1 (PPE and Hazard Abatement)',
        category: 'Health & Safety',
        description: 'The Employer shall provide all required personal protective equipment (PPE) and maintain safe sanitary working conditions compliant with OSHA standards.'
      },
      {
        articleNumber: 'Article 22',
        title: 'Seniority and Job Bidding',
        section: 'Section 22.3 (Shift Selection and Vacancies)',
        category: 'Seniority',
        description: 'Preference for vacant shifts and job postings shall be granted to the senior qualified employee.'
      }
    ]
  };

  await db.collection('cba_contracts').doc(cbaContract.id).set(cbaContract);
  console.log('✅ Seeded CBA Contract & Articles');

  // 4. Seed Sample Grievances across different steps
  const now = new Date();
  const daysAgo = (days: number) => new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString();
  const daysAhead = (days: number) => new Date(now.getTime() + days * 24 * 60 * 60 * 1000).toISOString();

  const sampleGrievances: Grievance[] = [
    {
      id: 'gr-2026-0001',
      grievanceNumber: 'GR-2026-0001',
      title: 'Improper Mandatory Overtime Bypass on Line 4',
      description: 'On August 20, 2026, management bypassed senior machine operator Elena Rodriguez and assigned 8 hours of Saturday premium overtime to a probationary employee, violating established equalization rotation.',
      incidentDate: daysAgo(11),
      filingDate: daysAgo(7),
      bargainingUnitId: 'unit-main-mfg',
      bargainingUnitName: 'Main Manufacturing Plant',
      employerName: 'Acme Heavy Industries',
      memberUid: 'member-uid-001',
      memberName: 'Elena Rodriguez',
      memberId: 'MEM-8842',
      memberDepartment: 'Machining & Fabrication',
      memberJobTitle: 'CNC Senior Operator',
      supervisorName: 'Frank Henderson (Shift Supervisor)',
      assignedStewardUid: 'steward-uid-001',
      assignedStewardName: 'Marcus Brody',
      contractId: 'cba-local-1118',
      violatedArticles: [
        { articleNumber: 'Article 14', title: 'Overtime Allocation & Premium Pay', section: 'Section 14.4' }
      ],
      remedyRequested: 'Award grievant 8 hours of double-time pay for the missed overtime opportunity and reset the equalization roster.',
      currentStep: 'STEP_1_INFORMAL',
      status: 'AWAITING_EMPLOYER_RESPONSE',
      priority: 'MEDIUM',
      deadlines: {
        currentDeadline: daysAhead(3),
        deadlineType: 'EMPLOYER_RESPONSE',
        daysRemaining: 3,
        isOverdue: false
      },
      timeline: [
        {
          step: 'STEP_1_INFORMAL',
          date: daysAgo(7),
          note: 'Filed Step 1 with Shift Supervisor Frank Henderson.',
          updatedBy: { uid: 'steward-uid-001', name: 'Marcus Brody', role: 'steward' }
        }
      ],
      createdAt: daysAgo(7),
      updatedAt: daysAgo(7)
    },
    {
      id: 'gr-2026-0002',
      grievanceNumber: 'GR-2026-0002',
      title: 'Unjust 3-Day Suspension for Alleged Production Delay',
      description: 'Grievant was issued a 3-day disciplinary suspension without pay on Aug 12, 2026. Machine calibration logs prove the delay was caused by hydraulic pressure failure, not operator error. No progressive discipline was applied.',
      incidentDate: daysAgo(19),
      filingDate: daysAgo(15),
      bargainingUnitId: 'unit-main-mfg',
      bargainingUnitName: 'Main Manufacturing Plant',
      employerName: 'Acme Heavy Industries',
      memberUid: 'member-uid-001',
      memberName: 'Elena Rodriguez',
      memberId: 'MEM-8842',
      memberDepartment: 'Machining & Fabrication',
      memberJobTitle: 'CNC Senior Operator',
      supervisorName: 'Dave Miller (Plant Superintendent)',
      assignedStewardUid: 'steward-uid-001',
      assignedStewardName: 'Marcus Brody',
      contractId: 'cba-local-1118',
      violatedArticles: [
        { articleNumber: 'Article 8', title: 'Discipline and Discharge', section: 'Section 8.2 (Just Cause Standard)' }
      ],
      remedyRequested: 'Rescind the 3-day suspension immediately, purge all records from personnel file, and reimburse grievant for 24 hours of lost wages and benefits.',
      currentStep: 'STEP_2_FORMAL',
      status: 'UNDER_INVESTIGATION',
      priority: 'HIGH',
      deadlines: {
        currentDeadline: daysAhead(5),
        deadlineType: 'EMPLOYER_RESPONSE',
        daysRemaining: 5,
        isOverdue: false
      },
      timeline: [
        {
          step: 'STEP_1_INFORMAL',
          date: daysAgo(15),
          note: 'Step 1 meeting held; supervisor denied grievance.',
          updatedBy: { uid: 'steward-uid-001', name: 'Marcus Brody', role: 'steward' }
        },
        {
          step: 'STEP_2_FORMAL',
          date: daysAgo(10),
          note: 'Escalated to Step 2 Formal Grievance with HR & Plant Manager.',
          updatedBy: { uid: 'steward-uid-001', name: 'Marcus Brody', role: 'steward' }
        }
      ],
      createdAt: daysAgo(15),
      updatedAt: daysAgo(10)
    },
    {
      id: 'gr-2026-0003',
      grievanceNumber: 'GR-2026-0003',
      title: 'Health & Safety: Unrepaired Exhaust Ventilation in Bay 3',
      description: 'Ventilation hoods in Welding Bay 3 have been defective since July, exposing workers to excessive fume levels. Multiple safety work orders have been ignored.',
      incidentDate: daysAgo(30),
      filingDate: daysAgo(25),
      bargainingUnitId: 'unit-logistics',
      bargainingUnitName: 'Regional Logistics Center',
      employerName: 'Acme Logistics Corp',
      memberUid: 'member-uid-001',
      memberName: 'Elena Rodriguez',
      assignedStewardUid: 'steward-uid-001',
      assignedStewardName: 'Marcus Brody',
      contractId: 'cba-local-1118',
      violatedArticles: [
        { articleNumber: 'Article 19', title: 'Health and Safety Standards', section: 'Section 19.1' }
      ],
      remedyRequested: 'Immediate replacement of industrial exhaust filtration unit, air quality testing report provided to Joint Safety Committee, and stop-work until cleared.',
      currentStep: 'STEP_3_MEDIATION',
      status: 'HEARING_SCHEDULED',
      priority: 'URGENT',
      deadlines: {
        currentDeadline: daysAhead(2),
        deadlineType: 'UNION_ESCALATION',
        daysRemaining: 2,
        isOverdue: false
      },
      timeline: [
        {
          step: 'STEP_1_INFORMAL',
          date: daysAgo(25),
          note: 'Filed with Maintenance Supervisor.',
          updatedBy: { uid: 'steward-uid-001', name: 'Marcus Brody', role: 'steward' }
        },
        {
          step: 'STEP_2_FORMAL',
          date: daysAgo(18),
          note: 'Employer refused urgent repair; escalated.',
          updatedBy: { uid: 'steward-uid-001', name: 'Marcus Brody', role: 'steward' }
        },
        {
          step: 'STEP_3_MEDIATION',
          date: daysAgo(6),
          note: 'Joint Mediation scheduled for this Thursday.',
          updatedBy: { uid: 'admin-uid-001', name: 'Sarah Connor', role: 'admin' }
        }
      ],
      createdAt: daysAgo(25),
      updatedAt: daysAgo(6)
    }
  ];

  for (const g of sampleGrievances) {
    await db.collection('grievances').doc(g.id).set(g);

    // Seed sample notes
    await db.collection('grievances').doc(g.id).collection('notes').add({
      id: 'note-01',
      grievanceId: g.id,
      authorUid: 'steward-uid-001',
      authorName: 'Marcus Brody',
      authorRole: 'steward',
      content: 'Interviewed grievant and obtained machine maintenance logs for the date of incident. Corroborating evidence attached.',
      isConfidentialUnionOnly: true,
      createdAt: daysAgo(4)
    });
  }

  console.log('✅ Seeded Sample Grievances with Notes & Timelines');
  console.log('🎉 Seeding successfully completed! Demo logins available:');
  console.log('   - Admin:   admin@unionlocal.org   / password123');
  console.log('   - Steward: steward@unionlocal.org / password123');
  console.log('   - Member:  member@unionlocal.org  / password123');
}

seed().catch((err) => {
  console.error('Fatal seed error:', err);
  process.exit(1);
});
