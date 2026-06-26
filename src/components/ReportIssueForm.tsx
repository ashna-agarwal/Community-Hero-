import React, { useState, useRef, useEffect } from 'react';
import { 
  Camera, 
  Mic, 
  Square, 
  MapPin, 
  Sparkles, 
  AlertTriangle, 
  Check, 
  RotateCcw, 
  Upload, 
  Info,
  ShieldAlert,
  Loader2,
  Trash2,
  Map,
  Volume2
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { dbCreateIssue, dbGetIssues, dbSupportIssue } from '../services/dbService';
import { Issue, IssueSeverity, IssuePriority } from '../types';
import { motion, AnimatePresence } from 'motion/react';

interface ReportIssueFormProps {
  onSuccess: (issueId: string) => void;
  onViewIssue: (issueId: string) => void;
}

export const ReportIssueForm: React.FC<ReportIssueFormProps> = ({ onSuccess, onViewIssue }) => {
  const { profile, updateReputation, addBadge } = useAuth();

  // Basic inputs
  const [description, setDescription] = useState('');
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [address, setAddress] = useState('');
  const [isLocating, setIsLocating] = useState(false);

  // Multimedia states
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  
  // Voice Recording states
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const timerRef = useRef<number | null>(null);

  // AI predictions results
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisStep, setAnalysisStep] = useState('');
  const [aiResult, setAiResult] = useState<{
    title: string;
    description: string;
    category: string;
    department: string;
    severity: IssueSeverity;
    priority: IssuePriority;
    isDuplicate: boolean;
    duplicateIssueId?: string;
    duplicateExplanation?: string;
    fallbackMode?: boolean;
  } | null>(null);

  // Final editable form fields (pre-populated by AI)
  const [finalTitle, setFinalTitle] = useState('');
  const [finalCategory, setFinalCategory] = useState('');
  const [finalDepartment, setFinalDepartment] = useState('');
  const [finalSeverity, setFinalSeverity] = useState<IssueSeverity>('Medium');
  const [finalPriority, setFinalPriority] = useState<IssuePriority>('Medium');
  const [finalDescription, setFinalDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Drag and drop events
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      processSelectedImage(files[0]);
    }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      processSelectedImage(files[0]);
    }
  };

  const processSelectedImage = (file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('Please upload an image file.');
      return;
    }
    setImageFile(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  // Microphone recording
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      
      const chunks: BlobPart[] = [];
      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunks.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
        // Stop all tracks on the stream
        stream.getTracks().forEach(track => track.stop());
      };

      setRecordingSeconds(0);
      mediaRecorder.start();
      setIsRecording(true);

      timerRef.current = window.setInterval(() => {
        setRecordingSeconds(prev => prev + 1);
      }, 1000);

    } catch (err) {
      console.error('Failed to access microphone:', err);
      alert('Microphone access denied. You can still write details or upload files manually.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  };

  const deleteRecording = () => {
    setAudioBlob(null);
    setAudioUrl(null);
    setRecordingSeconds(0);
  };

  // Auto Geolocation detection
  const detectLocation = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser');
      return;
    }
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const latitude = pos.coords.latitude;
        const longitude = pos.coords.longitude;
        setLat(latitude);
        setLng(longitude);
        setAddress(`Near ${latitude.toFixed(5)}° N, ${longitude.toFixed(5)}° E`);
        setIsLocating(false);
      },
      (err) => {
        console.error('Location detection failed:', err);
        // Sandbox fallback coordinates
        const sandboxLat = 37.7749 + (Math.random() - 0.5) * 0.01;
        const sandboxLng = -122.4194 + (Math.random() - 0.5) * 0.01;
        setLat(sandboxLat);
        setLng(sandboxLng);
        setAddress(`Simulated Location: Pine St, San Francisco (GPS Offset)`);
        setIsLocating(false);
      },
      { timeout: 8000 }
    );
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (error) => reject(error);
    });
  };

  const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(blob);
      reader.onloadend = () => {
        const base64data = reader.result as string;
        resolve(base64data);
      };
      reader.onerror = (error) => reject(error);
    });
  };

  // AI-Powered Analysis Dispatcher
  const triggerAIAnalysis = async () => {
    if (!description && !imagePreview && !audioBlob) {
      alert('Please write a brief description or upload a photo/audio note first for AI analysis.');
      return;
    }

    setIsAnalyzing(true);
    setAnalysisStep('Uploading multimedia attachments...');

    try {
      let uploadedImageUrl = '';
      let uploadedAudioUrl = '';
      let imageBase64 = '';
      let audioBase64 = '';

      // Upload image to Node media proxy if available
      if (imageFile) {
        setAnalysisStep('Optimizing photo and converting buffers...');
        imageBase64 = await fileToBase64(imageFile);
        
        const uploadRes = await fetch('/api/media/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fileData: imageBase64,
            fileType: imageFile.type,
            fileName: imageFile.name
          })
        });
        const uploadData = await uploadRes.json();
        if (uploadData.success) {
          uploadedImageUrl = uploadData.url;
        }
      }

      // Convert audio note
      if (audioBlob) {
        setAnalysisStep('Digitizing voice memo transcripts...');
        audioBase64 = await blobToBase64(audioBlob);
        
        const uploadAudioRes = await fetch('/api/media/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fileData: audioBase64,
            fileType: 'audio/webm',
            fileName: 'voice-recording.webm'
          })
        });
        const uploadAudioData = await uploadAudioRes.json();
        if (uploadAudioData.success) {
          uploadedAudioUrl = uploadAudioData.url;
        }
      }

      setAnalysisStep('Fetching existing issues for duplicate prevention scan...');
      const existingIssues = await dbGetIssues();

      setAnalysisStep('Consulting Gemini 2.5 Flash Triage Engine...');
      
      const response = await fetch('/api/ai/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: description,
          imageData: imageBase64,
          imageType: imageFile?.type || 'image/jpeg',
          voiceData: audioBase64,
          voiceType: 'audio/webm',
          existingIssues: existingIssues.map(iss => ({
            id: iss.id,
            title: iss.title,
            description: iss.description,
            category: iss.category
          }))
        })
      });

      const parsed = await response.json();

      if (parsed.error) {
        throw new Error(parsed.error);
      }

      // Populate final edit fields
      setAiResult(parsed);
      setFinalTitle(parsed.title || '');
      setFinalCategory(parsed.category || 'Other');
      setFinalDepartment(parsed.department || 'City Code Enforcement');
      setFinalSeverity(parsed.severity || 'Medium');
      setFinalPriority(parsed.priority || 'Medium');
      setFinalDescription(parsed.description || description);

    } catch (err: any) {
      console.error('AI Triage error:', err);
      alert('AI Triage failed. Falling back to manual entry: ' + err.message);
      // Fallback fallback
      setAiResult({
        title: 'Report Needs Review',
        description: description,
        category: 'Other',
        department: 'City Code Enforcement',
        severity: 'Medium',
        priority: 'Medium',
        isDuplicate: false
      });
      setFinalTitle('Report Needs Review');
      setFinalCategory('Other');
      setFinalDepartment('City Code Enforcement');
      setFinalDescription(description);
    } finally {
      setIsAnalyzing(false);
      setAnalysisStep('');
    }
  };

  // Support duplicated item directly instead of creating duplicate
  const handleSupportDuplicate = async (dupId: string) => {
    if (!profile) return;
    setIsSubmitting(true);
    try {
      await dbSupportIssue(dupId, profile.uid);
      // Award minor reward points for cataloging duplicates
      await updateReputation(5);
      await addBadge('Duplicate Preventer');
      alert('Thank you! You have supported the existing community ticket to prevent clutter.');
      onViewIssue(dupId);
    } catch (err) {
      console.error(err);
      alert('Failed to support issue.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Final submission to firestore db
  const handleFinalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    if (!finalTitle || !finalDescription) {
      alert('Please fill in both title and description before submitting.');
      return;
    }

    setIsSubmitting(true);
    try {
      // Create issue object
      let finalImageUrl = '';
      if (imageFile) {
        // Upload file or pass base64 fallback directly to DB
        finalImageUrl = imagePreview || '';
      }

      let finalVoiceUrl = '';
      if (audioBlob) {
        finalVoiceUrl = audioUrl || '';
      }

      const issueId = await dbCreateIssue({
        title: finalTitle,
        description: finalDescription,
        category: finalCategory,
        department: finalDepartment,
        status: 'Department Assigned', // Routed directly
        severity: finalSeverity,
        priority: finalPriority,
        lat: lat || 37.7749,
        lng: lng || -122.4194,
        address: address || 'San Francisco Center (Fallback Coordinates)',
        imageUrl: finalImageUrl,
        voiceNoteUrl: finalVoiceUrl,
        reporterId: profile.uid,
        reporterName: profile.name,
        votesCount: 0,
        voters: []
      });

      // Award +15 reputation points for logging validated issue!
      await updateReputation(15);
      await addBadge('Active Citizen');

      alert('Report logged successfully and routed to responsible municipal department!');
      onSuccess(issueId);
    } catch (err: any) {
      console.error(err);
      alert('Submission failed: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-white border border-slate-100 rounded-2xl shadow-sm p-5 md:p-6 max-w-3xl mx-auto" id="report-issue-form-card">
      <AnimatePresence mode="wait">
        {!aiResult && !isAnalyzing && (
          <motion.div 
            key="input-stage"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="space-y-5"
          >
            {/* Header info */}
            <div className="bg-blue-50/60 border border-blue-100 rounded-xl p-4 flex gap-3 text-xs text-blue-800" id="form-header-banner">
              <Info className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold block mb-0.5">Community AI Routing Active</span>
                Simply upload a snapshot, speak a description, or describe your concern. Gemini 2.5 Flash will automatically name, classify, and dispatch your ticket to the correct municipal officer pool.
              </div>
            </div>

            {/* Step 1: Media Attachments (Image Drag and Drop) */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Step 1: Visual Proof (Drag & Drop or Capture)
              </label>
              
              <div 
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-xl p-6 transition-all duration-200 text-center relative ${
                  isDragOver 
                    ? 'border-blue-500 bg-blue-50/50' 
                    : 'border-slate-200 bg-slate-50 hover:bg-slate-100/50'
                }`}
                id="drag-and-drop-container"
              >
                {imagePreview ? (
                  <div className="relative inline-block max-w-xs mx-auto" id="image-preview-group">
                    <img 
                      src={imagePreview} 
                      alt="Civic Proof Preview" 
                      className="rounded-lg max-h-48 border border-slate-200"
                    />
                    <button 
                      type="button"
                      onClick={() => {
                        setImageFile(null);
                        setImagePreview(null);
                      }}
                      className="absolute -top-2 -right-2 bg-red-600 hover:bg-red-700 text-white rounded-full p-1.5 shadow-md transition-all"
                      title="Remove image"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3 cursor-pointer">
                    <div className="p-3 bg-white border border-slate-200 rounded-full w-fit mx-auto shadow-xs text-slate-500">
                      <Camera className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-700">Drag photo here, or click to browse</p>
                      <p className="text-xs text-slate-400 mt-1">Supports PNG, JPEG up to 10MB</p>
                    </div>
                    <label className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 text-slate-700 text-xs font-semibold rounded-lg hover:bg-slate-50 shadow-xs cursor-pointer">
                      <Upload className="w-3.5 h-3.5" />
                      Browse Files
                      <input 
                        type="file" 
                        accept="image/*" 
                        onChange={handleImageSelect}
                        className="hidden"
                      />
                    </label>
                  </div>
                )}
              </div>
            </div>

            {/* Step 2: Voice Note Dictation */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Step 2: Voice Narrative (Optional)
                </label>
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-center">
                  {audioUrl ? (
                    <div className="space-y-3">
                      <div className="flex items-center justify-center gap-2 text-xs text-green-700 font-semibold">
                        <Check className="w-4 h-4" />
                        <span>Voice Memo Captured!</span>
                      </div>
                      <audio src={audioUrl} controls className="w-full h-10 px-2" />
                      <button 
                        type="button" 
                        onClick={deleteRecording}
                        className="text-xs text-red-600 font-semibold hover:underline flex items-center gap-1 mx-auto"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Delete Voice Memo
                      </button>
                    </div>
                  ) : isRecording ? (
                    <div className="space-y-3 py-1.5 animate-pulse">
                      <div className="flex items-center justify-center gap-2">
                        <span className="w-2.5 h-2.5 bg-red-600 rounded-full animate-ping"></span>
                        <span className="text-xs font-bold text-red-600 uppercase tracking-wider">Recording Voice...</span>
                      </div>
                      <p className="text-2xl font-mono font-bold text-slate-800">
                        00:{recordingSeconds.toString().padStart(2, '0')}
                      </p>
                      <button 
                        type="button"
                        onClick={stopRecording}
                        className="bg-red-600 hover:bg-red-700 text-white rounded-full p-3 mx-auto shadow-md transition-all flex items-center justify-center gap-1.5 text-xs font-bold px-4"
                      >
                        <Square className="w-4 h-4 fill-white" />
                        Stop Recording
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3 py-1.5">
                      <p className="text-xs text-slate-500">Record a voice explanation. AI will transcribe it.</p>
                      <button 
                        type="button"
                        onClick={startRecording}
                        className="bg-blue-600 hover:bg-blue-700 text-white rounded-full p-3 mx-auto shadow-md transition-all flex items-center justify-center gap-1.5 text-xs font-bold px-4 hover:scale-105"
                      >
                        <Mic className="w-4 h-4" />
                        Start Dictating
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Step 3: Location Coordinates */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Step 3: Precise GPS Tagging
                </label>
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col justify-between h-[124px]">
                  {lat && lng ? (
                    <div className="text-left space-y-2">
                      <div className="flex items-center gap-1 text-xs text-blue-700 font-semibold">
                        <MapPin className="w-4 h-4 shrink-0" />
                        <span className="truncate">{address}</span>
                      </div>
                      <p className="text-[10px] font-mono text-slate-400">
                        Latitude: {lat.toFixed(6)}, Longitude: {lng.toFixed(6)}
                      </p>
                      <button 
                        type="button" 
                        onClick={detectLocation}
                        className="text-xs text-slate-500 font-semibold hover:underline flex items-center gap-1"
                      >
                        <RotateCcw className="w-3 h-3" />
                        Re-acquire GPS Coordinates
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3 text-center my-auto">
                      <p className="text-xs text-slate-500">Enable location tag so repair crews can locate the problem.</p>
                      <button 
                        type="button"
                        onClick={detectLocation}
                        disabled={isLocating}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 text-slate-700 text-xs font-semibold rounded-lg hover:bg-slate-50 shadow-xs"
                      >
                        {isLocating ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-500" />
                            Acquiring GPS...
                          </>
                        ) : (
                          <>
                            <MapPin className="w-3.5 h-3.5 text-blue-500" />
                            Detect My Location
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Step 4: Short Description Details */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Step 4: Problem Narrative
              </label>
              <textarea 
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe the issue... (e.g., There is a 6-inch deep pothole on the corner of Elm Street blocking the lane, causing cars to swerve dangerously)"
                className="w-full border border-slate-200 rounded-xl p-3 text-sm focus:outline-none focus:border-blue-500 min-h-[100px]"
              />
            </div>

            {/* Submit Triage to AI */}
            <button 
              type="button"
              onClick={triggerAIAnalysis}
              className="w-full bg-gradient-to-r from-blue-600 via-indigo-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 text-white font-bold py-3 rounded-xl text-sm flex items-center justify-center gap-2 transition-all shadow-md hover:scale-[1.01]"
              id="analyze-with-ai-btn"
            >
              <Sparkles className="w-4 h-4 animate-pulse text-amber-300" />
              Analyze and Route with Gemini AI
            </button>
          </motion.div>
        )}

        {/* AI Loading Steps */}
        {isAnalyzing && (
          <motion.div 
            key="loading-stage"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="py-12 text-center space-y-6"
            id="ai-loading-screen"
          >
            <div className="relative inline-block" id="sparkle-loader">
              <div className="w-16 h-16 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
              <Sparkles className="w-6 h-6 text-amber-500 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
            </div>
            
            <div className="space-y-2">
              <h3 className="text-lg font-display font-extrabold text-slate-800 animate-pulse">Gemini Analysis in Progress...</h3>
              <p className="text-sm font-semibold text-indigo-600">{analysisStep}</p>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                Our multi-modal AI parses images, transcribes vocal statements, identifies classifications, and compares regional duplicates.
              </p>
            </div>
          </motion.div>
        )}

        {/* AI Analysis Result & Edit Screen */}
        {aiResult && !isAnalyzing && (
          <motion.div 
            key="edit-stage"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
            id="ai-results-dashboard"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-lg font-display font-extrabold text-slate-900 flex items-center gap-1.5">
                  <Sparkles className="w-5 h-5 text-amber-500" />
                  Gemini Triage Evaluation
                </h3>
                <p className="text-xs text-slate-500">Verify the parameters routed by Gemini before logging the permanent registry.</p>
              </div>
              <button 
                type="button" 
                onClick={() => setAiResult(null)}
                className="text-xs text-slate-500 hover:text-slate-800 font-bold flex items-center gap-1 border border-slate-200 px-2.5 py-1 rounded-lg"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Start Over
              </button>
            </div>

            {/* DUPLICATE ALERTS PANEL */}
            {aiResult.isDuplicate && aiResult.duplicateIssueId && (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex gap-3 text-xs text-amber-900" id="duplicate-warning-banner">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="space-y-2">
                  <span className="font-bold block">🚨 Potential Duplicate Report Found!</span>
                  <p>{aiResult.duplicateExplanation}</p>
                  <div className="flex gap-2 pt-1">
                    <button 
                      type="button"
                      onClick={() => handleSupportDuplicate(aiResult.duplicateIssueId!)}
                      disabled={isSubmitting}
                      className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-md transition-all shadow-xs"
                    >
                      Upvote & Support Existing Ticket instead (+5 Points)
                    </button>
                    <button 
                      type="button"
                      onClick={() => onViewIssue(aiResult.duplicateIssueId!)}
                      className="px-3 py-1.5 bg-white border border-amber-300 text-amber-700 font-bold rounded-md hover:bg-amber-100"
                    >
                      View Match Details
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* EDITABLE SUBMISSION SCHEMAS */}
            <form onSubmit={handleFinalSubmit} className="space-y-4" id="final-submit-form">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  AI Generated Ticket Title
                </label>
                <input 
                  type="text"
                  value={finalTitle}
                  onChange={(e) => setFinalTitle(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl p-2.5 text-sm font-semibold text-slate-900 focus:outline-none focus:border-blue-500"
                  required
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Categorization
                  </label>
                  <select 
                    value={finalCategory}
                    onChange={(e) => setFinalCategory(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl p-2.5 text-sm font-semibold text-slate-700 focus:outline-none"
                  >
                    <option value="Potholes & Roads">Potholes & Roads</option>
                    <option value="Waste & Sanitation">Waste & Sanitation</option>
                    <option value="Streetlights & Electricity">Streetlights & Electricity</option>
                    <option value="Water & Sewage">Water & Sewage</option>
                    <option value="Public Parks">Public Parks</option>
                    <option value="Vandalism & Graffiti">Vandalism & Graffiti</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Municipal Routing Department
                  </label>
                  <select 
                    value={finalDepartment}
                    onChange={(e) => setFinalDepartment(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl p-2.5 text-sm font-semibold text-slate-700 focus:outline-none"
                  >
                    <option value="Public Works Dept">Public Works Dept</option>
                    <option value="Sanitation Department">Sanitation Department</option>
                    <option value="Traffic Engineering">Traffic Engineering</option>
                    <option value="Water & Sewage Authority">Water & Sewage Authority</option>
                    <option value="Parks & Recreation">Parks & Recreation</option>
                    <option value="City Code Enforcement">City Code Enforcement</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    AI Assessed Severity
                  </label>
                  <select 
                    value={finalSeverity}
                    onChange={(e) => setFinalSeverity(e.target.value as IssueSeverity)}
                    className="w-full border border-slate-200 rounded-xl p-2.5 text-sm font-semibold text-slate-700 focus:outline-none"
                  >
                    <option value="Low">Low - Cosmetic/Convenience</option>
                    <option value="Medium">Medium - Standard Issue</option>
                    <option value="High">High - Structural/Interrupted Service</option>
                    <option value="Critical">Critical - Active Hazard Risk</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    AI Predicted Priority
                  </label>
                  <select 
                    value={finalPriority}
                    onChange={(e) => setFinalPriority(e.target.value as IssuePriority)}
                    className="w-full border border-slate-200 rounded-xl p-2.5 text-sm font-semibold text-slate-700 focus:outline-none"
                  >
                    <option value="Low">Low - Standard Backlog</option>
                    <option value="Medium">Medium - Routine Dispatch</option>
                    <option value="High">High - Expedited Repair</option>
                    <option value="Critical">Critical - Immediate Emergency Patrol</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Standardized Complaint Summary (Editable)
                </label>
                <textarea 
                  value={finalDescription}
                  onChange={(e) => setFinalDescription(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl p-3 text-sm focus:outline-none focus:border-blue-500 min-h-[100px]"
                  required
                />
              </div>

              <div className="flex gap-3 pt-3">
                <button 
                  type="button"
                  onClick={() => setAiResult(null)}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2.5 rounded-xl text-sm transition-all text-center"
                >
                  Adjust Attachments
                </button>
                <button 
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 rounded-xl text-sm transition-all text-center flex items-center justify-center gap-1.5 glow-btn"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Logging to Registry...
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      Publish Community Report (+15 Points)
                    </>
                  )}
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
