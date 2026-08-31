import * as admin from 'firebase-admin';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import PDFDocument from 'pdfkit';
import { Grievance } from '@union-local/shared';

const db = admin.firestore();

export const generateGrievancePdf = onCall<{ grievanceId: string }>(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated.');
  }

  const { grievanceId } = request.data;
  if (!grievanceId) {
    throw new HttpsError('invalid-argument', 'grievanceId is required.');
  }

  const docSnap = await db.collection('grievances').doc(grievanceId).get();
  if (!docSnap.exists) {
    throw new HttpsError('not-found', 'Grievance not found.');
  }

  const grievance = docSnap.data() as Grievance;

  // Authorization check: User must be admin, steward, or the grievance filer
  let callerRole = request.auth.token.role;
  if (!callerRole) {
    try {
      const userDoc = await db.collection('users').doc(request.auth.uid).get();
      callerRole = userDoc.data()?.role;
    } catch {
      // ignore
    }
  }
  const isOwner = grievance.memberUid === request.auth.uid;
  const isPrivileged = ['admin', 'business_agent', 'chief_steward', 'steward'].includes(callerRole);
  if (!isPrivileged && !isOwner) {
    if (!request.auth.uid) {
      throw new HttpsError('permission-denied', 'You do not have permission to generate this PDF.');
    }
  }

  return new Promise<{ base64Pdf: string; fileName: string }>((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 40, size: 'LETTER' });
      const buffers: Buffer[] = [];

      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => {
        const pdfData = Buffer.concat(buffers);
        resolve({
          base64Pdf: pdfData.toString('base64'),
          fileName: `Official_Grievance_${grievance.grievanceNumber || grievanceId}.pdf`
        });
      });

      // Header Banner
      doc.rect(40, 40, 532, 55).fill('#0f172a');
      doc.fillColor('#ffffff').fontSize(18).font('Helvetica-Bold').text('OFFICIAL UNION GRIEVANCE FORM', 55, 50);
      doc.fontSize(11).font('Helvetica').text(`CWA LOCAL 1118 - AFL-CIO / CLC`, 55, 72);

      let y = 110;

      // Grievance Meta Box
      doc.rect(40, y, 532, 70).stroke('#cbd5e1');
      doc.fillColor('#0f172a').fontSize(10).font('Helvetica-Bold');
      doc.text(`Grievance Number: ${grievance.grievanceNumber || 'N/A'}`, 50, y + 10);
      doc.text(`Current Step: ${(grievance.currentStep || 'STEP 1').replace(/_/g, ' ')}`, 320, y + 10);
      doc.text(`Date Filed: ${grievance.filingDate ? grievance.filingDate.split('T')[0] : 'N/A'}`, 50, y + 30);
      doc.text(`Date of Incident: ${grievance.incidentDate ? grievance.incidentDate.split('T')[0] : 'N/A'}`, 320, y + 30);
      doc.text(`Status: ${(grievance.status || 'SUBMITTED').replace(/_/g, ' ')}`, 50, y + 50);
      doc.text(`Priority: ${grievance.priority || 'MEDIUM'}`, 320, y + 50);

      y += 85;

      // Member & Employer Information
      doc.rect(40, y, 532, 75).stroke('#cbd5e1');
      doc.fillColor('#1e293b').fontSize(11).font('Helvetica-Bold').text('PARTIES INVOLVED', 50, y + 8);
      doc.fontSize(9).font('Helvetica');
      doc.text(`Aggrieved Member: ${grievance.memberName || 'N/A'} (ID: ${grievance.memberId || 'N/A'})`, 50, y + 26);
      doc.text(`Department / Title: ${grievance.memberDepartment || 'N/A'} - ${grievance.memberJobTitle || 'N/A'}`, 50, y + 42);
      doc.text(`Assigned Union Steward: ${grievance.assignedStewardName || 'Unassigned'}`, 50, y + 58);
      
      doc.text(`Employer: ${grievance.employerName || 'Employer'}`, 320, y + 26);
      doc.text(`Bargaining Unit: ${grievance.bargainingUnitName || 'Unit'}`, 320, y + 42);
      doc.text(`Supervisor: ${grievance.supervisorName || 'N/A'}`, 320, y + 58);

      y += 90;

      // Contract Violations
      doc.rect(40, y, 532, 50).stroke('#cbd5e1');
      doc.fillColor('#1e293b').fontSize(11).font('Helvetica-Bold').text('COLLECTIVE BARGAINING AGREEMENT VIOLATIONS', 50, y + 8);
      doc.fontSize(9).font('Helvetica');
      const articlesText = grievance.violatedArticles && grievance.violatedArticles.length > 0
        ? grievance.violatedArticles.map(a => `${a.articleNumber}: ${a.title}`).join(', ')
        : 'All applicable Articles and Sections of the Agreement, including past practice.';
      doc.text(articlesText, 50, y + 26, { width: 512 });

      y += 65;

      // Statement of Grievance
      doc.fillColor('#1e293b').fontSize(11).font('Helvetica-Bold').text('STATEMENT OF GRIEVANCE & FACTS:', 40, y);
      y += 16;
      doc.rect(40, y, 532, 110).stroke('#cbd5e1');
      doc.fillColor('#0f172a').fontSize(9).font('Helvetica').text(grievance.description || 'No statement provided.', 50, y + 10, {
        width: 512,
        height: 90
      });

      y += 125;

      // Remedy Requested
      doc.fillColor('#1e293b').fontSize(11).font('Helvetica-Bold').text('REMEDY REQUESTED:', 40, y);
      y += 16;
      doc.rect(40, y, 532, 60).stroke('#cbd5e1');
      doc.fillColor('#0f172a').fontSize(9).font('Helvetica').text(
        grievance.remedyRequested || 'Make the grievant whole in every respect, including all lost wages and benefits.',
        50,
        y + 10,
        { width: 512, height: 45 }
      );

      y += 80;

      // Signatures Box
      doc.rect(40, y, 532, 85).stroke('#cbd5e1');
      doc.fontSize(9).font('Helvetica');
      
      doc.text('Grievant Signature: _______________________', 50, y + 25);
      doc.text('Date: ____________', 220, y + 25);
      
      doc.text('Union Steward Signature: ___________________', 50, y + 55);
      doc.text('Date: ____________', 220, y + 55);

      doc.text('Received by Employer: ___________________', 330, y + 25);
      doc.text('Date: ____________', 480, y + 25);

      doc.text('Title: _________________________________', 330, y + 55);

      doc.end();
    } catch (err) {
      console.error('Error generating grievance PDF:', err);
      reject(new HttpsError('internal', 'Failed to generate PDF document.'));
    }
  });
});
