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
  limit 
} from 'firebase/firestore';
import { db } from '../firebase';
import { Issue, Comment, Notification, ActivityLog, VerificationRequest } from '../types';

// Offline detection state to dynamically fall back to local storage
let isFirebaseOffline = false;

// Check if we should use local mock storage (when Firebase is unconfigured, in sandbox mode, or offline)
const isLocalMode = (): boolean => {
  return !db || isFirebaseOffline || localStorage.getItem('ch_sandbox_mode') === 'true';
};

// Generic error handler
const handleDBError = (action: string, error: any) => {
  console.error(`Database Error during [${action}]:`, error);
  throw new Error(`Database operations failed during ${action}: ${error.message || error}`);
};

/**
 * MOCK DATA SEED GENERATOR
 * Pre-populates the local storage with real-world scenarios straight from the hackathon brief.
 */
const SEED_ISSUES: Issue[] = [
  {
    id: 'issue-101',
    title: 'Flooded Main Junction & Sewage Overflow',
    description: 'The main crossing in Sector 56 is completely submerged due to sewage blockages. Traffic is halted, causing huge delays for 5000+ daily commuters. AI merged 500 separate citizen complaints.',
    category: 'Water & Sewage',
    department: 'Water & Sewage Authority',
    status: 'In Progress',
    severity: 'Critical',
    priority: 'Critical',
    lat: 28.4595,
    lng: 77.0266,
    address: 'Sector 56 Crossroad, Gurgaon',
    imageUrl: 'https://images.unsplash.com/photo-1541888946425-d81bb19240f5?auto=format&fit=crop&w=600&q=80',
    reporterId: 'reporter-1',
    reporterName: 'Ashna Agarwal',
    votesCount: 420,
    voters: ['user-1', 'user-2', 'user-3'],
    assignedOfficerId: 'officer-1',
    assignedOfficerName: 'Sanjay Dutt',
    createdAt: new Date(Date.now() - 32 * 24 * 60 * 60 * 1000).toISOString(), // 32 days ago
    updatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    // GAP specifics
    priorityScore: 97,
    credibilityScore: 98,
    credibilityExplanation: 'Multi-spectral image metadata aligns with GPS tag. Historical flood report consistent.',
    escalationLevel: 2, // Escalated to Department Head
    escalationDate: new Date(Date.now() - 17 * 24 * 60 * 60 * 1000).toISOString(),
    isMerged: true,
    affectedCount: 500,
    materialsEstimate: {
      cost: 3450,
      items: [
        { name: 'Heavy Duty Sewer Outlet Pipes (12")', qty: 6, unit: 'm', cost: 1200 },
        { name: 'Industrial Excavator Rental', qty: 2, unit: 'days', cost: 1500 },
        { name: 'Quick-Setting Structural Concrete', qty: 15, unit: 'bags', cost: 450 },
        { name: 'Protective Crew Gear & Safety Signage', qty: 10, unit: 'units', cost: 300 }
      ]
    },
    communityPledges: [
      { userId: 'reporter-1', userName: 'Ashna Agarwal', hours: 4, pledgeType: 'cleanup', notes: 'I will coordinate the volunteer cleanup session once sewer flow returns to normal.' },
      { userId: 'user-2', userName: 'Pranav Roy', pledgeType: 'supplies', notes: 'Happy to provide 5 boxes of standard trash grabbers and heavy trash bags.' }
    ]
  },
  {
    id: 'issue-102',
    title: 'Dangerous Deep Potholes',
    description: 'Multiple cavernous potholes on the main market road. Already caused two two-wheeler accidents this week. Delayed by Rajesh Kumar Rajesh of PWD Gurgaon.',
    category: 'Potholes & Roads',
    department: 'Public Works Dept',
    status: 'Under Review',
    severity: 'High',
    priority: 'High',
    lat: 28.4682,
    lng: 77.0329,
    address: 'Central Market main avenue, Ward 8',
    imageUrl: 'https://images.unsplash.com/photo-1515162305285-0293e4767cc2?auto=format&fit=crop&w=600&q=80',
    reporterId: 'reporter-2',
    reporterName: 'Amit Shah',
    votesCount: 88,
    voters: ['user-2'],
    assignedOfficerId: 'officer-rajesh',
    assignedOfficerName: 'Rajesh Kumar',
    createdAt: new Date(Date.now() - 18 * 24 * 60 * 60 * 1000).toISOString(), // 18 days ago
    updatedAt: new Date(Date.now() - 18 * 24 * 60 * 60 * 1000).toISOString(),
    // GAP specifics
    priorityScore: 75,
    credibilityScore: 92,
    credibilityExplanation: 'AI structural damage scanning matches local user report history. High contrast image verify.',
    escalationLevel: 1, // Escalated to Senior Officer
    escalationDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    isMerged: false,
    affectedCount: 1,
    materialsEstimate: {
      cost: 840,
      items: [
        { name: 'Rapid Cold Patch Asphalt Mix', qty: 12, unit: 'bags', cost: 360 },
        { name: 'Manual Vibratory Asphalt Tamper Rental', qty: 1, unit: 'day', cost: 180 },
        { name: 'Safety Delineator Barricade Cones', qty: 4, unit: 'units', cost: 100 },
        { name: 'Heavy Bitumen Tack Coat Emulsion', qty: 4, unit: 'buckets', cost: 200 }
      ]
    },
    communityPledges: [
      { userId: 'user-3', userName: 'Karan Mehra', hours: 3, pledgeType: 'labor', notes: 'I have a shovel and manual tamper. Happy to assist in filling!' }
    ]
  },
  {
    id: 'issue-103',
    title: 'Complete Blackout on Rose Street',
    description: 'All 15 streetlights have been completely dead for 2 weeks, making the street pitch-black and unsafe for women and children at night.',
    category: 'Streetlights & Electricity',
    department: 'Traffic Engineering',
    status: 'Community Verification',
    severity: 'Medium',
    priority: 'Medium',
    lat: 28.4501,
    lng: 77.0422,
    address: 'Rose Avenue Sector 22, Ward 6',
    imageUrl: 'https://images.unsplash.com/photo-1518241353330-0f7941c2d9b5?auto=format&fit=crop&w=600&q=80',
    reporterId: 'reporter-3',
    reporterName: 'Divya Sharma',
    votesCount: 34,
    voters: [],
    assignedOfficerId: 'officer-3',
    assignedOfficerName: 'Manoj Sinha',
    createdAt: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    beforeImageUrl: 'https://images.unsplash.com/photo-1518241353330-0f7941c2d9b5?auto=format&fit=crop&w=600&q=80',
    afterImageUrl: 'https://images.unsplash.com/photo-1478760329108-5c3ed9d495a0?auto=format&fit=crop&w=600&q=80',
    resolutionNotes: 'Replaced all 15 fluorescent bulbs with energy-efficient LED models and fixed local distribution box.',
    // GAP specifics
    priorityScore: 45,
    credibilityScore: 89,
    credibilityExplanation: 'No image modification detected. Exif metadata is fully compliant.',
    escalationLevel: 0,
    isMerged: false,
    affectedCount: 1
  },
  {
    id: 'issue-104',
    title: 'Toxic Slurry Dumping near Forest Boundary',
    description: 'Unknown tankers illegally dumping chemical industrial sludge near the local natural forest buffer. Foul smell spreading.',
    category: 'Waste & Sanitation',
    department: 'Sanitation Department',
    status: 'Submitted',
    severity: 'Critical',
    priority: 'High',
    lat: 28.4320,
    lng: 77.0180,
    address: 'Forest Road Border, Ward 8',
    imageUrl: 'https://images.unsplash.com/photo-1611284446314-60a58ac0deb9?auto=format&fit=crop&w=600&q=80',
    reporterId: 'reporter-4',
    reporterName: 'Karan Mehra',
    votesCount: 125,
    voters: [],
    createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    // GAP specifics
    priorityScore: 85,
    credibilityScore: 94,
    credibilityExplanation: 'Chemical residue markers detected in the image using structural contrast analytics.',
    escalationLevel: 0,
    isMerged: false,
    affectedCount: 1
  }
];

