import React, { useState, useEffect } from 'react';
import { 
  CheckCircle, 
  Clock, 
  MapPin, 
  Plus, 
  Camera, 
  FileText, 
  Loader2, 
  AlertCircle, 
  Building,
  ArrowRight,
  ShieldCheck
} from 'lucide-react';
import { dbGetIssues, dbUpdateIssueStatus, dbCreateVerificationRequest, dbGetVerificationRequests } from '../services/dbService';
import { Issue } from '../types';
import { getIssueActionClassification } from '../services/classificationService';
import { useAuth } from '../contexts/AuthContext';

export const OfficerWorkspace: React.FC = () => {
  const { profile, updateReputation } = useAuth();
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Resolution Form States
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null);
  const [afterImage, setAfterImage] = useState('https://images.unsplash.com/photo-1515162305285-0293e4767cc2?auto=format&fit=crop&w=600&q=80'); // preset mock fix image
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [isSubmittingFix, setIsSubmittingFix] = useState(false);

  // Load issues assigned to the logged in officer
  const loadOfficerIssues = async () => {
    setLoading(true);
    try {
      const all = await dbGetIssues();
      // Show issues assigned to this officer, or all issues if Department Head or Super Admin
      const filtered = all.filter(i => 
        !i.assignedOfficerId || 
        i.assignedOfficerId === profile?.uid || 
        profile?.role === 'Department Head' || 
        profile?.role === 'Super Admin'
      );
      setIssues(filtered);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOfficerIssues();
  }, [profile]);

  const handleUpdateStatus = async (issueId: string, nextStatus: Issue['status']) => {
    if (!profile) return;
    try {
      await dbUpdateIssueStatus(issueId, nextStatus, profile.uid, profile.name);
      await updateReputation(5); // officer reputation points
      loadOfficerIssues();
      alert(`Incident status updated to [${nextStatus}] successfully!`);
    } catch (err) {
      console.error(err);
    }
  };

  const handleProposeVerification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !selectedIssue || !afterImage || !resolutionNotes.trim()) {
      alert('Please fill in all resolution fields!');
      return;
    }

    setIsSubmittingFix(true);
    try {
      // 1. Submit double blind verification request
      await dbCreateVerificationRequest(selectedIssue.id, {
        issueId: selectedIssue.id,
        officerId: profile.uid,
        officerName: profile.name,
        afterImageUrl: afterImage,
        notes: resolutionNotes
      });

      // 2. Award Points
      await updateReputation(15);
      
      alert(`Resolution submitted for community double-blind verification! Status changed to [Community Verification]`);
      setSelectedIssue(null);
      setResolutionNotes('');
      loadOfficerIssues();
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmittingFix(false);
    }
  };

  // Presets of beautiful "after" repair imagery for realistic hackathon inputs
  const RESOLUTION_PRESET_IMAGES = [
    {
      label: 'Smooth New Asphalt Road',
      url: 'https://images.unsplash.com/photo-1515162305285-0293e4767cc2?auto=format&fit=crop&w=600&q=80'
    },
    {
      label: 'Fixed Shiny Streetlight Node',
      url: 'https://images.unsplash.com/photo-1478760329108-5c3ed9d495a0?auto=format&fit=crop&w=600&q=80'
    },
    {
      label: 'Clean Sidewalk Clear of Debris',
      url: 'https://images.unsplash.com/photo-1541888946425-d81bb19240f5?auto=format&fit=crop&w=600&q=80'
    }
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6" id="officer-workspace-layout">
      {/* LEFT COLUMN: Queue of assigned files (lg:col-span-7) */}
      <div className="lg:col-span-7 space-y-4 text-left">
        <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide">Officer Assignment Queue</h3>
              <p className="text-xs text-slate-400 mt-0.5">Assigned incidents in your ward's municipal jurisdiction requiring resolution action.</p>
            </div>
            <span className="text-xs font-bold bg-blue-50 text-blue-700 rounded-full px-2.5 py-1">
              Active: {issues.filter(i => i.status !== 'Verified' && i.status !== 'Closed').length} files
            </span>
          </div>
        </div>

        {loading ? (
          <div className="py-12 text-center">
            <Loader2 className="w-8 h-8 text-blue-500 animate-spin mx-auto mb-2" />
            <p className="text-xs text-slate-500 font-semibold">Pulling assigned municipal reports...</p>
          </div>
        ) : issues.length === 0 ? (
          <div className="bg-white border border-slate-100 rounded-2xl p-12 text-center text-slate-400">
            <CheckCircle className="w-8 h-8 text-green-500 mx-auto mb-3" />
            <h4 className="text-sm font-bold text-slate-700">All Clear! No assigned issues</h4>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto leading-normal">
              You do not have any active complaints assigned in your ward. Citizens are fully satisfied with your ward's response!
            </p>
          </div>
        ) : (
          <div className="space-y-3" id="officer-issues-list">
            {issues.map((issue) => (
              <div 
                key={issue.id}
                className="bg-white border border-slate-100 rounded-2xl p-4 shadow-xs hover:border-slate-300 transition-all space-y-3"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="px-2 py-0.5 bg-blue-50 border border-blue-100 text-blue-700 rounded-full text-[9px] font-bold">
                        {issue.status}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">#{issue.id.slice(0, 8)}</span>
                      {issue.priorityScore !== undefined && (
                        <span className="px-1.5 py-0.5 bg-red-50 text-red-700 rounded text-[9px] font-bold animate-pulse">
                          Priority Score: {issue.priorityScore}
                        </span>
                      )}
                    </div>
                    <h4 className="text-sm font-extrabold text-slate-900 mt-2">{issue.title}</h4>
                    <span className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-red-500" />
                      {issue.address}
                    </span>
                  </div>

                  {issue.imageUrl && (
                    <div className="w-14 h-14 rounded-lg bg-slate-100 border border-slate-200/50 overflow-hidden shrink-0">
                      <img 
                        src={issue.imageUrl} 
                        alt="preview" 
                        className="w-full h-full object-cover" 
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                          e.currentTarget.onerror = null;
                          e.currentTarget.src = 'https://images.unsplash.com/photo-1541888946425-d81bb19240f5?auto=format&fit=crop&w=300&q=80';
                        }}
                      />
                    </div>
                  )}
                </div>

                <p className="text-xs text-slate-500 leading-normal bg-slate-50 rounded-xl p-2.5 border border-slate-100/60">
                  {issue.description}
                </p>

                {/* Dynamic Action Responsiveness Indicator */}
                {(() => {
                  const action = getIssueActionClassification(issue);
                  return (
                    <div className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border ${action.bgColor} ${action.textColor} text-[10px] font-bold w-fit max-w-full`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${action.badgeColor}`} />
                      <span className="shrink-0">{action.label}</span>
                      <span className="text-slate-300 font-normal">|</span>
                      <span className="opacity-85 font-normal truncate">{action.reason}</span>
                    </div>
                  );
                })()}

                {/* Queue Actions */}
                <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-50 items-center justify-between">
                  <div className="flex items-center gap-1 text-[10px] font-bold text-slate-400 uppercase">
                    <Building className="w-3.5 h-3.5" />
                    <span>{issue.department}</span>
                  </div>

                  <div className="flex gap-2">
                    {issue.status === 'Submitted' && (
                      <button
                        type="button"
                        onClick={() => handleUpdateStatus(issue.id, 'In Progress')}
                        className="py-1.5 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-all shadow-xs"
                      >
                        Acknowledge & Mark "In Progress"
                      </button>
                    )}

                    {issue.status === 'In Progress' && (
                      <button
                        type="button"
                        onClick={() => setSelectedIssue(issue)}
                        className="py-1.5 px-3 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-xs font-bold transition-all shadow-xs flex items-center gap-1"
                      >
                        <Camera className="w-3.5 h-3.5" />
                        Propose Resolution Verification
                      </button>
                    )}

                    {issue.status === 'Community Verification' && (
                      <span className="text-xs text-orange-700 font-semibold bg-orange-50 px-2.5 py-1 rounded-lg border border-orange-100 flex items-center gap-1 animate-pulse">
                        <Clock className="w-3.5 h-3.5" />
                        Community Consensus Audit Active
                      </span>
                    )}

                    {issue.status === 'Verified' && (
                      <span className="text-xs text-green-700 font-semibold bg-green-50 px-2.5 py-1 rounded-lg border border-green-100 flex items-center gap-1">
                        <CheckCircle className="w-3.5 h-3.5" />
                        Resolution Verified & Closed!
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* RIGHT COLUMN: Resolution Verification proposer (lg:col-span-5) */}
      <div className="lg:col-span-5 text-left" id="officer-resolution-sidebar">
        {selectedIssue ? (
          <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm space-y-4">
            <div>
              <span className="text-[10px] uppercase font-bold text-orange-600 tracking-wider">Resolution Verifier Panel</span>
              <h3 className="text-base font-extrabold text-slate-900 mt-1">Submit Proof of Fix</h3>
              <p className="text-[11px] text-slate-400 mt-0.5">Fill out physical proof metadata for double-blind consensus auditing.</p>
            </div>

            <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl">
              <span className="text-[9px] font-bold text-blue-800 uppercase block">Selected File</span>
              <span className="text-xs font-bold text-slate-800 block mt-0.5">{selectedIssue.title}</span>
            </div>

            <form onSubmit={handleProposeVerification} className="space-y-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Select After Photo Proof Preset</label>
                <div className="space-y-1.5">
                  {RESOLUTION_PRESET_IMAGES.map((img, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setAfterImage(img.url)}
                      className={`w-full text-left p-2.5 rounded-xl text-xs border transition-all flex items-center justify-between ${
                        afterImage === img.url 
                          ? 'border-orange-500 bg-orange-50/50 font-bold text-orange-950' 
                          : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      <span>{img.label}</span>
                      <ShieldCheck className={`w-4 h-4 ${afterImage === img.url ? 'text-orange-600' : 'text-slate-300'}`} />
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Resolution Notes & Explanation</label>
                <textarea
                  value={resolutionNotes}
                  onChange={(e) => setResolutionNotes(e.target.value)}
                  placeholder="Summarize the repair work completed, materials used, and final safety status. This statement is analyzed by Gemini Vision and audited by citizens."
                  className="w-full text-xs font-medium border border-slate-200 rounded-xl p-3 focus:outline-none focus:border-orange-500 h-28"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedIssue(null)}
                  className="py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs text-center transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingFix}
                  className="py-2.5 bg-orange-600 hover:bg-orange-700 text-white font-bold rounded-xl text-xs text-center transition-all shadow-xs flex items-center justify-center gap-1"
                >
                  {isSubmittingFix ? 'Filing Proof...' : 'File Resolved Proof'}
                </button>
              </div>
            </form>
          </div>
        ) : (
          <div className="bg-slate-50 border border-slate-200 border-dashed rounded-2xl p-8 text-center text-slate-400">
            <div className="p-3 bg-white border border-slate-200 rounded-full w-fit mx-auto mb-3 text-slate-400">
              <Camera className="w-6 h-6 animate-pulse" />
            </div>
            <h4 className="text-xs font-bold text-slate-700">Resolution Proposer</h4>
            <p className="text-[11px] text-slate-500 max-w-xs mt-1 leading-relaxed mx-auto">
              Select an ongoing file marked <strong>"In Progress"</strong> from the assignment queue on the left to activate resolution reporting.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
