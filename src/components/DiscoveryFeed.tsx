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
  Info
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { 
  dbGetIssues, 
  dbSupportIssue, 
  dbGetComments, 
  dbAddComment, 
  dbGetActivityLogs, 
  dbGetVerificationRequests, 
  dbVoteVerification 
} from '../services/dbService';
import { Issue, Comment, ActivityLog, VerificationRequest } from '../types';
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

  // Detailed view states
  const [activeIssue, setActiveIssue] = useState<Issue | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [isCommenting, setIsCommenting] = useState(false);
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [verificationRequest, setVerificationRequest] = useState<VerificationRequest | null>(null);
  const [isVotingConsensus, setIsVotingConsensus] = useState(false);

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
    try {
      await dbSupportIssue(issueId, profile.uid);
      // Award minor reward points for civic support
      await updateReputation(2);
      await addBadge('Active Supporter');
      loadIssues();
      
      // Refresh active issue if open
      if (activeIssue && activeIssue.id === issueId) {
        const updatedIssues = await dbGetIssues();
        const found = updatedIssues.find(i => i.id === issueId);
        if (found) setActiveIssue(found);
      }
    } catch (err) {
      console.error(err);
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

    return matchesSearch && matchesCategory && matchesStatus;
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
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-6" id="discovery-grid-wrapper">
      
      {/* LEFT OR MAIN: Issue Catalog Feed (xl:col-span-7) */}
      <div className={`xl:col-span-7 space-y-4 ${activeIssue ? 'hidden xl:block' : 'block'}`} id="issues-list-section">
        {/* Filter bar card */}
        <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-xs space-y-3" id="feed-filter-card">
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
                className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-3 py-2 rounded-xl text-xs flex items-center gap-1.5 shrink-0 transition-all shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                Report Issue
              </button>
            )}
          </div>

          <div className="flex flex-wrap gap-2 pt-1" id="filter-pill-selectors">
            {/* Category Select */}
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] uppercase font-bold text-slate-400">Category:</span>
              <select 
                value={selectedCategory} 
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="bg-slate-50 border border-slate-200 text-slate-600 text-[11px] font-semibold rounded-lg px-2 py-1"
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
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] uppercase font-bold text-slate-400">Status:</span>
              <select 
                value={selectedStatus} 
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="bg-slate-50 border border-slate-200 text-slate-600 text-[11px] font-semibold rounded-lg px-2 py-1"
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
                className={`p-4 bg-white border rounded-2xl shadow-xs transition-all duration-200 cursor-pointer text-left hover:border-blue-400 hover:shadow-md flex gap-4 ${
                  activeIssue?.id === issue.id ? 'border-blue-500 ring-2 ring-blue-50/50' : 'border-slate-100'
                }`}
              >
                {/* Photo thumbnail */}
                {issue.imageUrl ? (
                  <div className="w-20 h-20 bg-slate-100 rounded-xl shrink-0 overflow-hidden border border-slate-200/50">
                    <img 
                      src={issue.imageUrl} 
                      alt="issue thumbnail" 
                      className="w-full h-full object-cover"
                    />
                  </div>
                ) : (
                  <div className="w-20 h-20 bg-slate-50 rounded-xl shrink-0 flex items-center justify-center text-slate-300 border border-slate-200/50">
                    <MapPin className="w-6 h-6" />
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
                      <span className="text-[10px] text-slate-400 font-mono truncate max-w-[120px] ml-auto">
                        #{issue.id.slice(0, 6)}
                      </span>
                    </div>

                    <h3 className="text-sm font-bold text-slate-900 mt-1.5 truncate">
                      {issue.title}
                    </h3>
                    
                    <p className="text-xs text-slate-500 line-clamp-1 mt-1 leading-normal">
                      {issue.description}
                    </p>
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-slate-400 mt-2 border-t border-slate-50 pt-2">
                    <div className="flex items-center gap-1">
                      <Building className="w-3.5 h-3.5" />
                      <span className="font-semibold text-slate-500 truncate max-w-[120px]">{issue.department}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button 
                        onClick={(e) => handleSupport(issue.id, e)}
                        className={`flex items-center gap-1 py-0.5 px-2 rounded-md font-semibold transition-all ${
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

      {/* RIGHT: Detailed Inspector panel (xl:col-span-5) */}
      <div className={`xl:col-span-5 ${activeIssue ? 'block' : 'hidden xl:block'}`} id="issue-inspector-section">
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
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${getStatusBadgeClass(activeIssue.status)}`}>
                      {activeIssue.status}
                    </span>
                    <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-semibold ${getSeverityBadgeClass(activeIssue.severity)}`}>
                      {activeIssue.severity} Severity
                    </span>
                  </div>
                  
                  <h2 className="text-base font-display font-extrabold text-slate-900 mt-2 leading-snug">
                    {activeIssue.title}
                  </h2>
                  
                  <div className="mt-2 flex items-center gap-1.5 text-xs text-slate-500">
                    <MapPin className="w-3.5 h-3.5 text-red-500 shrink-0" />
                    <span className="truncate font-semibold">{activeIssue.address}</span>
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

                {/* Meta details cards */}
                <div className="grid grid-cols-2 gap-3" id="details-attribute-grid">
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-left">
                    <span className="text-[9px] font-bold text-slate-400 uppercase block">Responsible Agency</span>
                    <span className="text-xs font-bold text-slate-700 truncate block mt-0.5">{activeIssue.department}</span>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-left">
                    <span className="text-[9px] font-bold text-slate-400 uppercase block">Assigned Responder</span>
                    <span className="text-xs font-bold text-slate-700 truncate block mt-0.5">
                      {activeIssue.assignedOfficerName || 'Awaiting Triage Officer'}
                    </span>
                  </div>
                </div>

                {/* double-blind Consensus system audit banner */}
                {activeIssue.status === 'Community Verification' && verificationRequest && (
                  <div className="p-4 bg-orange-50 border border-orange-200 rounded-2xl space-y-3" id="double-blind-consensus-panel">
                    <div className="flex gap-2">
                      <CheckCircle2 className="w-5 h-5 text-orange-600 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold text-xs text-orange-950 block">Auditing Active: Resolution Consensus</span>
                        <p className="text-[11px] text-orange-900 mt-0.5 leading-normal">
                          The assigned officer marked this issue resolved. Before closing, the Community Hero consensus audit protocol must receive 3 verification votes.
                        </p>
                      </div>
                    </div>

                    {/* After photograph preview */}
                    {verificationRequest.afterImageUrl && (
                      <div className="border border-orange-200 rounded-xl overflow-hidden bg-white">
                        <span className="text-[9px] font-bold bg-orange-100 text-orange-800 px-2 py-0.5 block uppercase tracking-wider">After Resolution Photograph</span>
                        <img 
                          src={verificationRequest.afterImageUrl} 
                          alt="After repair proof" 
                          className="w-full max-h-48 object-cover"
                        />
                      </div>
                    )}

                    <div className="bg-white border border-orange-200 rounded-xl p-3 space-y-1.5">
                      <span className="text-[9px] font-bold text-slate-400 uppercase">Officer Resolution Statement</span>
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
                          Verify Resolution (+10)
                        </button>
                        <button 
                          type="button"
                          onClick={() => handleVoteConsensus(false)}
                          disabled={isVotingConsensus}
                          className="py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1 transition-all"
                        >
                          Dispute Resolution (+10)
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