const SEED_COMMENTS: Record<string, Comment[]> = {
  'issue-101': [
    {
      id: 'c-1',
      issueId: 'issue-101',
      userId: 'reporter-1',
      userName: 'Ashna Agarwal',
      userRole: 'Citizen',
      text: 'This is getting worse daily. It is literally pouring into residential yards. Pls fix ASAP!',
      createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    },
    {
      id: 'c-2',
      issueId: 'issue-101',
      userId: 'officer-1',
      userName: 'Sanjay Dutt',
      userRole: 'Officer',
      text: 'Our municipal sewer teams have deployed excavators to clear blockages in the primary outlet canal. We appreciate your patience.',
      createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
    }
  ],
  'issue-102': [
    {
      id: 'c-3',
      issueId: 'issue-102',
      userId: 'user-2',
      userName: 'Pranav Roy',
      userRole: 'Citizen',
      text: 'My car tire burst right here last night. There is literally no safety board or barricading around Rajesh Kumars jurisdiction!',
      createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString()
    }
  ]
};

const SEED_LOGS: Record<string, ActivityLog[]> = {
  'issue-101': [
    {
      id: 'log-1',
      issueId: 'issue-101',
      userId: 'reporter-1',
      userName: 'Ashna Agarwal',
      action: 'Reported issue and initiated AI triage.',
      createdAt: new Date(Date.now() - 32 * 24 * 60 * 60 * 1000).toISOString()
    },
    {
      id: 'log-2',
      issueId: 'issue-101',
      userId: 'ai-engine',
      userName: 'Gemini AI',
      action: 'AI classified as Water & Sewage, calculated Priority Score of 97 and merged 500 duplicate tickets.',
      createdAt: new Date(Date.now() - 32 * 24 * 60 * 60 * 1000).toISOString()
    },
    {
      id: 'log-3',
      issueId: 'issue-101',
      userId: 'system',
      userName: 'Escalation Agent',
      action: 'Escalated to Day 15 Senior Officer (Sanjay Dutt Assigned).',
      createdAt: new Date(Date.now() - 17 * 24 * 60 * 60 * 1000).toISOString()
    },
    {
      id: 'log-4',
      issueId: 'issue-101',
      userId: 'system',
      userName: 'Escalation Agent',
      action: 'Escalated to Day 30 Department Head (Municipal Commissioner Warned).',
      createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
    }
  ]
};

