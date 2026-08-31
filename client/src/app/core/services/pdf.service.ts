import { Injectable, inject } from '@angular/core';
import { httpsCallable } from 'firebase/functions';
import { doc, getDoc } from 'firebase/firestore';
import { FirebaseService } from './firebase.service';
import { Grievance } from '@union-local/shared';

@Injectable({
  providedIn: 'root'
})
export class PdfService {
  private firebase = inject(FirebaseService);

  public async downloadGrievancePdf(grievanceId: string): Promise<void> {
    let grievanceData: Grievance | null = null;

    // Fetch grievance data from Firestore
    try {
      const docRef = doc(this.firebase.firestore, 'grievances', grievanceId);
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        grievanceData = { ...(snap.data() as Grievance), id: snap.id };
      }
    } catch (e) {
      console.warn('Could not pre-fetch grievance data for PDF:', e);
    }

    // Try Cloud Function first
    try {
      const generatePdfCallable = httpsCallable<{ grievanceId: string }, { base64Pdf: string; fileName: string }>(
        this.firebase.functions,
        'generateGrievancePdf'
      );

      const response = await generatePdfCallable({ grievanceId });
      const { base64Pdf, fileName } = response.data;

      const byteCharacters = atob(base64Pdf);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'application/pdf' });

      this.triggerDownload(blob, fileName || `Official_Grievance_${grievanceId}.pdf`);
      return;
    } catch (err) {
      console.warn('Cloud Function PDF generation unavailable, generating client-side PDF fallback:', err);
    }

    // Fallback: Generate valid official PDF client-side
    if (grievanceData) {
      const blob = this.generateClientPdf(grievanceData);
      const fileName = `Official_Grievance_${grievanceData.grievanceNumber || grievanceId}.pdf`;
      this.triggerDownload(blob, fileName);
    } else {
      throw new Error('Grievance details not found.');
    }
  }

  private triggerDownload(blob: Blob, fileName: string): void {
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
  }

  private generateClientPdf(g: Grievance): Blob {
    const esc = (text?: string): string => {
      if (!text) return '';
      return text.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
    };

    const dateFiled = g.filingDate ? g.filingDate.split('T')[0] : 'N/A';
    const incidentDate = g.incidentDate ? g.incidentDate.split('T')[0] : 'N/A';
    const step = (g.currentStep || 'STEP 1').replace(/_/g, ' ');
    const status = (g.status || 'SUBMITTED').replace(/_/g, ' ');
    const articles = g.violatedArticles && g.violatedArticles.length > 0
      ? g.violatedArticles.map(a => `${a.articleNumber}: ${a.title}`).join(', ')
      : 'All applicable Articles & Past Practice';

    const stream = `
q
% Header Banner (Dark Navy)
0.059 0.090 0.165 rg
40 700 532 52 re
f

% Header Text
BT
/F2 16 Tf
1 1 1 rg
55 732 Td
(OFFICIAL UNION GRIEVANCE FORM) Tj
ET

BT
/F1 10 Tf
1 1 1 rg
55 714 Td
(CWA LOCAL 1118 - AFL-CIO / CLC) Tj
ET

% Meta Box
0.796 0.835 0.882 RG
1 w
40 625 532 65 re
S

BT
/F2 9 Tf
0.059 0.090 0.165 rg
50 673 Td
(Grievance Number: ${esc(g.grievanceNumber)}) Tj
270 0 Td
(Current Step: ${esc(step)}) Tj
-270 -18 Td
(Date Filed: ${esc(dateFiled)}) Tj
270 0 Td
(Incident Date: ${esc(incidentDate)}) Tj
-270 -18 Td
(Status: ${esc(status)}) Tj
270 0 Td
(Priority: ${esc(g.priority || 'MEDIUM')}) Tj
ET

% Parties Involved Box
40 535 532 80 re
S

BT
/F2 10 Tf
0.118 0.227 0.541 rg
50 600 Td
(PARTIES INVOLVED) Tj
ET

BT
/F1 8.5 Tf
0.059 0.090 0.165 rg
50 584 Td
(Aggrieved Member: ${esc(g.memberName)}  \\(ID: ${esc(g.memberId || 'N/A')}\\)) Tj
270 0 Td
(Employer: ${esc(g.employerName)}) Tj
-270 -15 Td
(Department: ${esc(g.memberDepartment || 'N/A')}  \\(Title: ${esc(g.memberJobTitle || 'N/A')}\\)) Tj
270 0 Td
(Bargaining Unit: ${esc(g.bargainingUnitName)}) Tj
-270 -15 Td
(Assigned Steward: ${esc(g.assignedStewardName || 'Unassigned')}) Tj
270 0 Td
(Supervisor: ${esc(g.supervisorName || 'N/A')}) Tj
ET

% CBA Violations Box
40 465 532 60 re
S

BT
/F2 10 Tf
0.118 0.227 0.541 rg
50 510 Td
(COLLECTIVE BARGAINING AGREEMENT VIOLATIONS) Tj
ET

BT
/F1 8.5 Tf
0.059 0.090 0.165 rg
50 492 Td
(Articles Violated: ${esc(articles.substring(0, 85))}) Tj
ET

% Statement of Facts Box
40 335 532 120 re
S

BT
/F2 10 Tf
0.118 0.227 0.541 rg
50 440 Td
(STATEMENT OF GRIEVANCE & FACTS) Tj
ET

BT
/F1 8.5 Tf
0.059 0.090 0.165 rg
50 422 Td
(${esc((g.description || 'No statement provided.').substring(0, 90))}) Tj
0 -14 Td
(${esc((g.description || '').substring(90, 180))}) Tj
0 -14 Td
(${esc((g.description || '').substring(180, 270))}) Tj
0 -14 Td
(${esc((g.description || '').substring(270, 360))}) Tj
ET

% Remedy Box
40 240 532 85 re
S

BT
/F2 10 Tf
0.118 0.227 0.541 rg
50 310 Td
(REMEDY REQUESTED) Tj
ET

BT
/F1 8.5 Tf
0.086 0.639 0.290 rg
50 292 Td
(${esc((g.remedyRequested || 'Make the grievant whole in every respect.').substring(0, 90))}) Tj
0 -14 Td
(${esc((g.remedyRequested || '').substring(90, 180))}) Tj
0 -14 Td
(${esc((g.remedyRequested || '').substring(180, 270))}) Tj
ET

% Signatures Box
40 140 532 90 re
S

BT
/F2 9 Tf
0.118 0.227 0.541 rg
50 215 Td
(SIGNATURES & ACKNOWLEDGEMENTS) Tj
ET

BT
/F1 8 Tf
0.059 0.090 0.165 rg
50 190 Td
(Grievant Signature: _______________________) Tj
160 0 Td
(Date: ________) Tj
110 0 Td
(Employer Received: _____________________) Tj
-270 -25 Td
(Union Steward: ___________________________) Tj
160 0 Td
(Date: ________) Tj
110 0 Td
(Title: ________________________________) Tj
ET
Q
`;

    const streamBytes = new TextEncoder().encode(stream.trim());
    const streamLength = streamBytes.length;

    const objects: string[] = [];
    objects.push(`1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj`);
    objects.push(`2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj`);
    objects.push(`3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> >>\nendobj`);
    objects.push(`4 0 obj\n<< /Length ${streamLength} >>\nstream\n${stream.trim()}\nendstream\nendobj`);
    objects.push(`5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj`);
    objects.push(`6 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>\nendobj`);

    let pdf = `%PDF-1.4\n`;
    const xrefOffsets: number[] = [0];

    for (let i = 0; i < objects.length; i++) {
      xrefOffsets.push(pdf.length);
      pdf += `${objects[i]}\n`;
    }

    const xrefStart = pdf.length;
    pdf += `xref\n0 ${objects.length + 1}\n`;
    pdf += `0000000000 65535 f \n`;
    for (let i = 1; i <= objects.length; i++) {
      pdf += `${xrefOffsets[i].toString().padStart(10, '0')} 00000 n \n`;
    }

    pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`;

    return new Blob([pdf], { type: 'application/pdf' });
  }
}
