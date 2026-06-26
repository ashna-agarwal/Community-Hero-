import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  addDoc, 
  updateDoc, 
  query, 
  where, 
  orderBy, 
  limit, 
  Timestamp 
} from 'firebase/firestore';
import { db } from '../firebase';
import { Issue, Comment, Notification, ActivityLog, VerificationRequest, UserProfile } from '../types';

// Generic error handler
const handleDBError = (action: string, error: any) => {
  console.error(`Database Error during [${action}]:`, error);
  throw new Error(`Database operations failed during ${action}: ${error.message || error}`);
};

/**
 * ISSUES collection services
 */
export const dbCreateIssue = async (issue: Omit<Issue, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> => {
  if (!db) throw new Error('Firestore is not initialized');
  try {
    const issueRef = doc(collection(db, 'issues'));
    const newIssue: Issue = {
      ...issue,
      id: issueRef.id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    await setDoc(issueRef, newIssue);

    // Write initial Activity Log
    const logRef = doc(collection(db, `issues/${issueRef.id}/activityLogs`));
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
    const notifRef = doc(collection(db, 'notifications'));
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
  } catch (err) {
    return handleDBError('createIssue', err);
  }
};

export const dbGetIssues = async (): Promise<Issue[]> => {
  if (!db) return [];
  try {
    const q = query(collection(db, 'issues'), orderBy('createdAt', 'desc'));
    const querySnapshot = await getDocs(q);
    const list: Issue[] = [];
    querySnapshot.forEach((docSnap) => {
      list.push(docSnap.data() as Issue);
    });
    return list;
  } catch (err) {
    return handleDBError('getIssues', err);
  }
};

export const dbGetMyIssues = async (userId: string): Promise<Issue[]> => {
  if (!db) return [];
  try {
    const q = query(
      collection(db, 'issues'), 
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
    return handleDBError('getMyIssues', err);
  }
};

export const dbGetIssueById = async (id: string): Promise<Issue | null> => {
  if (!db) return null;
  try {
    const docSnap = await getDoc(doc(db, 'issues', id));
    return docSnap.exists() ? (docSnap.data() as Issue) : null;
  } catch (err) {
    return handleDBError('getIssueById', err);
  }
};

export const dbUpdateIssueStatus = async (
  issueId: string, 
  status: Issue['status'], 
  actorId: string, 
  actorName: string,
  extraData?: Partial<Issue>
): Promise<void> => {
  if (!db) throw new Error('Firestore is not initialized');
  try {
    const issueRef = doc(db, 'issues', issueId);
    const updatePayload: Partial<Issue> = {
      status,
      updatedAt: new Date().toISOString(),
      ...extraData
    };
    await updateDoc(issueRef, updatePayload);

    // Audit Trail Log
    const logRef = doc(collection(db, `issues/${issueId}/activityLogs`));
    const log: ActivityLog = {
      id: logRef.id,
      issueId,
      userId: actorId,
      userName: actorName,
      action: `Status updated to [${status}].`,
      createdAt: new Date().toISOString()
    };
    await setDoc(logRef, log);

    // Create Notification for the reporter
    const issueSnap = await getDoc(issueRef);
    if (issueSnap.exists()) {
      const issueData = issueSnap.data() as Issue;
      const notifRef = doc(collection(db, 'notifications'));
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
  } catch (err) {
    handleDBError('updateIssueStatus', err);
  }
};

export const dbSupportIssue = async (issueId: string, userId: string): Promise<void> => {
  if (!db) throw new Error('Firestore is not initialized');
  try {
    const issueRef = doc(db, 'issues', issueId);
    const snap = await getDoc(issueRef);
    if (!snap.exists()) return;

    const issue = snap.data() as Issue;
    if (issue.voters.includes(userId)) {
      // Already voted
      return;
    }

    const updatedVoters = [...issue.voters, userId];
    await updateDoc(issueRef, {
      voters: updatedVoters,
      votesCount: updatedVoters.length,
      updatedAt: new Date().toISOString()
    });
  } catch (err) {
    handleDBError('supportIssue', err);
  }
};

/**
 * COMMENTS nested subcollection
 */
export const dbAddComment = async (issueId: string, comment: Omit<Comment, 'id' | 'createdAt'>): Promise<Comment> => {
  if (!db) throw new Error('Firestore is not initialized');
  try {
    const commentRef = doc(collection(db, `issues/${issueId}/comments`));
    const newComment: Comment = {
      ...comment,
      id: commentRef.id,
      createdAt: new Date().toISOString()
    };
    await setDoc(commentRef, newComment);

    // Also update main Issue updatedAt timestamp
    await updateDoc(doc(db, 'issues', issueId), {
      updatedAt: new Date().toISOString()
    });

    // Notify issue reporter if they are not the comment author
    const issueSnap = await getDoc(doc(db, 'issues', issueId));
    if (issueSnap.exists()) {
      const issueData = issueSnap.data() as Issue;
      if (issueData.reporterId !== comment.userId) {
        const notifRef = doc(collection(db, 'notifications'));
        const notif: Notification = {
          id: notifRef.id,
          userId: issueData.reporterId,
          title: 'New Discussion Comment',
          message: `${comment.userName} commented on "${issueData.title}".`,
          issueId,
          type: 'Comment Added',
          read: false,
          createdAt: new Date().toISOString()
        };
        await setDoc(notifRef, notif);
      }
    }

    return newComment;
  } catch (err) {
    return handleDBError('addComment', err);
  }
};

export const dbGetComments = async (issueId: string): Promise<Comment[]> => {
  if (!db) return [];
  try {
    const q = query(collection(db, `issues/${issueId}/comments`), orderBy('createdAt', 'asc'));
    const snap = await getDocs(q);
    const list: Comment[] = [];
    snap.forEach((docSnap) => {
      list.push(docSnap.data() as Comment);
    });
    return list;
  } catch (err) {
    return handleDBError('getComments', err);
  }
};

/**
 * ACTIVITY LOGS
 */
export const dbGetActivityLogs = async (issueId: string): Promise<ActivityLog[]> => {
  if (!db) return [];
  try {
    const q = query(collection(db, `issues/${issueId}/activityLogs`), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    const list: ActivityLog[] = [];
    snap.forEach((docSnap) => {
      list.push(docSnap.data() as ActivityLog);
    });
    return list;
  } catch (err) {
    return handleDBError('getActivityLogs', err);
  }
};

/**
 * VERIFICATION REQUESTS
 */
export const dbCreateVerificationRequest = async (
  issueId: string, 
  request: Omit<VerificationRequest, 'id' | 'votesVerified' | 'votesRejected' | 'voters' | 'createdAt' | 'status'>
): Promise<string> => {
  if (!db) throw new Error('Firestore is not initialized');
  try {
    const reqRef = doc(collection(db, `issues/${issueId}/verificationRequests`));
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

    // Update Issue status to 'Community Verification'
    await dbUpdateIssueStatus(issueId, 'Community Verification', request.officerId, request.officerName, {
      afterImageUrl: request.afterImageUrl,
      resolutionNotes: request.notes
    });

    return reqRef.id;
  } catch (err) {
    return handleDBError('createVerificationRequest', err);
  }
};

export const dbGetVerificationRequests = async (issueId: string): Promise<VerificationRequest[]> => {
  if (!db) return [];
  try {
    const q = query(collection(db, `issues/${issueId}/verificationRequests`), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    const list: VerificationRequest[] = [];
    snap.forEach((docSnap) => {
      list.push(docSnap.data() as VerificationRequest);
    });
    return list;
  } catch (err) {
    return handleDBError('getVerificationRequests', err);
  }
};

export const dbVoteVerification = async (
  issueId: string,
  requestId: string,
  userId: string,
  verify: boolean // true = verify, false = dispute
): Promise<void> => {
  if (!db) throw new Error('Firestore is not initialized');
  try {
    const reqRef = doc(db, `issues/${issueId}/verificationRequests`, requestId);
    const snap = await getDoc(reqRef);
    if (!snap.exists()) return;

    const request = snap.data() as VerificationRequest;
    if (userId in request.voters) {
      // Already voted
      return;
    }

    const updatedVoters = { ...request.voters, [userId]: verify };
    let votesVerified = request.votesVerified;
    let votesRejected = request.votesRejected;

    if (verify) {
      votesVerified += 1;
    } else {
      votesRejected += 1;
    }

    let status = request.status;
    // Simple double-blind threshold logic
    // e.g. If verified gets to 3, approve automatically. If disputes reach 2, flag as disputed.
    if (votesVerified >= 3) {
      status = 'Approved';
      // Mark parent Issue as verified and closed!
      await dbUpdateIssueStatus(issueId, 'Verified', 'community', 'Community Consensus', {
        status: 'Verified'
      });
    } else if (votesRejected >= 2) {
      status = 'Disputed';
      // Put parent Issue back 'Under Review' so officers can re-inspect
      await dbUpdateIssueStatus(issueId, 'Under Review', 'community', 'Community Rejection Audit');
    }

    await updateDoc(reqRef, {
      voters: updatedVoters,
      votesVerified,
      votesRejected,
      status
    });

  } catch (err) {
    handleDBError('voteVerification', err);
  }
};

/**
 * NOTIFICATIONS
 */
export const dbGetMyNotifications = async (userId: string): Promise<Notification[]> => {
  if (!db) return [];
  try {
    const q = query(
      collection(db, 'notifications'),
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
    return handleDBError('getMyNotifications', err);
  }
};

export const dbMarkNotificationRead = async (id: string): Promise<void> => {
  if (!db) return;
  try {
    await updateDoc(doc(db, 'notifications', id), { read: true });
  } catch (err) {
    handleDBError('markNotificationRead', err);
  }
};