const SEED_VERIFICATION_REQUESTS: Record<string, VerificationRequest[]> = {
  'issue-103': [
    {
      id: 'vr-1',
      issueId: 'issue-103',
      officerId: 'officer-3',
      officerName: 'Manoj Sinha',
      afterImageUrl: 'https://images.unsplash.com/photo-1478760329108-5c3ed9d495a0?auto=format&fit=crop&w=600&q=80',
      notes: 'All streetlights are now fully functional. Gemini AI vision analyzed the proof image with 96% repair confidence.',
      votesVerified: 1,
      votesRejected: 0,
      voters: { 'user-1': true },
      createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
      status: 'Pending'
    }
  ]
};

// Initialize Offline LocalStorage Db if not pre-seeded
const initLocalStorageDb = () => {
  if (!localStorage.getItem('ch_local_issues')) {
    localStorage.setItem('ch_local_issues', JSON.stringify(SEED_ISSUES));
  }
  if (!localStorage.getItem('ch_local_comments')) {
    localStorage.setItem('ch_local_comments', JSON.stringify(SEED_COMMENTS));
  }
  if (!localStorage.getItem('ch_local_logs')) {
    localStorage.setItem('ch_local_logs', JSON.stringify(SEED_LOGS));
  }
  if (!localStorage.getItem('ch_local_vreqs')) {
    localStorage.setItem('ch_local_vreqs', JSON.stringify(SEED_VERIFICATION_REQUESTS));
  }
  if (!localStorage.getItem('ch_local_notifs')) {
    localStorage.setItem('ch_local_notifs', JSON.stringify([]));
  }
};

initLocalStorageDb();

/**
 * OFFLINE COMPATIBILITY HELPERS
 */
const getLocalIssues = (): Issue[] => {
  initLocalStorageDb();
  return JSON.parse(localStorage.getItem('ch_local_issues') || '[]');
};

const saveLocalIssues = (issues: Issue[]) => {
  localStorage.setItem('ch_local_issues', JSON.stringify(issues));
};

/**
 * CENTRAL DATABASE INTERACTION SUITE (WITH DUAL-PATH FALLBACK)
 */

