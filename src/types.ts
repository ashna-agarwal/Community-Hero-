/**
 * Centralized Type Contracts for Community Hero
 */

export type UserRole = 'Citizen' | 'Officer' | 'Department Head' | 'Super Admin';

export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  photoURL?: string;
  role: UserRole;
  reputation: number;
  badges: string[];
  departmentId?: string; // Optional: Only for Officers and Department Heads
  createdAt: string;
  updatedAt: string;
}

export type IssueStatus =
  | 'Submitted'
  | 'AI Analysis'
  | 'Department Assigned'
  | 'Under Review'
  | 'In Progress'
  | 'Resolved'
  | 'Community Verification'
  | 'Verified'
  | 'Closed';

export type IssueSeverity = 'Low' | 'Medium' | 'High' | 'Critical';
export type IssuePriority = 'Low' | 'Medium' | 'High' | 'Critical';

export interface Issue {
  id: string;
  title: string;
  description: string;
  category: string;
  department: string;
  status: IssueStatus;
  severity: IssueSeverity;
  priority: IssuePriority;
  lat: number;
  lng: number;
  address: string;
  imageUrl?: string;
  voiceNoteUrl?: string;
  voiceTranscript?: string;
  reporterId: string;
  reporterName: string;
  votesCount: number;
  voters: string[]; // UIDs of users who supported
  assignedOfficerId?: string;
  assignedOfficerName?: string;
  beforeImageUrl?: string;
  afterImageUrl?: string;
  resolutionNotes?: string;
  createdAt: string;
  updatedAt: string;
  
  // GAP Gaps Specific additions
  priorityScore?: number;            // Dynamic Civic Priority Score (0-100)
  credibilityScore?: number;         // AI Trust Engine Score (0-100)
  credibilityExplanation?: string;   // Image authenticity analysis explanation
  escalationLevel?: number;          // 0: Normal, 1: Senior Officer, 2: Department Head, 3: District Authority, 4: Public Alert
  escalationDate?: string;           // Timestamp of last escalation action
  isMerged?: boolean;                // Flag for duplicate aggregator
  mergedWithId?: string;             // Parent issue ID if merged
  affectedCount?: number;            // Counter representing original duplicates + supporters
  actionClassification?: 'In the Works' | 'Action Pending' | 'Ignored / Delayed';
  progressPercent?: number;
  
  // Gaps Solved Differentiating Features
  materialsEstimate?: {
    cost: number;
    items: Array<{ name: string; qty: number; unit: string; cost: number }>;
  };
  communityPledges?: Array<{
    userId: string;
    userName: string;
    hours?: number;
    pledgeType: 'labor' | 'supplies' | 'cleanup' | 'donation';
    notes?: string;
  }>;
}

export interface Comment {
  id: string;
  issueId: string;
  userId: string;
  userName: string;
  userPhotoURL?: string;
  userRole: UserRole;
  text: string;
  createdAt: string;
}

export type NotificationType =
  | 'Issue Assigned'
  | 'Status Changed'
  | 'Comment Added'
  | 'Verification Requested'
  | 'Issue Resolved';

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  issueId?: string;
  type: NotificationType;
  read: boolean;
  createdAt: string;
}

export interface Department {
  id: string;
  name: string;
  officerCount: number;
  resolvedCount: number;
  activeCount: number;
}

export interface ActivityLog {
  id: string;
  issueId: string;
  userId: string;
  userName: string;
  action: string;
  createdAt: string;
}

export interface VerificationRequest {
  id: string;
  issueId: string;
  officerId: string;
  officerName: string;
  afterImageUrl: string;
  notes: string;
  votesVerified: number;
  votesRejected: number;
  voters: Record<string, boolean>; // userId -> true (verify) / false (dispute)
  createdAt: string;
  status: 'Pending' | 'Approved' | 'Disputed';
}

export interface DepartmentPerformance {
  department: string;
  assigned: number;
  resolved: number;
  avgTimeHours: number;
}

export interface AnalyticsSummary {
  totalIssues: number;
  activeIssues: number;
  resolutionRate: number;
  avgResolutionTimeHours: number;
  categoryDistribution: Record<string, number>;
  monthlyTrends: Array<{ month: string; reported: number; resolved: number }>;
}
