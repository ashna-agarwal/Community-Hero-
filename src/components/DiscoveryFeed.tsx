import React, { useState, useEffect } from 'react';
import { 
  Search, 
  Filter, 
  MapPin, 
  ThumbsUp, 
  MessageSquare, 
  Clock, 
  Building, 
  AlertTriangle, 
  CheckCircle2, 
  ArrowRight, 
  ChevronRight, 
  User, 
  Calendar, 
  X, 
  Activity, 
  Plus, 
  MessageCircle,
  ThumbsDown,
  Loader2,
  Award,
  Volume2,
  Info,
  Shield,
  Users,
  Heart,
  Wrench,
  DollarSign,
  Coins
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { 
  dbGetIssues, 
  dbSupportIssue, 
  dbGetComments, 
  dbAddComment, 
  dbGetActivityLogs, 
  dbGetVerificationRequests, 
  dbVoteVerification,
  dbUpdateIssueStatus,
  dbAddCommunityPledge,
  dbUpdateMaterialsEstimate
} from '../services/dbService';
import { Issue, Comment, ActivityLog, VerificationRequest } from '../types';
import { getIssueActionClassification, ActionClassification } from '../services/classificationService';
import { motion, AnimatePresence } from 'motion/react';

interface DiscoveryFeedProps {
  onReportNew: () => void;
  selectedIssueId?: string | null;
  onClearSelectedIssue?: () => void;
}

export const DiscoveryFeed: React.FC<DiscoveryFeedProps> = ({ 
  onReportNew, 
  selectedIssueId, 
  onClearSelectedIssue 
}) => {
  const { profile, updateReputation, addBadge } = useAuth();

  // Feed states
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedStatus, setSelectedStatus] = useState<string>('All');
  const [selectedActionFilter, setSelectedActionFilter] = useState<string>('All');

  // Detailed view states
  const [activeIssue, setActiveIssue] = useState<Issue | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [isCommenting, setIsCommenting] = useState(false);
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [verificationRequest, setVerificationRequest] = useState<VerificationRequest | null>(null);
  const [isVotingConsensus, setIsVotingConsensus] = useState(false);

  // GAPS solved states
  const [pledgeType, setPledgeType] = useState<'labor' | 'supplies' | 'cleanup' | 'donation'>('labor');
  const [pledgeHours, setPledgeHours] = useState<number>(3);
  const [pledgeNotes, setPledgeNotes] = useState('');
  const [showPledgeForm, setShowPledgeForm] = useState(false);
  const [isPledging, setIsPledging] = useState(false);

  const [showEstimateForm, setShowEstimateForm] = useState(false);
  const [suggestedItemName, setSuggestedItemName] = useState('');
  const [suggestedItemCost, setSuggestedItemCost] = useState('');
  const [suggestedItemQty, setSuggestedItemQty] = useState('1');
  const [suggestedItemUnit, setSuggestedItemUnit] = useState('units');

  // Fetch all issues
  const loadIssues = async () => {
    setLoading(true);
    try {
      const data = await dbGetIssues();
      setIssues(data);
      
      // If there's a pre-selected issue (e.g., from report submission), load it immediately
      if (selectedIssueId) {
        const found = data.find(i => i.id === selectedIssueId);
        if (found) {
          handleSelectIssue(found);
        }
      }
    } catch (err) {
      console.error('Error loading issues:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadIssues();
  }, [selectedIssueId]);

  // Load nested collections for details panel
  const handleSelectIssue = async (issue: Issue) => {
    setActiveIssue(issue);
    try {
      // Parallelize child loads
      const [commentList, logList, verificationList] = await Promise.all([
        dbGetComments(issue.id),
        dbGetActivityLogs(issue.id),
        dbGetVerificationRequests(issue.id)
      ]);
      setComments(commentList);
      setLogs(logList);
      if (verificationList.length > 0) {
        setVerificationRequest(verificationList[0]);
      } else {
        setVerificationRequest(null);
      }
    } catch (err) {
      console.error('Error fetching issue sub-elements:', err);
    }
  };

  const handleSupport = async (issueId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!profile) return;

    // Save previous state for rollback on error
    const previousIssues = [...issues];
    const previousActiveIssue = activeIssue ? { ...activeIssue } : null;

    // Optimistically update issues state
    const updatedIssues = issues.map(issue => {
      if (issue.id === issueId) {
        const isVoted = issue.voters.includes(profile.uid);
        const nextVoters = isVoted 
          ? issue.voters.filter(uid => uid !== profile.uid) 
          : [...issue.voters, profile.uid];
        return {
          ...issue,
          voters: nextVoters,
          votesCount: nextVoters.length
        };
      }
      return issue;
    });
    setIssues(updatedIssues);

    // Optimistically update active issue if currently loaded
    if (activeIssue && activeIssue.id === issueId) {
      const isVoted = activeIssue.voters.includes(profile.uid);
      const nextVoters = isVoted
        ? activeIssue.voters.filter(uid => uid !== profile.uid)
        : [...activeIssue.voters, profile.uid];
      setActiveIssue({
        ...activeIssue,
        voters: nextVoters,
        votesCount: nextVoters.length
      });
    }

    try {
      await dbSupportIssue(issueId, profile.uid);
      // Award minor reward points for civic support
      await updateReputation(2);
      await addBadge('Active Supporter');
      
      // Quietly fetch the authoritative server state without triggering loading spinners
      const data = await dbGetIssues();
      setIssues(data);
      if (activeIssue && activeIssue.id === issueId) {
        const found = data.find(i => i.id === issueId);
        if (found) setActiveIssue(found);
      }
    } catch (err) {
      console.error('[Community Hero] Support transaction failed. Rolling back optimistic states:', err);
      // Rollback to previous state on failure
      setIssues(previousIssues);
      if (previousActiveIssue) {
        setActiveIssue(previousActiveIssue);
      }
    }
  };

  const handleCreatePledge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !activeIssue) return;
    setIsPledging(true);
    try {
      const pledge = {
        userId: profile.uid,
        userName: profile.name,
        hours: ['labor', 'cleanup'].includes(pledgeType) ? pledgeHours : undefined,
        pledgeType,
        notes: pledgeNotes
      };
      await dbAddCommunityPledge(activeIssue.id, pledge);
      await updateReputation(15);
      await addBadge('Local Activist');
      
      // Reset form
      setPledgeNotes('');
      setShowPledgeForm(false);
      
      // Refresh current issue and list
      const data = await dbGetIssues();
      setIssues(data);
      const found = data.find(i => i.id === activeIssue.id);
      if (found) {
        setActiveIssue(found);
        const logList = await dbGetActivityLogs(found.id);
        setLogs(logList);
      }
    } catch (err) {
      console.error('Error creating pledge:', err);
    } finally {
      setIsPledging(false);
    }
  };

  const handleProposeMaterialItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !activeIssue || !suggestedItemName.trim() || !suggestedItemCost.trim()) return;
    
    try {
      const unitCost = parseFloat(suggestedItemCost);
      const qty = parseFloat(suggestedItemQty) || 1;
      if (isNaN(unitCost)) return;

      const currentEstimate = activeIssue.materialsEstimate || { cost: 0, items: [] };
      const newItem = {
        name: suggestedItemName,
        qty,
        unit: suggestedItemUnit,
        cost: unitCost * qty
      };
      
      const updatedItems = [...currentEstimate.items, newItem];
      const updatedCost = updatedItems.reduce((acc, curr) => acc + curr.cost, 0);
      
      const newEstimate = {
        cost: updatedCost,
        items: updatedItems
      };

      await dbUpdateMaterialsEstimate(activeIssue.id, newEstimate);
      await updateReputation(5);

      // Reset Form
      setSuggestedItemName('');
      setSuggestedItemCost('');
      setSuggestedItemQty('1');
      setShowEstimateForm(false);

      // Refresh current issue and list
      const data = await dbGetIssues();
      setIssues(data);
      const found = data.find(i => i.id === activeIssue.id);
      if (found) {
        setActiveIssue(found);
        const logList = await dbGetActivityLogs(found.id);
        setLogs(logList);
      }
    } catch (err) {
      console.error('Error proposing material item:', err);
    }
  };

  const handlePostComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !activeIssue || !newComment.trim()) return;

    setIsCommenting(true);
    try {
      const added = await dbAddComment(activeIssue.id, {
        issueId: activeIssue.id,
        userId: profile.uid,
        userName: profile.name,
        userRole: profile.role,
        text: newComment
      });

      setComments(prev => [...prev, added]);
      setNewComment('');
      // Award contribution points
      await updateReputation(1);
      
      // Refresh logs
      const updatedLogs = await dbGetActivityLogs(activeIssue.id);
      setLogs(updatedLogs);
    } catch (err) {
      console.error(err);
    } finally {
      setIsCommenting(false);
    }
  };

  const handleVoteConsensus = async (verify: boolean) => {
    if (!profile || !activeIssue || !verificationRequest) return;

    setIsVotingConsensus(true);
    try {
      await dbVoteVerification(activeIssue.id, verificationRequest.id, profile.uid, verify);
      await updateReputation(10); // Higher points for consensus auditing!
      await addBadge('Civic Auditor');
      alert(`Consensus vote recorded: ${verify ? 'Verified' : 'Disputed'}. Thank you for verifying resolution!`);
      
      // Refresh details
      const updatedIssues = await dbGetIssues();
      const current = updatedIssues.find(i => i.id === activeIssue.id);
      if (current) {
        setActiveIssue(current);
        const [commentList, logList, verifications] = await Promise.all([
          dbGetComments(current.id),
          dbGetActivityLogs(current.id),
          dbGetVerificationRequests(current.id)
        ]);
        setComments(commentList);
        setLogs(logList);
        if (verifications.length > 0) setVerificationRequest(verifications[0]);
      }
      loadIssues();
    } catch (err) {
      console.error(err);
    } finally {
      setIsVotingConsensus(false);
    }
  };

  const closeDetailPanel = () => {
    setActiveIssue(null);
    setComments([]);
    setLogs([]);
    setVerificationRequest(null);
    if (onClearSelectedIssue) onClearSelectedIssue();
  };

  // Filters logic
  const filteredIssues = issues.filter(issue => {
    const matchesSearch = 
      issue.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
      issue.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      issue.department.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesCategory = selectedCategory === 'All' || issue.category === selectedCategory;
    const matchesStatus = selectedStatus === 'All' || issue.status === selectedStatus;

    const actionDetail = getIssueActionClassification(issue);
    const matchesAction = selectedActionFilter === 'All' || actionDetail.status === selectedActionFilter;

    return matchesSearch && matchesCategory && matchesStatus && matchesAction;
  });

  const getStatusBadgeClass = (status: Issue['status']) => {
    switch (status) {
      case 'Submitted': return 'bg-purple-50 text-purple-700 border-purple-100';
      case 'AI Analysis': return 'bg-indigo-50 text-indigo-700 border-indigo-100';
      case 'Department Assigned': return 'bg-blue-50 text-blue-700 border-blue-100';
      case 'Under Review': return 'bg-amber-50 text-amber-700 border-amber-100';
      case 'In Progress': return 'bg-sky-50 text-sky-700 border-sky-100';
      case 'Resolved': return 'bg-emerald-50 text-emerald-700 border-emerald-100';
      case 'Community Verification': return 'bg-orange-50 text-orange-700 border-orange-100 animate-pulse';
      case 'Verified': return 'bg-green-50 text-green-700 border-green-100';
      case 'Closed': return 'bg-slate-100 text-slate-700 border-slate-200';
      default: return 'bg-slate-50 text-slate-600 border-slate-100';
    }
  };

  const getSeverityBadgeClass = (severity: Issue['severity']) => {
    switch (severity) {
      case 'Low': return 'bg-slate-100 text-slate-700';
      case 'Medium': return 'bg-blue-100 text-blue-700';
      case 'High': return 'bg-orange-100 text-orange-700';
      case 'Critical': return 'bg-red-100 text-red-700 animate-pulse font-bold';
      default: return 'bg-slate-100 text-slate-700';
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6" id="discovery-grid-wrapper">
      
      {/* LEFT OR MAIN: Issue Catalog Feed (lg:col-span-7) */}
      <div className={`lg:col-span-7 space-y-3 sm:space-y-4 ${activeIssue ? 'hidden lg:block' : 'block'}`} id="issues-list-section">
        {/* Filter bar card */}
        <div className="bg-white border border-slate-100 rounded-2xl p-3 sm:p-4 shadow-xs space-y-2.5 sm:space-y-3" id="feed-filter-card">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input 
                type="text" 
                placeholder="Search issues, department, tags..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:border-blue-500"
              />
            </div>
            {profile?.role === 'Citizen' && (
              <button 
                onClick={onReportNew}
                className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-2.5 sm:px-3 py-2 rounded-xl text-xs flex items-center gap-1.5 shrink-0 transition-all shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Report Issue</span>
                <span className="inline sm:hidden">Report</span>
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-1" id="filter-pill-selectors">
            {/* Category Select */}
            <div className="flex items-center gap-1 sm:gap-1.5">
              <span className="text-[9px] sm:text-[10px] uppercase font-bold text-slate-400 shrink-0">Category:</span>
              <select 
                value={selectedCategory} 
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="bg-slate-50 border border-slate-200 text-slate-600 text-[10px] sm:text-[11px] font-semibold rounded-lg px-1.5 py-1"
              >
                <option value="All">All Categories</option>
                <option value="Potholes & Roads">Potholes & Roads</option>
                <option value="Waste & Sanitation">Waste & Sanitation</option>
                <option value="Streetlights & Electricity">Streetlights & Electricity</option>
                <option value="Water & Sewage">Water & Sewage</option>
                <option value="Public Parks">Public Parks</option>
                <option value="Vandalism & Graffiti">Vandalism & Graffiti</option>
                <option value="Other">Other</option>
              </select>
            </div>

            {/* Status Select */}
            <div className="flex items-center gap-1 sm:gap-1.5">
              <span className="text-[9px] sm:text-[10px] uppercase font-bold text-slate-400 shrink-0">Status:</span>
              <select 
                value={selectedStatus} 
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="bg-slate-50 border border-slate-200 text-slate-600 text-[10px] sm:text-[11px] font-semibold rounded-lg px-1.5 py-1"
              >
                <option value="All">All Statuses</option>
                <option value="Submitted">Submitted</option>
                <option value="Department Assigned">Dept Assigned</option>
                <option value="Under Review">Under Review</option>
                <option value="In Progress">In Progress</option>
                <option value="Community Verification">Community Verification</option>
                <option value="Verified">Verified</option>
                <option value="Closed">Closed</option>
              </select>
            </div>

            {/* Action Responsiveness Select */}
            <div className="flex items-center gap-1 sm:gap-1.5">
              <span className="text-[9px] sm:text-[10px] uppercase font-bold text-slate-400 shrink-0">Action:</span>
              <select 
                value={selectedActionFilter} 
                onChange={(e) => setSelectedActionFilter(e.target.value)}
                className="bg-slate-50 border border-slate-200 text-slate-600 text-[10px] sm:text-[11px] font-semibold rounded-lg px-1.5 py-1"
              >
                <option value="All">All Actions</option>
                <option value="In the Works">In the Works (Active)</option>
                <option value="Action Pending">Action Pending</option>
                <option value="Ignored / Delayed">Ignored / Delayed</option>
              </select>
            </div>
          </div>
        </div>

        {/* Catalog List */}
        {loading ? (
          <div className="py-12 text-center" id="feed-loader">
            <Loader2 className="w-8 h-8 text-blue-500 animate-spin mx-auto mb-2" />
            <p className="text-xs text-slate-500 font-medium">Loading municipal reports registry...</p>
          </div>
        ) : filteredIssues.length === 0 ? (
          <div className="bg-white border border-slate-100 rounded-2xl p-12 text-center text-slate-400" id="empty-feed">
            <div className="p-3 bg-slate-50 text-slate-400 rounded-full w-fit mx-auto mb-3">
              <Search className="w-6 h-6" />
            </div>
            <h4 className="text-sm font-semibold text-slate-700">No community issues found</h4>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
              Try altering your keywords or filters. If you notice a neighborhood damage, log it now!
            </p>
          </div>
        ) : (
          <div className="space-y-3" id="issues-cards-container">
            {filteredIssues.map((issue) => (
              <div 
                key={issue.id}
                onClick={() => handleSelectIssue(issue)}
                className={`p-3 sm:p-4 bg-white border rounded-2xl shadow-xs transition-all duration-200 cursor-pointer text-left hover:border-blue-400 hover:shadow-md flex gap-3 sm:gap-4 ${
                  activeIssue?.id === issue.id ? 'border-blue-500 ring-2 ring-blue-50/50' : 'border-slate-100'
                }`}
              >
                {/* Photo thumbnail */}
                {issue.imageUrl ? (
                  <div className="w-16 h-16 sm:w-20 sm:h-20 bg-slate-100 rounded-xl shrink-0 overflow-hidden border border-slate-200/50">
                    <img 
                      src={issue.imageUrl} 
                      alt="issue thumbnail" 
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                        e.currentTarget.onerror = null;
                        e.currentTarget.src = 'https://images.unsplash.com/photo-1541888946425-d81bb19240f5?auto=format&fit=crop&w=300&q=80';
                      }}
                    />
                  </div>
                ) : (
                  <div className="w-16 h-16 sm:w-20 sm:h-20 bg-slate-50 rounded-xl shrink-0 flex items-center justify-center text-slate-300 border border-slate-200/50">
                    <MapPin className="w-5 h-5 sm:w-6 h-6" />
                  </div>
                )}

                {/* Info block */}
                <div className="flex-1 min-w-0 flex flex-col justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border ${getStatusBadgeClass(issue.status)}`}>
                        {issue.status}
                      </span>
                      <span className={`px-1.5 py-0.5 rounded-md text-[9px] font-semibold ${getSeverityBadgeClass(issue.severity)}`}>
                        {issue.severity}
                      </span>
                      <span className="text-[9px] sm:text-[10px] text-slate-400 font-mono truncate max-w-[100px] sm:max-w-[120px] ml-auto">
                        #{issue.id.slice(0, 6)}
                      </span>
                    </div>

                    <h3 className="text-xs sm:text-sm font-bold text-slate-900 mt-1 sm:mt-1.5 truncate">
                      {issue.title}
                    </h3>
                    
                    <p className="text-[11px] sm:text-xs text-slate-500 line-clamp-1 mt-0.5 sm:mt-1 leading-normal">
                      {issue.description}
                    </p>

                    {/* Dynamic Action State Responsiveness Indicator */}
                    {(() => {
                      const action = getIssueActionClassification(issue);
                      return (
                        <div className={`mt-2 flex items-center gap-1 sm:gap-1.5 px-1.5 py-0.5 sm:px-2 sm:py-1 rounded-lg border ${action.bgColor} ${action.textColor} text-[9px] sm:text-[10px] font-semibold w-fit max-w-full`}>
                          <span className={`w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full ${action.badgeColor}`} />
                          <span className="shrink-0">{action.label}</span>
                          <span className="text-slate-300 font-normal">|</span>
                          <span className="opacity-85 font-normal truncate">{action.reason}</span>
                        </div>
                      );
                    })()}
                  </div>

                  <div className="flex items-center justify-between text-[9px] sm:text-[10px] text-slate-400 mt-2 border-t border-slate-50 pt-2">
                    <div className="flex items-center gap-1 min-w-0">
                      <Building className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="font-semibold text-slate-500 truncate max-w-[80px] sm:max-w-[120px]">{issue.department}</span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button 
                        onClick={(e) => handleSupport(issue.id, e)}
                        className={`flex items-center gap-1 py-0.5 px-1.5 sm:px-2 rounded-md font-semibold transition-all ${
                          profile && issue.voters.includes(profile.uid)
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-slate-100 hover:bg-slate-200 text-slate-500'
                        }`}
                        title="Upvote / Support this issue"
                      >
                        <ThumbsUp className="w-3 h-3" />
                        <span>{issue.votesCount}</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* RIGHT: Detailed Inspector panel (lg:col-span-5) */}
      <div className={`lg:col-span-5 ${activeIssue ? 'block' : 'hidden lg:block'}`} id="issue-inspector-section">
        <AnimatePresence mode="wait">
          {activeIssue ? (
            <motion.div 
              key="detail-panel"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden flex flex-col h-[calc(100vh-140px)] sticky top-[76px]"
              id="active-issue-detail-card"
            >
              {/* Back button on mobile */}
              <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50">
                <span className="text-xs font-bold font-mono text-indigo-600 uppercase tracking-widest flex items-center gap-1">
                  <Activity className="w-3.5 h-3.5" />
                  Transparency Audit
                </span>
                <button 
                  onClick={closeDetailPanel}
                  className="p-1.5 hover:bg-slate-200 rounded-full text-slate-400 hover:text-slate-700 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Scrollable details wrapper */}
              <div className="flex-1 overflow-y-auto p-5 space-y-5" id="inspector-scrollable-body">
                <div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${getStatusBadgeClass(activeIssue.status)}`}>
                      {activeIssue.status}
                    </span>
                    <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-semibold ${getSeverityBadgeClass(activeIssue.severity)}`}>
                      {activeIssue.severity} Severity
                    </span>
                    {activeIssue.priorityScore !== undefined && (
                      <span className="px-1.5 py-0.5 bg-amber-500 text-white rounded-md text-[10px] font-bold">
                        ★ Priority: {activeIssue.priorityScore}
                      </span>
                    )}
                  </div>
                  
                  <h2 className="text-base font-display font-extrabold text-slate-900 mt-2 leading-snug">
                    {activeIssue.title}
                  </h2>
                  
                  <div className="mt-2 flex items-center gap-1.5 text-xs text-slate-500">
                    <MapPin className="w-3.5 h-3.5 text-red-500 shrink-0" />
                    <span className="truncate font-semibold">{activeIssue.address}</span>
                  </div>
                </div>

                {/* INCIDENT ACTION TAKEN & RESPONSIVENESS AUDIT */}
                {(() => {
                  const action = getIssueActionClassification(activeIssue);
                  const isOfficerOrAdmin = profile && ['Officer', 'Department Head', 'Super Admin'].includes(profile.role);
                  const needsSelfAssignment = !activeIssue.assignedOfficerId && !['Resolved', 'Verified', 'Closed'].includes(activeIssue.status);

                  const handleSelfAssign = async () => {
                    if (!profile) return;
                    try {
                      await dbUpdateIssueStatus(activeIssue.id, 'In Progress', profile.uid, profile.name, {
                        assignedOfficerId: profile.uid,
                        assignedOfficerName: profile.name
                      });
                      // Update local states
                      const updated: Issue = {
                        ...activeIssue,
                        status: 'In Progress' as const,
                        assignedOfficerId: profile.uid,
                        assignedOfficerName: profile.name,
                        updatedAt: new Date().toISOString()
                      };
                      setActiveIssue(updated);
                      // Refresh full issues list
                      const list = await dbGetIssues();
                      setIssues(list);
                      alert("Successfully self-assigned incident and updated status to [In Progress]. This is now classified as 'In the Works'.");
                    } catch (err) {
                      console.error(err);
                      alert("Self-assignment failed.");
                    }
                  };

                  return (
                    <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-4 space-y-3" id="action-responsiveness-audit-card">
                      <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                        <span className="text-xs font-extrabold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                          <Shield className="w-4 h-4 text-blue-500" />
                          Responsiveness Audit
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${action.textColor} ${action.bgColor} border border-slate-200/50`}>
                          {action.status}
                        </span>
                      </div>

                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-[10px] text-slate-500 font-bold">
                          <span>Action Progression Speed</span>
                          <span className={action.textColor}>{action.progressPercent}%</span>
                        </div>
                        <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                          <div 
                            className={`h-full rounded-full transition-all duration-500 ${
                              action.status === 'In the Works' ? 'bg-emerald-500' : action.status === 'Action Pending' ? 'bg-amber-500' : 'bg-rose-500'
                            }`}
                            style={{ width: `${action.progressPercent}%` }}
                          />
                        </div>
                      </div>

                      <div className="bg-white p-2.5 rounded-lg border border-slate-100 text-[11px] space-y-1.5">
                        <p className="font-bold text-slate-800 leading-normal">{action.label}</p>
                        <p className="text-slate-500 leading-relaxed font-medium">{action.reason}</p>
                      </div>

                      {/* Audit parameters table */}
                      <div className="grid grid-cols-2 gap-2 text-[10px] font-semibold text-slate-500">
                        <div className="bg-white p-2 rounded-lg border border-slate-100 flex flex-col justify-between">
                          <span className="text-slate-400 block font-bold text-[8px] uppercase">Officer Dispatched</span>
                          <span className={activeIssue.assignedOfficerId ? "text-emerald-700 mt-1" : "text-slate-700 mt-1"}>
                            {activeIssue.assignedOfficerName ? `✓ ${activeIssue.assignedOfficerName}` : "✗ Pending Assignment"}
                          </span>
                        </div>
                        <div className="bg-white p-2 rounded-lg border border-slate-100 flex flex-col justify-between">
                          <span className="text-slate-400 block font-bold text-[8px] uppercase">Bureaucratic Delay</span>
                          <span className={action.status === 'Ignored / Delayed' ? "text-red-700 font-bold mt-1" : "text-slate-700 mt-1"}>
                            {action.status === 'Ignored / Delayed' ? "⚠️ Delay Detected" : "✓ Within Expected SLA"}
                          </span>
                        </div>
                      </div>

                      {/* Interactive Field Action for Officers to dispatch themselves */}
                      {isOfficerOrAdmin && needsSelfAssignment && (
                        <button
                          onClick={handleSelfAssign}
                          className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <Wrench className="w-3.5 h-3.5" />
                          Intervene Now: Self-Assign Issue
                        </button>
                      )}
                    </div>
                  );
                })()}

                {/* GAP 2: COMMUNITY IMPACT AGGREGATOR */}
                {activeIssue.isMerged && (
                  <div className="bg-indigo-50 border-2 border-indigo-200 rounded-xl p-3.5 space-y-2" id="impact-aggregator-panel">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 bg-indigo-600 text-white rounded-lg animate-bounce">
                        <Activity className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="font-bold text-xs text-indigo-950 uppercase tracking-wide block">Unified Community Ticket</span>
                        <span className="text-[10px] text-indigo-600 font-semibold">AI Merged Duplicates</span>
                      </div>
                    </div>
                    <p className="text-[11px] text-slate-600 leading-relaxed">
                      AI identified multiple overlapping reports matching this coordinate cluster. Instead of clogging the municipal queue with individual complaints, they have been compiled to drive high civic pressure.
                    </p>
                    <div className="grid grid-cols-3 gap-2 pt-1">
                      <div className="bg-white p-2 rounded-lg border border-indigo-100 text-center">
                        <span className="text-[10px] font-bold text-slate-400 block uppercase">Reporter Count</span>
                        <span className="text-base font-extrabold text-indigo-700">{activeIssue.affectedCount || 500}</span>
                      </div>
                      <div className="bg-white p-2 rounded-lg border border-indigo-100 text-center">
                        <span className="text-[10px] font-bold text-slate-400 block uppercase">Supporters</span>
                        <span className="text-base font-extrabold text-indigo-700">{activeIssue.votesCount}</span>
                      </div>
                      <div className="bg-white p-2 rounded-lg border border-indigo-100 text-center">
                        <span className="text-[10px] font-bold text-slate-400 block uppercase">Estimated Impact</span>
                        <span className="text-base font-extrabold text-indigo-700">{(activeIssue.affectedCount || 1) * 5} Citizens</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* GAP 5: DYNAMIC CIVIC PRIORITY SCORE CALCULATOR */}
                <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3.5 space-y-2" id="priority-score-breakdown-panel">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 uppercase tracking-wider">
                      <Award className="w-4 h-4 text-amber-500" />
                      <span>Dynamic Priority Engine</span>
                    </div>
                    <span className="text-lg font-black font-display text-blue-600">
                      {activeIssue.priorityScore || 50} <span className="text-[10px] text-slate-400 font-normal">/ 100</span>
                    </span>
                  </div>
                  {/* Visual Progress bar */}
                  <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                    <div 
                      className="bg-blue-600 h-full transition-all duration-300"
                      style={{ width: `${activeIssue.priorityScore || 50}%` }}
                    ></div>
                  </div>
                  <div className="text-[10px] text-slate-500 leading-normal flex items-center justify-between">
                    <span>Formula: Severity Weight + Supporters + Duration + Local Escalation Level</span>
                    <span className="font-semibold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded">Real-time</span>
                  </div>
                </div>

                {/* Primary media image */}
                {activeIssue.imageUrl && (
                  <div className="rounded-xl overflow-hidden border border-slate-100 bg-slate-50" id="detail-photo-gallery">
                    <p className="text-[10px] font-bold text-slate-400 bg-slate-100 px-3 py-1 uppercase tracking-wider">Before Resolution Photograph</p>
                    <img 
                      src={activeIssue.imageUrl} 
                      alt="Complaint snapshot" 
                      className="w-full max-h-56 object-cover"
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                        e.currentTarget.onerror = null;
                        e.currentTarget.src = 'https://images.unsplash.com/photo-1541888946425-d81bb19240f5?auto=format&fit=crop&w=600&q=80';
                      }}
                    />
                  </div>
                )}

                {/* Dynamic voice note player */}
                {activeIssue.voiceNoteUrl && (
                  <div className="p-3 bg-indigo-50/60 border border-indigo-100 rounded-xl space-y-1.5" id="voice-narrative-player">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-700">
                      <Volume2 className="w-4 h-4 animate-pulse" />
                      <span>Original Audio Narrative</span>
                    </div>
                    <audio src={activeIssue.voiceNoteUrl} controls className="w-full h-8" />
                  </div>
                )}

                {/* Problem details text */}
                <div className="space-y-1.5">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Citizen Problem statement</h4>
                  <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 rounded-xl p-3 border border-slate-100">
                    {activeIssue.description}
                  </p>
                </div>

                {/* GAP 1: CIVIC ACCOUNTABILITY DASHBOARD */}
                <div className="border border-slate-100 rounded-xl overflow-hidden" id="accountability-dashboard-grid">
                  <div className="bg-slate-900 text-white text-[10px] font-bold px-3 py-1.5 uppercase tracking-wider flex justify-between">
                    <span>Civic Accountability Dashboard</span>
                    <span className="text-blue-400">ID: #{activeIssue.id.slice(0, 8)}</span>
                  </div>
                  <div className="grid grid-cols-2 divide-x divide-y divide-slate-100 text-xs">
                    <div className="p-3 text-left">
                      <span className="text-[9px] font-bold text-slate-400 uppercase block">Responsible Agency</span>
                      <span className="font-bold text-slate-800 block mt-0.5">{activeIssue.department}</span>
                    </div>
                    <div className="p-3 text-left">
                      <span className="text-[9px] font-bold text-slate-400 uppercase block">Responsible Officer</span>
                      <span className="font-bold text-slate-800 block mt-0.5">
                        {activeIssue.assignedOfficerName || 'Awaiting Allocation'}
                      </span>
                    </div>
                    <div className="p-3 text-left">
                      <span className="text-[9px] font-bold text-slate-400 uppercase block">Date Filed</span>
                      <span className="font-semibold text-slate-600 block mt-0.5">
                        {new Date(activeIssue.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                      </span>
                    </div>
                    <div className="p-3 text-left">
                      <span className="text-[9px] font-bold text-slate-400 uppercase block">Expected Resolution</span>
                      <span className="font-bold text-slate-700 block mt-0.5">
                        {new Date(new Date(activeIssue.createdAt).getTime() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                      </span>
                    </div>
                  </div>

                  {/* Delay Tracker Check */}
                  {(() => {
                    const createdDate = new Date(activeIssue.createdAt);
                    const expectedDate = new Date(createdDate.getTime() + 7 * 24 * 60 * 60 * 1000);
                    const isDelayed = Date.now() > expectedDate.getTime() && !['Resolved', 'Verified', 'Closed'].includes(activeIssue.status);
                    const delayDays = Math.ceil((Date.now() - expectedDate.getTime()) / (1000 * 60 * 60 * 24));
                    
                    if (isDelayed) {
                      return (
                        <div className="bg-red-50 p-2.5 border-t border-red-100 flex items-center gap-2 text-xs text-red-700">
                          <AlertTriangle className="w-4 h-4 text-red-600 animate-pulse" />
                          <span className="font-bold">RESOLUTION DELAYED: {delayDays} Days past service SLA</span>
                        </div>
                      );
                    } else {
                      return (
                        <div className="bg-emerald-50 p-2.5 border-t border-emerald-100 flex items-center gap-2 text-xs text-emerald-700">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          <span className="font-semibold">Service Timeline compliant (Within SLA window)</span>
                        </div>
                      );
                    }
                  })()}
                </div>

                {/* DIFFERENTIAL 1: AI MATERIALS & COST ESTIMATOR (GAP: Municipal feasibility blind spot) */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3" id="ai-materials-estimator-panel">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Coins className="w-4 h-4 text-emerald-600" />
                      <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">AI Material & Cost Estimator</span>
                    </div>
                    <span className="text-xs font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
                      Budgeted: ₹{activeIssue.materialsEstimate?.cost || 450}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-normal">
                    AI scanned the complaint description and generated a municipal resource plan. Citizens can audit the list and suggest cheaper local suppliers to combat tax markups.
                  </p>

                  {/* Materials breakdown */}
                  <div className="bg-white rounded-lg border border-slate-100 overflow-hidden text-[11px]">
                    <table className="w-full text-left divide-y divide-slate-100">
                      <thead className="bg-slate-50 text-[10px] font-bold text-slate-400 uppercase">
                        <tr>
                          <th className="px-3 py-1.5">Resource / Item</th>
                          <th className="px-3 py-1.5 text-center">Qty</th>
                          <th className="px-3 py-1.5 text-right">Est Cost</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-700">
                        {(activeIssue.materialsEstimate?.items || [
                          { name: 'Standard patching compound & tar', qty: 4, unit: 'bags', cost: 160 },
                          { name: 'Basic city worker crew (2 hours)', qty: 2, unit: 'hrs', cost: 200 },
                          { name: 'Safety cones & road signage hire', qty: 1, unit: 'day', cost: 90 }
                        ]).map((item, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/50">
                            <td className="px-3 py-1.5 font-medium">{item.name}</td>
                            <td className="px-3 py-1.5 text-center text-slate-500">{item.qty} {item.unit}</td>
                            <td className="px-3 py-1.5 text-right font-semibold text-slate-900">₹{item.cost}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Suggest adjustment form */}
                  {showEstimateForm ? (
                    <form onSubmit={handleProposeMaterialItem} className="bg-white p-3 rounded-lg border border-slate-200/80 space-y-2 text-xs">
                      <div className="flex justify-between items-center pb-1 border-b border-slate-100">
                        <span className="font-bold text-slate-800">Propose Lower Contractor Rate / Alternative Supplier</span>
                        <button type="button" onClick={() => setShowEstimateForm(false)} className="text-slate-400 hover:text-slate-600">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] font-bold text-slate-400 uppercase block">Supplier Item Name</label>
                          <input 
                            type="text" 
                            required
                            placeholder="e.g. Local Hardware asphalt bags" 
                            value={suggestedItemName}
                            onChange={(e) => setSuggestedItemName(e.target.value)}
                            className="w-full border border-slate-200 rounded px-2 py-1 text-xs focus:ring-1 focus:ring-blue-500 outline-hidden"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-slate-400 uppercase block">Unit Price (₹)</label>
                          <input 
                            type="number" 
                            required
                            placeholder="e.g. 500" 
                            value={suggestedItemCost}
                            onChange={(e) => setSuggestedItemCost(e.target.value)}
                            className="w-full border border-slate-200 rounded px-2 py-1 text-xs focus:ring-1 focus:ring-blue-500 outline-hidden"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-slate-400 uppercase block">Quantity Needed</label>
                          <input 
                            type="number" 
                            required
                            placeholder="1" 
                            value={suggestedItemQty}
                            onChange={(e) => setSuggestedItemQty(e.target.value)}
                            className="w-full border border-slate-200 rounded px-2 py-1 text-xs focus:ring-1 focus:ring-blue-500 outline-hidden"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-slate-400 uppercase block">Unit type</label>
                          <input 
                            type="text" 
                            placeholder="e.g. bags / days" 
                            value={suggestedItemUnit}
                            onChange={(e) => setSuggestedItemUnit(e.target.value)}
                            className="w-full border border-slate-200 rounded px-2 py-1 text-xs focus:ring-1 focus:ring-blue-500 outline-hidden"
                          />
                        </div>
                      </div>
                      <button type="submit" className="w-full py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded text-center transition-all">
                        ✓ Inject Cheaper Bid & Recalculate
                      </button>
                    </form>
                  ) : (
                    <button 
                      type="button" 
                      onClick={() => setShowEstimateForm(true)}
                      className="w-full py-1.5 border border-dashed border-slate-300 hover:border-emerald-500 text-slate-600 hover:text-emerald-700 font-semibold rounded-lg text-[10px] text-center flex items-center justify-center gap-1 transition-all"
                    >
                      <Plus className="w-3.5 h-3.5" /> Flag Municipal Overprice / Add Local Supplier Bid
                    </button>
                  )}
                </div>

                {/* DIFFERENTIAL 2: COMMUNITY VOLUNTEER PLEDGES (GAP: "Passive Bystander" complaint culture) */}
                <div className="bg-blue-50/40 border border-blue-200 rounded-xl p-4 space-y-3" id="community-action-pledges-panel">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Users className="w-4 h-4 text-blue-600" />
                      <span className="text-xs font-bold text-blue-950 uppercase tracking-wider">Community Task Force Hub</span>
                    </div>
                    <span className="text-xs font-bold bg-blue-100 text-blue-800 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                      <Heart className="w-3 h-3 text-red-500 fill-red-500" />
                      {activeIssue.communityPledges?.length || 0} Pledges
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-normal">
                    Don't just wait for the government! Team up to co-solve issues. Organize cleanup sessions, pledge tools, labor, or refreshments. Earn +15 Civic Reputation.
                  </p>

                  {/* List of active pledges */}
                  {activeIssue.communityPledges && activeIssue.communityPledges.length > 0 ? (
                    <div className="space-y-2">
                      {activeIssue.communityPledges.map((pledge, idx) => (
                        <div key={idx} className="bg-white p-2.5 rounded-lg border border-blue-100 flex items-start gap-2 text-[11px]">
                          <div className="p-1 bg-blue-50 text-blue-600 rounded-full shrink-0">
                            {pledge.pledgeType === 'labor' ? <Wrench className="w-3.5 h-3.5" /> : 
                             pledge.pledgeType === 'supplies' ? <Coins className="w-3.5 h-3.5" /> : 
                             pledge.pledgeType === 'cleanup' ? <Activity className="w-3.5 h-3.5" /> : <Heart className="w-3.5 h-3.5" />}
                          </div>
                          <div>
                            <span className="font-bold text-slate-800">{pledge.userName}</span>
                            <span className="text-slate-400 text-[10px] ml-1.5 font-medium uppercase tracking-wider bg-slate-50 px-1 rounded border border-slate-100">
                              {pledge.pledgeType} {pledge.hours ? `(${pledge.hours}h)` : ''}
                            </span>
                            <p className="text-slate-600 mt-1">{pledge.notes}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-2.5 bg-white rounded-lg border border-blue-100 border-dashed text-[11px] text-slate-400 italic">
                      No citizen pledges yet. Be the first to initiate local direct action!
                    </div>
                  )}

                  {/* Create Pledge form */}
                  {showPledgeForm ? (
                    <form onSubmit={handleCreatePledge} className="bg-white p-3 rounded-lg border border-blue-200 space-y-2 text-xs">
                      <div className="flex justify-between items-center pb-1 border-b border-blue-100">
                        <span className="font-bold text-blue-900">Sign Up for Neighborhood Task Force</span>
                        <button type="button" onClick={() => setShowPledgeForm(false)} className="text-slate-400 hover:text-slate-600">
                          <X className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-400 uppercase block">Pledge Contribution Type</label>
                        <div className="grid grid-cols-2 gap-1 text-[10px]">
                          {[
                            { value: 'labor', label: '🛠 Volunteer Labor' },
                            { value: 'supplies', label: '📦 Repair Supplies' },
                            { value: 'cleanup', label: '🧹 Cleanup Support' },
                            { value: 'donation', label: '❤️ Minor Support' }
                          ].map((opt) => (
                            <button
                              key={opt.value}
                              type="button"
                              onClick={() => setPledgeType(opt.value as any)}
                              className={`py-1.5 px-2 rounded-md font-medium border text-center transition-all ${pledgeType === opt.value ? 'bg-blue-600 text-white border-blue-600' : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'}`}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {['labor', 'cleanup'].includes(pledgeType) && (
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-400 uppercase block">Committed Volunteer Hours</label>
                          <input 
                            type="number" 
                            min="1" 
                            max="40"
                            value={pledgeHours} 
                            onChange={(e) => setPledgeHours(parseInt(e.target.value) || 1)}
                            className="w-full border border-slate-200 rounded px-2 py-1 text-xs focus:ring-1 focus:ring-blue-500 outline-hidden"
                          />
                        </div>
                      )}

                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase block">What specific tools/help can you bring?</label>
                        <textarea 
                          required
                          placeholder="e.g. I have heavy ropes and 2 rakes. I am free on Sunday afternoon." 
                          value={pledgeNotes}
                          onChange={(e) => setPledgeNotes(e.target.value)}
                          rows={2}
                          className="w-full border border-slate-200 rounded px-2 py-1 text-xs focus:ring-1 focus:ring-blue-500 outline-hidden resize-none"
                        />
                      </div>

                      <button 
                        type="submit" 
                        disabled={isPledging}
                        className="w-full py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-bold rounded text-center transition-all flex items-center justify-center gap-1.5"
                      >
                        {isPledging ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : '✓ Pledge to Task Force'}
                      </button>
                    </form>
                  ) : (
                    <button 
                      type="button" 
                      onClick={() => setShowPledgeForm(true)}
                      className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-xs text-center flex items-center justify-center gap-1.5 transition-all shadow-xs"
                    >
                      <Plus className="w-3.5 h-3.5" /> Join Neighborhood Action Task Force
                    </button>
                  )}
                </div>

                {/* GAP 7: AI TRUST ENGINE CREDIBILITY INDEX */}
                <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3.5 space-y-2" id="ai-trust-engine-panel">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 uppercase tracking-wider">
                      <Shield className="w-3.5 h-3.5 text-emerald-600" />
                      <span>AI Trust Engine Audit</span>
                    </div>
                    <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 rounded-md px-1.5 py-0.5">
                      {activeIssue.credibilityScore || 90}% Credibility
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed italic">
                    "{activeIssue.credibilityExplanation || 'AI verified geographic proximity, EXIF metadata compliance, and confirmed absence of image alterations.'}"
                  </p>
                </div>

                {/* GAP 3: AUTONOMOUS ESCALATION AGENT CONTROLLERS */}
                <div className="bg-indigo-50/50 border border-indigo-100 rounded-xl p-3.5 space-y-3 text-left" id="autonomous-escalation-panel">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-4 h-4 text-indigo-600" />
                      <span className="text-xs font-bold text-indigo-950 uppercase tracking-wide">Autonomous Escalation Tracker</span>
                    </div>
                    <span className="text-[10px] font-bold bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded-full">
                      Level: {activeIssue.escalationLevel || 0} / 4
                    </span>
                  </div>

                  {/* Escalation progression steps */}
                  <div className="relative flex justify-between items-center text-[9px] font-bold text-slate-400 px-1 pt-1">
                    <div className="absolute top-[13px] left-0 right-0 h-0.5 bg-slate-200 -z-10"></div>
                    <div className="flex flex-col items-center">
                      <span className={`w-3.5 h-3.5 rounded-full border-2 ${activeIssue.escalationLevel !== undefined && activeIssue.escalationLevel >= 0 ? 'bg-indigo-600 border-indigo-600' : 'bg-white border-slate-300'}`}></span>
                      <span className="mt-1 text-slate-700">Day 0 (Filed)</span>
                    </div>
                    <div className="flex flex-col items-center">
                      <span className={`w-3.5 h-3.5 rounded-full border-2 ${activeIssue.escalationLevel !== undefined && activeIssue.escalationLevel >= 1 ? 'bg-indigo-600 border-indigo-600' : 'bg-white border-slate-300'}`}></span>
                      <span className="mt-1 text-slate-700">Day 15 (Officer)</span>
                    </div>
                    <div className="flex flex-col items-center">
                      <span className={`w-3.5 h-3.5 rounded-full border-2 ${activeIssue.escalationLevel !== undefined && activeIssue.escalationLevel >= 2 ? 'bg-indigo-600 border-indigo-600' : 'bg-white border-slate-300'}`}></span>
                      <span className="mt-1 text-slate-700">Day 30 (Dept Head)</span>
                    </div>
                    <div className="flex flex-col items-center">
                      <span className={`w-3.5 h-3.5 rounded-full border-2 ${activeIssue.escalationLevel !== undefined && activeIssue.escalationLevel >= 3 ? 'bg-indigo-600 border-indigo-600' : 'bg-white border-slate-300'}`}></span>
                      <span className="mt-1 text-slate-700">Day 45 (District)</span>
                    </div>
                    <div className="flex flex-col items-center">
                      <span className={`w-3.5 h-3.5 rounded-full border-2 ${activeIssue.escalationLevel !== undefined && activeIssue.escalationLevel >= 4 ? 'bg-indigo-600 border-indigo-600' : 'bg-white border-slate-300 animate-pulse'}`}></span>
                      <span className="mt-1 text-slate-700">Day 60 (Public Alert)</span>
                    </div>
                  </div>

                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={async () => {
                        const currentLvl = activeIssue.escalationLevel || 0;
                        const nextLvl = Math.min(4, currentLvl + 1);
                        
                        let actionMsg = 'AI escalated to Senior Officer due to resolution delay.';
                        if (nextLvl === 2) actionMsg = 'AI escalated warning directly to Ward Department Head राजेश कुमार.';
                        if (nextLvl === 3) actionMsg = 'AI escalated to District Municipal Authority (Formal Notice Issued).';
                        if (nextLvl === 4) actionMsg = 'AI Triggered PUBLIC MUNICIPAL ACCOUNTABILITY ALERT! Ward transparency ratings lowered.';

                        // Compute new priority score to match escalation level!
                        const newPriority = Math.min(99, (activeIssue.priorityScore || 50) + 12);

                        // Trigger DB Update
                        await dbUpdateIssueStatus(activeIssue.id, activeIssue.status, 'system-agent', 'Autonomous AI Tracker', {
                          escalationLevel: nextLvl,
                          priorityScore: newPriority,
                          escalationDate: new Date().toISOString()
                        });

                        // Re-fetch issue data
                        const updatedIssues = await dbGetIssues();
                        const current = updatedIssues.find(i => i.id === activeIssue.id);
                        if (current) {
                          setActiveIssue(current);
                          const logList = await dbGetActivityLogs(current.id);
                          setLogs(logList);
                        }
                        loadIssues();
                        alert(`Autonomous AI Agent triggered: ${actionMsg}`);
                      }}
                      className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg text-[11px] text-center flex items-center justify-center gap-1.5 transition-all shadow-xs"
                    >
                      ⚡ Run Autonomous AI Escalation Tick (Simulate Age)
                    </button>
                    <p className="text-[10px] text-slate-400 mt-1.5 text-center">
                      Demonstrates AI tracking delay times and holding negligent Ward officers fully accountable automatically.
                    </p>
                  </div>
                </div>

                {/* GAP 4: AI + COMMUNITY VERIFICATION ENGINE */}
                {activeIssue.status === 'Community Verification' && verificationRequest && (
                  <div className="p-4 bg-orange-50 border-2 border-orange-200 rounded-2xl space-y-3" id="double-blind-consensus-panel">
                    <div className="flex gap-2">
                      <CheckCircle2 className="w-5 h-5 text-orange-600 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold text-xs text-orange-950 block">Auditing Active: Resolution Consensus</span>
                        <p className="text-[11px] text-orange-900 mt-0.5 leading-normal">
                          The assigned officer marked this issue resolved. Before closing, the Community Hero consensus audit protocol must receive 3 verification votes.
                        </p>
                      </div>
                    </div>

                    {/* Before/After Dual photograph grid */}
                    <div className="grid grid-cols-2 gap-2">
                      {activeIssue.imageUrl && (
                        <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
                          <span className="text-[8px] font-bold bg-slate-100 text-slate-500 px-2 py-0.5 block uppercase">BEFORE PHOTO</span>
                          <img 
                            src={activeIssue.imageUrl} 
                            alt="Before repair proof" 
                            className="w-full h-24 object-cover"
                            referrerPolicy="no-referrer"
                            onError={(e) => {
                              e.currentTarget.onerror = null;
                              e.currentTarget.src = 'https://images.unsplash.com/photo-1541888946425-d81bb19240f5?auto=format&fit=crop&w=300&q=80';
                            }}
                          />
                        </div>
                      )}
                      {verificationRequest.afterImageUrl && (
                        <div className="border border-orange-200 rounded-xl overflow-hidden bg-white">
                          <span className="text-[8px] font-bold bg-orange-100 text-orange-800 px-2 py-0.5 block uppercase">AFTER PHOTO</span>
                          <img 
                            src={verificationRequest.afterImageUrl} 
                            alt="After repair proof" 
                            className="w-full h-24 object-cover"
                            referrerPolicy="no-referrer"
                            onError={(e) => {
                              e.currentTarget.onerror = null;
                              e.currentTarget.src = 'https://images.unsplash.com/photo-1478760329108-5c3ed9d495a0?auto=format&fit=crop&w=300&q=80';
                            }}
                          />
                        </div>
                      )}
                    </div>

                    <div className="bg-white border border-orange-200 rounded-xl p-3 space-y-1.5">
                      <div className="flex items-center justify-between text-[9px] font-bold text-slate-400 uppercase">
                        <span>Officer Resolution Statement</span>
                        <span className="text-emerald-700 bg-emerald-50 px-1 py-0.5 rounded">AI Verified: 96%</span>
                      </div>
                      <p className="text-xs text-slate-700 leading-normal italic">
                        "{verificationRequest.notes}"
                      </p>
                    </div>

                    {/* Votes metrics progress */}
                    <div className="flex items-center justify-between text-xs font-semibold px-1">
                      <span className="text-green-700">Verified: {verificationRequest.votesVerified} / 3</span>
                      <span className="text-red-700">Disputed: {verificationRequest.votesRejected} / 2</span>
                    </div>

                    {/* consensus audit triggers */}
                    {profile && profile.uid in (verificationRequest.voters || {}) ? (
                      <div className="p-2.5 bg-white border border-orange-200 rounded-xl text-center text-[11px] text-orange-900 font-medium">
                        ✓ Your consensus audit vote is recorded. Waiting for final community tallies.
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-2">
                        <button 
                          type="button"
                          onClick={() => handleVoteConsensus(true)}
                          disabled={isVotingConsensus}
                          className="py-2 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1 transition-all"
                        >
                          Verify Resolution (+15 Rep)
                        </button>
                        <button 
                          type="button"
                          onClick={() => handleVoteConsensus(false)}
                          disabled={isVotingConsensus}
                          className="py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1 transition-all"
                        >
                          Dispute Resolution (+15 Rep)
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Audit trail / Activity log segment */}
                <div className="space-y-2 border-t border-slate-100 pt-4" id="inspector-audit-trail">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                    <Activity className="w-3.5 h-3.5 text-indigo-500" />
                    Lifecycle History Log
                  </h4>
                  {logs.length === 0 ? (
                    <p className="text-[11px] text-slate-400">Awaiting initial action logs...</p>
                  ) : (
                    <div className="space-y-2 relative border-l border-slate-100 pl-3 ml-1.5 pt-1">
                      {logs.map((log) => (
                        <div key={log.id} className="text-xs text-left relative" id={`log-${log.id}`}>
                          {/* Dot marker */}
                          <span className="w-2 h-2 bg-blue-500 border-2 border-white rounded-full absolute -left-[18px] top-1"></span>
                          <span className="font-semibold text-slate-700 block">{log.action}</span>
                          <span className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                            <Clock className="w-3 h-3" />
                            {new Date(log.createdAt).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })} • By {log.userName}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Community Discussions Thread segment */}
                <div className="space-y-3 border-t border-slate-100 pt-4" id="inspector-discussions-thread">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                    <MessageSquare className="w-3.5 h-3.5 text-blue-500" />
                    Community Comments Feed ({comments.length})
                  </h4>
                  
                  {comments.length === 0 ? (
                    <p className="text-xs text-slate-400 italic py-2 text-center">No discussion entries. Be the first to share details!</p>
                  ) : (
                    <div className="space-y-3" id="discussion-comments-bubble-flow">
                      {comments.map((comment) => (
                        <div key={comment.id} className="p-2.5 bg-slate-50 border border-slate-100 rounded-xl space-y-1 text-left">
                          <div className="flex items-center justify-between text-[10px]">
                            <div className="flex items-center gap-1">
                              <span className="font-bold text-slate-800">{comment.userName}</span>
                              <span className="bg-slate-200 text-slate-500 font-semibold px-1 rounded-[4px]">{comment.userRole}</span>
                            </div>
                            <span className="text-slate-400 font-mono">
                              {new Date(comment.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                          <p className="text-xs text-slate-700 leading-normal">{comment.text}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Add Comment Input Form */}
                  {profile && (
                    <form onSubmit={handlePostComment} className="flex gap-2 pt-1" id="add-comment-input-form">
                      <input 
                        type="text" 
                        placeholder="Add professional insight or notes..."
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        className="flex-1 px-3 py-1.5 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-blue-500"
                        maxLength={250}
                        required
                      />
                      <button 
                        type="submit"
                        disabled={isCommenting}
                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs shrink-0"
                      >
                        {isCommenting ? 'Posting...' : 'Share'}
                      </button>
                    </form>
                  )}
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div 
              key="inspector-empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="hidden xl:flex flex-col items-center justify-center p-8 bg-slate-50 border border-slate-200 border-dashed rounded-2xl h-[calc(100vh-140px)] sticky top-[76px] text-center"
              id="empty-inspector-fallback"
            >
              <div className="p-3 bg-white border border-slate-200 rounded-full w-fit mb-3 text-slate-400">
                <Info className="w-6 h-6 animate-pulse" />
              </div>
              <h3 className="text-sm font-bold text-slate-700">Transparency Inspector</h3>
              <p className="text-xs text-slate-500 max-w-xs mt-1 leading-relaxed">
                Select any incident from the discovery catalog to review live coordinates, dynamic attachments, agency actions, audit history log, and double-blind community verification triggers.
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