export const dbCreateIssue = async (issue: Omit<Issue, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> => {
  if (isLocalMode()) {
    initLocalStorageDb();
    const id = `issue-${Math.random().toString(36).substring(2, 9)}`;
    const newIssue: Issue = {
      ...issue,
      id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    // Add to mock issues
    const issues = getLocalIssues();
    issues.unshift(newIssue);
    saveLocalIssues(issues);

    // Save activity log
    const localLogs = JSON.parse(localStorage.getItem('ch_local_logs') || '{}');
    if (!localLogs[id]) localLogs[id] = [];
    localLogs[id].push({
      id: `log-${Date.now()}`,
      issueId: id,
      userId: issue.reporterId,
      userName: issue.reporterName,
      action: 'Reported issue and completed AI verification.',
      createdAt: new Date().toISOString()
    });
    localStorage.setItem('ch_local_logs', JSON.stringify(localLogs));

    // Save notification
    const localNotifs = JSON.parse(localStorage.getItem('ch_local_notifs') || '[]');
    localNotifs.push({
      id: `notif-${Date.now()}`,
      userId: issue.reporterId,
      title: 'Report Registered',
      message: `Your report "${issue.title}" has been successfully logged with Priority Score: ${issue.priorityScore || 50}.`,
      issueId: id,
      type: 'Status Changed',
      read: false,
      createdAt: new Date().toISOString()
    });
    localStorage.setItem('ch_local_notifs', JSON.stringify(localNotifs));

    return id;
  }

  // FIRESTORE FLOW
  try {
    const issueRef = doc(collection(db!, 'issues'));
    const newIssue: Issue = {
      ...issue,
      id: issueRef.id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    await setDoc(issueRef, newIssue);

    // Write initial Activity Log
    const logRef = doc(collection(db!, `issues/${issueRef.id}/activityLogs`));
    const initLog: ActivityLog = {
      id: logRef.id,
      issueId: issueRef.id,
      userId: issue.reporterId,
      userName: issue.reporterName,
      action: 'Reported issue and initiated AI triage.',
      createdAt: new Date().toISOString()
    };
    await setDoc(logRef, initLog);

    // Create system notification
    const notifRef = doc(collection(db!, 'notifications'));
    const initNotif: Notification = {
      id: notifRef.id,
      userId: issue.reporterId,
      title: 'Report Submitted',
      message: `Your report "${issue.title}" has been submitted successfully to ${issue.department}.`,
      issueId: issueRef.id,
      type: 'Status Changed',
      read: false,
      createdAt: new Date().toISOString()
    };
    await setDoc(notifRef, initNotif);

    return issueRef.id;
  } catch (err: any) {
    console.warn('[Community Hero] Firestore dbCreateIssue failed, falling back to LocalStorage:', err);
    isFirebaseOffline = true;
    const id = `issue-${Math.random().toString(36).substring(2, 9)}`;
    const newIssue: Issue = {
      ...issue,
      id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    const issues = getLocalIssues();
    issues.unshift(newIssue);
    saveLocalIssues(issues);
    return id;
  }
};

export const dbGetIssues = async (): Promise<Issue[]> => {
  if (isLocalMode()) {
    return getLocalIssues();
  }

  try {
    const q = query(collection(db!, 'issues'), orderBy('createdAt', 'desc'));
    const querySnapshot = await getDocs(q);
    const list: Issue[] = [];
    querySnapshot.forEach((docSnap) => {
      list.push(docSnap.data() as Issue);
    });
    return list.length > 0 ? list : getLocalIssues(); // fallback if Firestore is empty
  } catch (err) {
    console.warn('Firestore getIssues failed, falling back to local seed data:', err);
    return getLocalIssues();
  }
};

export const dbGetMyIssues = async (userId: string): Promise<Issue[]> => {
  if (isLocalMode()) {
    return getLocalIssues().filter(i => i.reporterId === userId);
  }

  try {
    const q = query(
      collection(db!, 'issues'), 
      where('reporterId', '==', userId), 
      orderBy('createdAt', 'desc')
    );
    const querySnapshot = await getDocs(q);
    const list: Issue[] = [];
    querySnapshot.forEach((docSnap) => {
      list.push(docSnap.data() as Issue);
    });
    return list;
  } catch (err) {
    console.warn('Firestore getMyIssues failed, falling back to local mock filtering.');
    return getLocalIssues().filter(i => i.reporterId === userId);
  }
};

export const dbGetIssueById = async (id: string): Promise<Issue | null> => {
  if (isLocalMode()) {
    return getLocalIssues().find(i => i.id === id) || null;
  }

  try {
    const docSnap = await getDoc(doc(db!, 'issues', id));
    return docSnap.exists() ? (docSnap.data() as Issue) : (getLocalIssues().find(i => i.id === id) || null);
  } catch (err) {
    return getLocalIssues().find(i => i.id === id) || null;
  }
};

export const dbUpdateIssueStatus = async (
  issueId: string, 
  status: Issue['status'], 
  actorId: string, 
  actorName: string,
  extraData?: Partial<Issue>
): Promise<void> => {
  if (isLocalMode()) {
    const issues = getLocalIssues();
    const index = issues.findIndex(i => i.id === issueId);
    if (index !== -1) {
      issues[index] = {
        ...issues[index],
        status,
        updatedAt: new Date().toISOString(),
        ...extraData
      };
      saveLocalIssues(issues);

      // Audit Trail Log
      const localLogs = JSON.parse(localStorage.getItem('ch_local_logs') || '{}');
      if (!localLogs[issueId]) localLogs[issueId] = [];
      localLogs[issueId].push({
        id: `log-${Date.now()}`,
        issueId,
        userId: actorId,
        userName: actorName,
        action: `Status updated to [${status}]. ${extraData?.resolutionNotes ? 'Resolution Notes: ' + extraData.resolutionNotes : ''}`,
        createdAt: new Date().toISOString()
      });
      localStorage.setItem('ch_local_logs', JSON.stringify(localLogs));

      // Notification
      const localNotifs = JSON.parse(localStorage.getItem('ch_local_notifs') || '[]');
      localNotifs.push({
        id: `notif-${Date.now()}`,
        userId: issues[index].reporterId,
        title: 'Status Action Logged',
        message: `Your report "${issues[index].title}" has updated to: ${status}`,
        issueId,
        type: 'Status Changed',
        read: false,
        createdAt: new Date().toISOString()
      });
      localStorage.setItem('ch_local_notifs', JSON.stringify(localNotifs));
    }
    return;
  }

  try {
    const issueRef = doc(db!, 'issues', issueId);
    const updatePayload: Partial<Issue> = {
      status,
      updatedAt: new Date().toISOString(),
      ...extraData
    };
    await updateDoc(issueRef, updatePayload);

    // Audit Trail Log
    const logRef = doc(collection(db!, `issues/${issueId}/activityLogs`));
    const log: ActivityLog = {
      id: logRef.id,
      issueId,
      userId: actorId,
      userName: actorName,
      action: `Status updated to [${status}].`,
      createdAt: new Date().toISOString()
    };
    await setDoc(logRef, log);

    // Create Notification
    const issueSnap = await getDoc(issueRef);
    if (issueSnap.exists()) {
      const issueData = issueSnap.data() as Issue;
      const notifRef = doc(collection(db!, 'notifications'));
      const notification: Notification = {
        id: notifRef.id,
        userId: issueData.reporterId,
        title: 'Issue Update',
        message: `Your report "${issueData.title}" status changed to ${status}.`,
        issueId,
        type: 'Status Changed',
        read: false,
        createdAt: new Date().toISOString()
      };
      await setDoc(notifRef, notification);
    }
  } catch (err: any) {
    console.warn('[Community Hero] Firestore dbUpdateIssueStatus failed, falling back to LocalStorage:', err);
    isFirebaseOffline = true;
    const issues = getLocalIssues();
    const index = issues.findIndex(i => i.id === issueId);
    if (index !== -1) {
      issues[index] = {
        ...issues[index],
        status,
        updatedAt: new Date().toISOString(),
        ...extraData
      };
      saveLocalIssues(issues);
    }
  }
};

export const dbSupportIssue = async (issueId: string, userId: string): Promise<void> => {
  if (isLocalMode()) {
    const issues = getLocalIssues();
    const index = issues.findIndex(i => i.id === issueId);
    if (index !== -1) {
      const voterIndex = issues[index].voters.indexOf(userId);
      if (voterIndex !== -1) {
        // Toggle off (unlike)
        issues[index].voters.splice(voterIndex, 1);
      } else {
        // Toggle on (like)
        issues[index].voters.push(userId);
      }
      issues[index].votesCount = issues[index].voters.length;
      
      // Recalculate priority score based on voters
      if (issues[index].priorityScore !== undefined) {
        const baseSeverity = issues[index].severity === 'Critical' ? 40 : issues[index].severity === 'High' ? 30 : issues[index].severity === 'Medium' ? 20 : 10;
        issues[index].priorityScore = Math.min(99, baseSeverity + issues[index].votesCount + (issues[index].affectedCount || 1) / 10);
      }

      saveLocalIssues(issues);
    }
    return;
  }

  try {
    const issueRef = doc(db!, 'issues', issueId);
    const snap = await getDoc(issueRef);
    if (!snap.exists()) return;

    const issue = snap.data() as Issue;
    let updatedVoters: string[];
    const voterIndex = issue.voters.indexOf(userId);
    if (voterIndex !== -1) {
      // Toggle off (unlike)
      updatedVoters = issue.voters.filter(uid => uid !== userId);
    } else {
      // Toggle on (like)
      updatedVoters = [...issue.voters, userId];
    }
    
    await updateDoc(issueRef, {
      voters: updatedVoters,
      votesCount: updatedVoters.length,
      updatedAt: new Date().toISOString()
    });
  } catch (err: any) {
    console.warn('[Community Hero] Firestore dbSupportIssue failed, falling back to LocalStorage:', err);
    isFirebaseOffline = true;
    const issues = getLocalIssues();
    const index = issues.findIndex(i => i.id === issueId);
    if (index !== -1) {
      const voterIndex = issues[index].voters.indexOf(userId);
      if (voterIndex !== -1) {
        issues[index].voters.splice(voterIndex, 1);
      } else {
        issues[index].voters.push(userId);
      }
      issues[index].votesCount = issues[index].voters.length;
      if (issues[index].priorityScore !== undefined) {
        const baseSeverity = issues[index].severity === 'Critical' ? 40 : issues[index].severity === 'High' ? 30 : issues[index].severity === 'Medium' ? 20 : 10;
        issues[index].priorityScore = Math.min(99, baseSeverity + issues[index].votesCount + (issues[index].affectedCount || 1) / 10);
      }
      saveLocalIssues(issues);
    }
  }
};

/**
 * COMMENTS SERVICES
 */
export const dbAddComment = async (issueId: string, comment: Omit<Comment, 'id' | 'createdAt'>): Promise<Comment> => {
  if (isLocalMode()) {
    initLocalStorageDb();
    const localComments = JSON.parse(localStorage.getItem('ch_local_comments') || '{}');
    if (!localComments[issueId]) localComments[issueId] = [];

    const newComment: Comment = {
      ...comment,
      id: `c-${Date.now()}`,
      createdAt: new Date().toISOString()
    };
    localComments[issueId].push(newComment);
    localStorage.setItem('ch_local_comments', JSON.stringify(localComments));
    return newComment;
  }

  try {
    const commentRef = doc(collection(db!, `issues/${issueId}/comments`));
    const newComment: Comment = {
      ...comment,
      id: commentRef.id,
      createdAt: new Date().toISOString()
    };
    await setDoc(commentRef, newComment);

    await updateDoc(doc(db!, 'issues', issueId), {
      updatedAt: new Date().toISOString()
    });

    return newComment;
  } catch (err: any) {
    console.warn('[Community Hero] Firestore dbAddComment failed, falling back to LocalStorage:', err);
    isFirebaseOffline = true;
    const localComments = JSON.parse(localStorage.getItem('ch_local_comments') || '{}');
    if (!localComments[issueId]) localComments[issueId] = [];
    const newComment: Comment = {
      ...comment,
      id: `c-${Date.now()}`,
      createdAt: new Date().toISOString()
    };
    localComments[issueId].push(newComment);
    localStorage.setItem('ch_local_comments', JSON.stringify(localComments));
    return newComment;
  }
};

export const dbGetComments = async (issueId: string): Promise<Comment[]> => {
  if (isLocalMode()) {
    initLocalStorageDb();
    const localComments = JSON.parse(localStorage.getItem('ch_local_comments') || '{}');
    return localComments[issueId] || [];
  }

  try {
    const q = query(collection(db!, `issues/${issueId}/comments`), orderBy('createdAt', 'asc'));
    const snap = await getDocs(q);
    const list: Comment[] = [];
    snap.forEach((docSnap) => {
      list.push(docSnap.data() as Comment);
    });
    return list;
  } catch (err) {
    console.warn('Firestore comments load failed, falling back to local.');
    const localComments = JSON.parse(localStorage.getItem('ch_local_comments') || '{}');
    return localComments[issueId] || [];
  }
};

/**
 * AUDIT TRAIL LOGS
 */
export const dbGetActivityLogs = async (issueId: string): Promise<ActivityLog[]> => {
  if (isLocalMode()) {
    initLocalStorageDb();
    const localLogs = JSON.parse(localStorage.getItem('ch_local_logs') || '{}');
    return localLogs[issueId] || [];
  }

  try {
    const q = query(collection(db!, `issues/${issueId}/activityLogs`), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    const list: ActivityLog[] = [];
    snap.forEach((docSnap) => {
      list.push(docSnap.data() as ActivityLog);
    });
    return list;
  } catch (err) {
    const localLogs = JSON.parse(localStorage.getItem('ch_local_logs') || '{}');
    return localLogs[issueId] || [];
  }
};

/**
 * DOUBLE-BLIND COMMUNITY VERIFICATION
 */
export const dbCreateVerificationRequest = async (
  issueId: string, 
  request: Omit<VerificationRequest, 'id' | 'votesVerified' | 'votesRejected' | 'voters' | 'createdAt' | 'status'>
): Promise<string> => {
  if (isLocalMode()) {
    initLocalStorageDb();
    const localVReqs = JSON.parse(localStorage.getItem('ch_local_vreqs') || '{}');
    if (!localVReqs[issueId]) localVReqs[issueId] = [];

    const id = `vr-${Date.now()}`;
    const newRequest: VerificationRequest = {
      ...request,
      id,
      votesVerified: 0,
      votesRejected: 0,
      voters: {},
      createdAt: new Date().toISOString(),
      status: 'Pending'
    };
    localVReqs[issueId].unshift(newRequest);
    localStorage.setItem('ch_local_vreqs', JSON.stringify(localVReqs));

    // Update Issue status
    await dbUpdateIssueStatus(issueId, 'Community Verification', request.officerId, request.officerName, {
      afterImageUrl: request.afterImageUrl,
      resolutionNotes: request.notes
    });

    return id;
  }

  try {
    const reqRef = doc(collection(db!, `issues/${issueId}/verificationRequests`));
    const newRequest: VerificationRequest = {
      ...request,
      id: reqRef.id,
      votesVerified: 0,
      votesRejected: 0,
      voters: {},
      createdAt: new Date().toISOString(),
      status: 'Pending'
    };
    await setDoc(reqRef, newRequest);

    await dbUpdateIssueStatus(issueId, 'Community Verification', request.officerId, request.officerName, {
      afterImageUrl: request.afterImageUrl,
      resolutionNotes: request.notes
    });

    return reqRef.id;
  } catch (err: any) {
    console.warn('[Community Hero] Firestore dbCreateVerificationRequest failed, falling back to LocalStorage:', err);
    isFirebaseOffline = true;
    const localVReqs = JSON.parse(localStorage.getItem('ch_local_vreqs') || '{}');
    if (!localVReqs[issueId]) localVReqs[issueId] = [];
    const id = `vr-${Date.now()}`;
    const newRequest: VerificationRequest = {
      ...request,
      id,
      votesVerified: 0,
      votesRejected: 0,
      voters: {},
      createdAt: new Date().toISOString(),
      status: 'Pending'
    };
    localVReqs[issueId].unshift(newRequest);
    localStorage.setItem('ch_local_vreqs', JSON.stringify(localVReqs));
    
    // Fallback status update
    const issues = getLocalIssues();
    const index = issues.findIndex(i => i.id === issueId);
    if (index !== -1) {
      issues[index] = {
        ...issues[index],
        status: 'Community Verification',
        updatedAt: new Date().toISOString(),
        afterImageUrl: request.afterImageUrl,
        resolutionNotes: request.notes
      };
      saveLocalIssues(issues);
    }
    return id;
  }
};

export const dbGetVerificationRequests = async (issueId: string): Promise<VerificationRequest[]> => {
  if (isLocalMode()) {
    initLocalStorageDb();
    const localVReqs = JSON.parse(localStorage.getItem('ch_local_vreqs') || '{}');
    return localVReqs[issueId] || [];
  }

  try {
    const q = query(collection(db!, `issues/${issueId}/verificationRequests`), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    const list: VerificationRequest[] = [];
    snap.forEach((docSnap) => {
      list.push(docSnap.data() as VerificationRequest);
    });
    return list;
  } catch (err) {
    const localVReqs = JSON.parse(localStorage.getItem('ch_local_vreqs') || '{}');
    return localVReqs[issueId] || [];
  }
};

export const dbVoteVerification = async (
  issueId: string,
  requestId: string,
  userId: string,
  verify: boolean // true = verify, false = dispute
): Promise<void> => {
  if (isLocalMode()) {
    initLocalStorageDb();
    const localVReqs = JSON.parse(localStorage.getItem('ch_local_vreqs') || '{}');
    const reqsList: VerificationRequest[] = localVReqs[issueId] || [];
    const index = reqsList.findIndex(r => r.id === requestId);
    if (index !== -1) {
      const request = reqsList[index];
      if (userId in request.voters) return; // already voted

      request.voters[userId] = verify;
      if (verify) {
        request.votesVerified += 1;
      } else {
        request.votesRejected += 1;
      }

      if (request.votesVerified >= 3) {
        request.status = 'Approved';
        await dbUpdateIssueStatus(issueId, 'Verified', 'community', 'Community Verification Success', {
          status: 'Verified'
        });
      } else if (request.votesRejected >= 2) {
        request.status = 'Disputed';
        await dbUpdateIssueStatus(issueId, 'Under Review', 'community', 'Community Dispute Initiated', {
          status: 'Under Review'
        });
      }

      localVReqs[issueId] = reqsList;
      localStorage.setItem('ch_local_vreqs', JSON.stringify(localVReqs));
    }
    return;
  }

  try {
    const reqRef = doc(db!, `issues/${issueId}/verificationRequests`, requestId);
    const snap = await getDoc(reqRef);
    if (!snap.exists()) return;

    const request = snap.data() as VerificationRequest;
    if (userId in request.voters) return;

    const updatedVoters = { ...request.voters, [userId]: verify };
    let votesVerified = request.votesVerified;
    let votesRejected = request.votesRejected;

    if (verify) {
      votesVerified += 1;
    } else {
      votesRejected += 1;
    }

    let status = request.status;
    if (votesVerified >= 3) {
      status = 'Approved';
      await dbUpdateIssueStatus(issueId, 'Verified', 'community', 'Community Consensus', {
        status: 'Verified'
      });
    } else if (votesRejected >= 2) {
      status = 'Disputed';
      await dbUpdateIssueStatus(issueId, 'Under Review', 'community', 'Community Rejection Audit', {
        status: 'Under Review'
      });
    }

    await updateDoc(reqRef, {
      voters: updatedVoters,
      votesVerified,
      votesRejected,
      status
    });
  } catch (err: any) {
    console.warn('[Community Hero] Firestore dbVoteVerification failed, falling back to LocalStorage:', err);
    isFirebaseOffline = true;
    const localVReqs = JSON.parse(localStorage.getItem('ch_local_vreqs') || '{}');
    const reqsList: VerificationRequest[] = localVReqs[issueId] || [];
    const index = reqsList.findIndex(r => r.id === requestId);
    if (index !== -1) {
      const request = reqsList[index];
      if (!(userId in request.voters)) {
        request.voters[userId] = verify;
        if (verify) {
          request.votesVerified += 1;
        } else {
          request.votesRejected += 1;
        }
        if (request.votesVerified >= 3) {
          request.status = 'Approved';
          const issues = getLocalIssues();
          const idx = issues.findIndex(i => i.id === issueId);
          if (idx !== -1) {
            issues[idx].status = 'Verified';
            saveLocalIssues(issues);
          }
        } else if (request.votesRejected >= 2) {
          request.status = 'Disputed';
          const issues = getLocalIssues();
          const idx = issues.findIndex(i => i.id === issueId);
          if (idx !== -1) {
            issues[idx].status = 'Under Review';
            saveLocalIssues(issues);
          }
        }
        localVReqs[issueId] = reqsList;
        localStorage.setItem('ch_local_vreqs', JSON.stringify(localVReqs));
      }
    }
  }
};

/**
 * NOTIFICATIONS
 */
export const dbGetMyNotifications = async (userId: string): Promise<Notification[]> => {
  if (isLocalMode()) {
    const localNotifs: Notification[] = JSON.parse(localStorage.getItem('ch_local_notifs') || '[]');
    return localNotifs.filter(n => n.userId === userId);
  }

  try {
    const q = query(
      collection(db!, 'notifications'),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc'),
      limit(25)
    );
    const snap = await getDocs(q);
    const list: Notification[] = [];
    snap.forEach((docSnap) => {
      list.push(docSnap.data() as Notification);
    });
    return list;
  } catch (err) {
    const localNotifs: Notification[] = JSON.parse(localStorage.getItem('ch_local_notifs') || '[]');
    return localNotifs.filter(n => n.userId === userId);
  }
};

export const dbMarkNotificationRead = async (id: string): Promise<void> => {
  if (isLocalMode()) {
    const localNotifs: Notification[] = JSON.parse(localStorage.getItem('ch_local_notifs') || '[]');
    const index = localNotifs.findIndex(n => n.id === id);
    if (index !== -1) {
      localNotifs[index].read = true;
      localStorage.setItem('ch_local_notifs', JSON.stringify(localNotifs));
    }
    return;
  }

  try {
    await updateDoc(doc(db!, 'notifications', id), { read: true });
  } catch (err: any) {
    console.warn('[Community Hero] Firestore dbMarkNotificationRead failed, falling back to LocalStorage:', err);
    isFirebaseOffline = true;
    const localNotifs: Notification[] = JSON.parse(localStorage.getItem('ch_local_notifs') || '[]');
    const index = localNotifs.findIndex(n => n.id === id);
    if (index !== -1) {
      localNotifs[index].read = true;
      localStorage.setItem('ch_local_notifs', JSON.stringify(localNotifs));
    }
  }
};

/**
 * CITIZEN PLEDGING FOR DIRECT ACTION (GAP SOLVER)
 */
export const dbAddCommunityPledge = async (
  issueId: string, 
  pledge: { userId: string; userName: string; hours?: number; pledgeType: 'labor' | 'supplies' | 'cleanup' | 'donation'; notes?: string }
): Promise<void> => {
  if (isLocalMode()) {
    const issues = getLocalIssues();
    const idx = issues.findIndex(i => i.id === issueId);
    if (idx !== -1) {
      if (!issues[idx].communityPledges) {
        issues[idx].communityPledges = [];
      }
      issues[idx].communityPledges!.push(pledge);
      issues[idx].updatedAt = new Date().toISOString();
      saveLocalIssues(issues);

      // Log in Audit Trail
      const localLogs = JSON.parse(localStorage.getItem('ch_local_logs') || '{}');
      if (!localLogs[issueId]) localLogs[issueId] = [];
      localLogs[issueId].push({
        id: `log-${Date.now()}`,
        issueId,
        userId: pledge.userId,
        userName: pledge.userName,
        action: `Pledged support: ${pledge.pledgeType.toUpperCase()} ${pledge.hours ? `(${pledge.hours} hours)` : ''} - "${pledge.notes || ''}"`,
        createdAt: new Date().toISOString()
      });
      localStorage.setItem('ch_local_logs', JSON.stringify(localLogs));
    }
    return;
  }

  try {
    const issueRef = doc(db!, 'issues', issueId);
    const snap = await getDoc(issueRef);
    if (snap.exists()) {
      const issueData = snap.data() as Issue;
      const pledges = issueData.communityPledges || [];
      pledges.push(pledge);
      await updateDoc(issueRef, {
        communityPledges: pledges,
        updatedAt: new Date().toISOString()
      });

      // Write Activity Log
      const logRef = doc(collection(db!, `issues/${issueId}/activityLogs`));
      await setDoc(logRef, {
        id: logRef.id,
        issueId,
        userId: pledge.userId,
        userName: pledge.userName,
        action: `Pledged support: ${pledge.pledgeType.toUpperCase()} ${pledge.hours ? `(${pledge.hours} hours)` : ''} - "${pledge.notes || ''}"`,
        createdAt: new Date().toISOString()
      });
    }
  } catch (err: any) {
    console.warn('[Community Hero] Firestore dbAddCommunityPledge failed, falling back to LocalStorage:', err);
    isFirebaseOffline = true;
    const issues = getLocalIssues();
    const idx = issues.findIndex(i => i.id === issueId);
    if (idx !== -1) {
      if (!issues[idx].communityPledges) {
        issues[idx].communityPledges = [];
      }
      issues[idx].communityPledges!.push(pledge);
      saveLocalIssues(issues);
    }
  }
};

/**
 * AI MATERIALS ESTIMATE FEEDBACK (GAP SOLVER)
 */
export const dbUpdateMaterialsEstimate = async (
  issueId: string,
  materialsEstimate: Issue['materialsEstimate']
): Promise<void> => {
  if (isLocalMode()) {
    const issues = getLocalIssues();
    const idx = issues.findIndex(i => i.id === issueId);
    if (idx !== -1) {
      issues[idx].materialsEstimate = materialsEstimate;
      issues[idx].updatedAt = new Date().toISOString();
      saveLocalIssues(issues);
    }
    return;
  }

  try {
    const issueRef = doc(db!, 'issues', issueId);
    await updateDoc(issueRef, {
      materialsEstimate,
      updatedAt: new Date().toISOString()
    });
  } catch (err: any) {
    console.warn('[Community Hero] Firestore dbUpdateMaterialsEstimate failed, falling back to LocalStorage:', err);
    isFirebaseOffline = true;
    const issues = getLocalIssues();
    const idx = issues.findIndex(i => i.id === issueId);
    if (idx !== -1) {
      issues[idx].materialsEstimate = materialsEstimate;
      saveLocalIssues(issues);
    }
  }
};

