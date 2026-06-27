import { Issue } from '../types';

export type ActionClassification = 'In the Works' | 'Action Pending' | 'Ignored / Delayed';

export interface ClassificationDetail {
  status: ActionClassification;
  bgColor: string;      // Tailwind bg class
  textColor: string;    // Tailwind text class
  borderColor: string;  // Tailwind border class
  badgeColor: string;    // Tailwind badge background class
  icon: string;         // lucide icon identifier
  label: string;
  reason: string;
  progressPercent: number;
}

/**
 * Evaluates an issue's active field status and administrative responsiveness.
 */
export function getIssueActionClassification(issue: Issue): ClassificationDetail {
  const now = new Date();
  const createdDate = new Date(issue.createdAt);
  const diffTime = Math.abs(now.getTime() - createdDate.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  // 1. "In the Works" - Status is actively being worked on/complete OR an officer is assigned
  const isCompletedOrActive = ['In Progress', 'Community Verification', 'Verified', 'Resolved', 'Closed'].includes(issue.status);
  const hasOfficer = !!issue.assignedOfficerId;

  if (isCompletedOrActive) {
    let reason = "This incident has active field operations underway or has been successfully resolved.";
    let label = "Action: In the Works";
    let progressPercent = 50;

    if (issue.status === 'Verified') {
      reason = "Resolution successfully audited and verified by citizen double-blind consensus.";
      label = "Action Taken: Verified Fix";
      progressPercent = 100;
    } else if (issue.status === 'Closed') {
      reason = "Incident lifecycle completed and closed in records.";
      label = "Action Taken: Closed";
      progressPercent = 100;
    } else if (issue.status === 'Community Verification') {
      reason = "Field repairs submitted by officer; currently undergoing double-blind community verification.";
      label = "Action Taken: Verification Audit";
      progressPercent = 85;
    } else if (issue.status === 'In Progress') {
      reason = `Active repair work underway. Dispatched to Officer ${issue.assignedOfficerName || 'Municipal Team'}.`;
      label = "Action: In the Works";
      progressPercent = 60;
    } else if (issue.status === 'Resolved') {
      reason = "Field repairs marked completed by assigned officer. Awaiting citizen confirmation.";
      label = "Action Taken: Resolved";
      progressPercent = 80;
    }

    return {
      status: 'In the Works',
      bgColor: 'bg-emerald-50 border-emerald-100',
      textColor: 'text-emerald-800',
      borderColor: 'border-emerald-200',
      badgeColor: 'bg-emerald-500',
      icon: 'CheckCircle2',
      label,
      reason,
      progressPercent
    };
  }

  // If status is not complete/in-progress but an officer is assigned, it is in active dispatch/works
  if (hasOfficer) {
    return {
      status: 'In the Works',
      bgColor: 'bg-blue-50 border-blue-100',
      textColor: 'text-blue-800',
      borderColor: 'border-blue-200',
      badgeColor: 'bg-blue-500',
      icon: 'ShieldCheck',
      label: 'Action: Dispatched',
      reason: `Assigned to Officer ${issue.assignedOfficerName}. Preliminary administrative actions and material assessments have initiated.`,
      progressPercent: 30
    };
  }

  // 2. "Ignored / Delayed" - Lacks officer, AND has been delayed/escalated or has high-severity ignored keywords
  const isOlderThanLimit = diffDays > 4; // Older than 4 days with no action
  const isEscalated = (issue.escalationLevel || 0) >= 1;
  const descriptionKeywordsMatch = 
    issue.description.toLowerCase().includes('delayed') || 
    issue.description.toLowerCase().includes('ignored') || 
    issue.description.toLowerCase().includes('neglected') ||
    issue.description.toLowerCase().includes('accident') ||
    issue.description.toLowerCase().includes('submerged');

  if (isOlderThanLimit || isEscalated || (descriptionKeywordsMatch && diffDays >= 2)) {
    let reason = `No field officer has been assigned to this hazard for ${diffDays} days. System metrics indicate bureaucratic delay.`;
    
    if (isEscalated) {
      reason = `Escalated to Level ${issue.escalationLevel} (${issue.escalationLevel === 2 ? 'Dept Head' : 'Senior Officer'}) due to ongoing municipal inaction.`;
    } else if (descriptionKeywordsMatch) {
      reason = `Ongoing public hazard with active citizen feedback reporting negligence or recurring safety risks. Action neglected.`;
    }

    return {
      status: 'Ignored / Delayed',
      bgColor: 'bg-red-50 border-red-100',
      textColor: 'text-red-800',
      borderColor: 'border-red-200',
      badgeColor: 'bg-red-500',
      icon: 'AlertTriangle',
      label: 'Action Status: Ignored / Delayed',
      reason,
      progressPercent: 10
    };
  }

  // 3. "Action Pending" - Normal new issue awaiting triage/officer routing
  return {
    status: 'Action Pending',
    bgColor: 'bg-amber-50 border-amber-100',
    textColor: 'text-amber-800',
    borderColor: 'border-amber-200',
    badgeColor: 'bg-amber-500',
    icon: 'Clock',
    label: 'Action Status: Pending Assignment',
    reason: `Registered ${diffDays} day(s) ago. Undergoing automated triage and routing to the respective municipal ward.`,
    progressPercent: 20
  };
}

/**
 * Summarizes current issues list by action classification.
 */
export function summarizeActionClassifications(issues: Issue[]) {
  const summary = {
    inWorks: 0,
    pending: 0,
    ignored: 0,
    total: issues.length
  };

  issues.forEach(issue => {
    const detail = getIssueActionClassification(issue);
    if (detail.status === 'In the Works') {
      summary.inWorks++;
    } else if (detail.status === 'Action Pending') {
      summary.pending++;
    } else {
      summary.ignored++;
    }
  });

  return summary;
}
