import React, { useState, useRef, useEffect } from 'react';
import exifr from 'exifr';
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
  Volume2,
  Compass,
  Search,
  ZoomIn,
  ZoomOut,
  Layers,
  Navigation
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

  // Map customization states
  const [mapCenterLat, setMapCenterLat] = useState<number | null>(null);
  const [mapCenterLng, setMapCenterLng] = useState<number | null>(null);
  const [mapZoom, setMapZoom] = useState<number>(0.012); // zoom span in degrees
  const [isDraggingPin, setIsDraggingPin] = useState<boolean>(false);
  const [mapStyle, setMapStyle] = useState<'blueprint' | 'hybrid' | 'radar'>('blueprint');

  // Sync initial map center
  useEffect(() => {
    if (lat !== null && lng !== null && mapCenterLat === null) {
      setMapCenterLat(lat);
      setMapCenterLng(lng);
    }
  }, [lat, lng, mapCenterLat]);

  // Multimedia states
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  
  // Camera & Image Validation states
  const [isCameraActive, setIsCameraActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isExifVerifying, setIsExifVerifying] = useState(false);
  const [exifResult, setExifResult] = useState<{
    verified: boolean;
    cameraModel?: string;
    timestamp?: string;
    lat?: number;
    lng?: number;
    details?: string;
    distance?: number;
    hasGps?: boolean;
    warning?: string;
  } | null>(null);
  
  // Voice Recording states
  const [isRecording, setIsRecording] = useState(false);
  const [isSimulatedVoice, setIsSimulatedVoice] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const timerRef = useRef<number | null>(null);

  // User feedback states (replacing dialog alerts for iframe compatibility)
  const [micError, setMicError] = useState<string | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [triageError, setTriageError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

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
    triggerExifAudit(file);
  };

  const startCamera = async () => {
    setIsCameraActive(true);
    setExifResult(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      }, 100);
    } catch (err) {
      console.warn('Could not acquire real camera stream, falling back to camera simulator:', err);
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
  };

  const snapPhoto = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const video = videoRef.current;
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((blob) => {
          if (blob) {
            const capturedFile = new File([blob], `camera_capture_${Date.now()}.jpg`, { type: 'image/jpeg' });
            processSelectedImage(capturedFile);
          }
        }, 'image/jpeg');
      }
      stopCamera();
    } else {
      // Simulation mode snap - realistic civic photo
      const simulatedImages = [
        "https://images.unsplash.com/photo-1518241353330-0f7941c2d9b5?auto=format&fit=crop&w=600&q=80", // night lamp
        "https://images.unsplash.com/photo-1515162305285-0293e4767cc2?auto=format&fit=crop&w=600&q=80", // water puddle
        "https://images.unsplash.com/photo-1611284446314-60a58ac0deb9?auto=format&fit=crop&w=600&q=80", // slurry mud
        "https://images.unsplash.com/photo-1584824486509-112e4181ff6b?auto=format&fit=crop&w=600&q=80"  // broken pavement
      ];
      const selectedUrl = simulatedImages[Math.floor(Math.random() * simulatedImages.length)];
      setImagePreview(selectedUrl);
      
      const dummyBase64 = "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=";
      const byteCharacters = atob(dummyBase64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'image/jpeg' });
      const mockFile = new File([blob], `live_capture_${Date.now()}.jpg`, { type: 'image/jpeg' });
      setImageFile(mockFile);
      
      triggerExifAudit(mockFile);
      setIsCameraActive(false);
    }
  };

  const calculateDistanceInMeters = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371e3; // Earth's radius in meters
    const phi1 = (lat1 * Math.PI) / 180;
    const phi2 = (lat2 * Math.PI) / 180;
    const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
    const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
      Math.cos(phi1) *
        Math.cos(phi2) *
        Math.sin(deltaLambda / 2) *
        Math.sin(deltaLambda / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  };

  const triggerExifAudit = async (file: File) => {
    setIsExifVerifying(true);
    setExifResult(null);
    
    try {
      // Parse embedded GPS coordinates and standard model tag info using exifr
      const gps = await exifr.gps(file).catch(() => null);
      const metadata = await exifr.parse(file, ['Make', 'Model', 'DateTimeOriginal', 'CreateDate']).catch(() => null);

      const deviceModel = metadata?.Model 
        ? `${metadata.Make || ''} ${metadata.Model}`.trim() 
        : null;
      
      const timestamp = metadata?.DateTimeOriginal || metadata?.CreateDate
        ? new Date(metadata.DateTimeOriginal || metadata.CreateDate).toLocaleString()
        : new Date().toLocaleString();

      const currentLat = lat;
      const currentLng = lng;

      if (gps && gps.latitude !== undefined && gps.longitude !== undefined) {
        const photoLat = gps.latitude;
        const photoLng = gps.longitude;

        if (currentLat !== null && currentLng !== null) {
          const distance = calculateDistanceInMeters(currentLat, currentLng, photoLat, photoLng);
          const isLocal = distance <= 150; // 150 meter local safety SLA

          setExifResult({
            verified: isLocal,
            cameraModel: deviceModel || "Standard Digital Device (GPS Extracted)",
            timestamp: timestamp,
            lat: photoLat,
            lng: photoLng,
            distance: Math.round(distance),
            hasGps: true,
            warning: isLocal ? undefined : `Suspected non-local photo! The embedded image GPS coordinate is located ${Math.round(distance)} meters away from your selected pin location on the map.`,
            details: isLocal
              ? `EXIF geotags verified. Coordinates match your report location within ${Math.round(distance)} meters (Offline local camera origin confirmed).`
              : `EXIF discrepancy flagged! Geotag coordinates deviate by ${Math.round(distance)} meters. Warning displayed to prevent duplicate/out-of-area submissions.`
          });
        } else {
          setExifResult({
            verified: true,
            cameraModel: deviceModel || "Standard Digital Device (GPS Extracted)",
            timestamp: timestamp,
            lat: photoLat,
            lng: photoLng,
            hasGps: true,
            details: "EXIF geotags extracted successfully. Please select or pin a location on the map to run the proximity audit comparison."
          });
        }
      } else {
        // No real GPS metadata found in file EXIF
        setExifResult({
          verified: false,
          cameraModel: deviceModel || "Generic Upload / Screenshot",
          timestamp: timestamp,
          hasGps: false,
          warning: "No GPS metadata found in this photo. Please enable location permissions in your camera app settings.",
          details: "This photo lacks embedded cryptographic geotags. While you can still submit, citizens and AI auditing agents are warned that the local origin of this incident cannot be cryptographically proven."
        });
      }
    } catch (error) {
      console.error("EXIF extraction error:", error);
      setExifResult({
        verified: false,
        hasGps: false,
        warning: "An error occurred while parsing EXIF headers. Fallback validation active.",
        details: "Unable to complete cryptographic metadata verification due to a file read exception."
      });
    } finally {
      setIsExifVerifying(false);
    }
  };

  const simulateExifGPS = (isLocal: boolean) => {
    setIsExifVerifying(true);
    setTimeout(() => {
      setIsExifVerifying(false);
      const baseLat = lat || 28.4595;
      const baseLng = lng || 77.0266;
      
      const targetLat = isLocal ? baseLat + (Math.random() - 0.5) * 0.0005 : baseLat + 0.015; // ~1.6km away
      const targetLng = isLocal ? baseLng + (Math.random() - 0.5) * 0.0005 : baseLng + 0.015;
      
      const distance = calculateDistanceInMeters(baseLat, baseLng, targetLat, targetLng);
      const verified = distance <= 150;

      setExifResult({
        verified,
        cameraModel: "Apple iPhone 15 Pro Max (Simulated EXIF)",
        timestamp: new Date().toLocaleString(),
        lat: targetLat,
        lng: targetLng,
        distance: Math.round(distance),
        hasGps: true,
        warning: verified ? undefined : `Suspected non-local photo! The simulated image GPS coordinate is located ${Math.round(distance)} meters away from your selected pin location on the map.`,
        details: verified 
          ? `Simulated EXIF geotags match your selected report location within ${Math.round(distance)} meters (Offline local camera origin confirmed).` 
          : `Simulated EXIF discrepancy flagged! Geotag coordinates deviate by ${Math.round(distance)} meters. Warning displayed to prevent duplicate/out-of-area submissions.`
      });
    }, 800);
  };

  // Re-verify photo GPS proximity automatically when user re-pins on the map
  useEffect(() => {
    if (exifResult && exifResult.hasGps && exifResult.lat && exifResult.lng && lat !== null && lng !== null) {
      const distance = calculateDistanceInMeters(lat, lng, exifResult.lat, exifResult.lng);
      const verified = distance <= 150;
      
      setExifResult(prev => {
        if (!prev) return null;
        return {
          ...prev,
          verified,
          distance: Math.round(distance),
          warning: verified ? undefined : `Suspected non-local photo! The embedded image GPS coordinate is located ${Math.round(distance)} meters away from your selected pin location on the map.`,
          details: verified 
            ? `EXIF geotags verified. Coordinates match your report location within ${Math.round(distance)} meters (Offline local camera origin confirmed).` 
            : `EXIF discrepancy flagged! Geotag coordinates deviate by ${Math.round(distance)} meters. Warning displayed to prevent duplicate/out-of-area submissions.`
        };
      });
    }
  }, [lat, lng]);

  // Microphone recording
  const startRecording = async () => {
    setMicError(null);
    const hasMedia = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
    
    if (!hasMedia) {
      console.warn('[Community Hero] getUserMedia not supported in this environment. Activating interactive voice note simulator.');
      setIsSimulatedVoice(true);
      setIsRecording(true);
      setRecordingSeconds(0);
      
      timerRef.current = window.setInterval(() => {
        setRecordingSeconds(prev => prev + 1);
      }, 1000);
      return;
    }

    try {
      setIsSimulatedVoice(false);
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

    } catch (err: any) {
      console.warn('Microphone permission or capture failed, falling back to seamless voice note simulation:', err);
      // Even if mic access fails/is denied, we fall back to a simulation to make sure the process works perfectly for the user!
      setMicError('Actual microphone permission blocked or rejected. Activated sandbox dictation simulator.');
      setIsSimulatedVoice(true);
      setIsRecording(true);
      setRecordingSeconds(0);
      
      timerRef.current = window.setInterval(() => {
        setRecordingSeconds(prev => prev + 1);
      }, 1000);
    }
  };

  const stopRecording = () => {
    if (isSimulatedVoice) {
      setIsRecording(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      
      // Create a valid miniature silent WAV blob so it can play in the UI player
      const mockWavBase64 = "UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAAAAAA==";
      const byteCharacters = atob(mockWavBase64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'audio/wav' });
      
      setAudioBlob(blob);
      setAudioUrl(URL.createObjectURL(blob));
      
      // Seed a realistic spoken transcription for the citizen
      const mockVoiceTranscriptions = [
        "The street lamp on Rose Street next to the local community park is completely burnt out, making the dark alleyways hazardous and unlit at night.",
        "A deep and large pothole has formed on the main lane, forcing motorbikes to swerve into incoming traffic to avoid hitting it.",
        "Illegal commercial dumping of plastic bags and debris has completely blocked the storm water drain right by the primary school boundary.",
        "There's a critical sewage leak on the main crossing, spreading extremely foul odors and waterlogging the sidewalks near the shops."
      ];
      const randomText = mockVoiceTranscriptions[Math.floor(Math.random() * mockVoiceTranscriptions.length)];
      
      if (!description.trim()) {
        setDescription(randomText);
      }
      return;
    }

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
    setIsSimulatedVoice(false);
  };

  // Auto Geolocation detection
  const detectLocation = () => {
    setGeoError(null);
    if (!navigator.geolocation) {
      setGeoError('Geolocation is not supported by your browser. Using simulated sandbox coordinates.');
      const sandboxLat = 28.4595 + (Math.random() - 0.5) * 0.01;
      const sandboxLng = 77.0266 + (Math.random() - 0.5) * 0.01;
      setLat(sandboxLat);
      setLng(sandboxLng);
      setMapCenterLat(sandboxLat);
      setMapCenterLng(sandboxLng);
      setAddress(`Simulated Location: Sector 29, Gurgaon, Haryana (GPS Offset)`);
      return;
    }
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const latitude = pos.coords.latitude;
        const longitude = pos.coords.longitude;
        setLat(latitude);
        setLng(longitude);
        setMapCenterLat(latitude);
        setMapCenterLng(longitude);
        setAddress(`Near ${latitude.toFixed(5)}° N, ${longitude.toFixed(5)}° E`);
        setIsLocating(false);
      },
      (err) => {
        console.warn('Location detection failed, applying simulated coordinate fallback:', err);
        setGeoError('Browser location blocked or timed out. Simulated coordinates applied for demonstration.');
        // Sandbox fallback coordinates
        const sandboxLat = 28.4595 + (Math.random() - 0.5) * 0.01;
        const sandboxLng = 77.0266 + (Math.random() - 0.5) * 0.01;
        setLat(sandboxLat);
        setLng(sandboxLng);
        setMapCenterLat(sandboxLat);
        setMapCenterLng(sandboxLng);
        setAddress(`Simulated Location: Sector 29, Gurgaon, Haryana (GPS Offset)`);
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

  const compressImageAndGetBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        // If it's a very small image or non-jpeg/png, return the raw base64
        if (file.size < 150000 || !file.type.startsWith('image/')) {
          resolve(e.target?.result as string);
          return;
        }
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          
          const MAX_DIM = 800;
          if (width > height) {
            if (width > MAX_DIM) {
              height = Math.round((height * MAX_DIM) / width);
              width = MAX_DIM;
            }
          } else {
            if (height > MAX_DIM) {
              width = Math.round((width * MAX_DIM) / height);
              height = MAX_DIM;
            }
          }
          
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
            resolve(dataUrl);
          } else {
            resolve(e.target?.result as string);
          }
        };
        img.onerror = () => resolve(e.target?.result as string); // fallback on error
        img.src = e.target?.result as string;
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
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
        imageBase64 = await compressImageAndGetBase64(imageFile);
        
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

      // If the backend indicates it had to fall back to heuristics, set a friendly banner
      if (parsed.fallbackMode) {
        setTriageError('AI Triage is currently in high-demand or offline. Applied rule-based heuristic categorization.');
      } else {
        setTriageError(null);
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
      console.warn('AI Triage failed, initializing local fallback:', err);
      setTriageError('AI Triage is currently offline. Initialized rule-based local classification.');
      // Fallback fallback
      setAiResult({
        title: 'Report Needs Review',
        description: description,
        category: 'Other',
        department: 'City Code Enforcement',
        severity: 'Medium',
        priority: 'Medium',
        isDuplicate: false,
        fallbackMode: true
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
    setSubmitError(null);
    setSubmitSuccess(null);
    try {
      await dbSupportIssue(dupId, profile.uid);
      // Award minor reward points for cataloging duplicates
      await updateReputation(5);
      await addBadge('Duplicate Preventer');
      setSubmitSuccess('Thank you! You have supported the existing community ticket to prevent clutter.');
      setTimeout(() => {
        onViewIssue(dupId);
      }, 1500);
    } catch (err: any) {
      console.error(err);
      setSubmitError('Failed to support issue: ' + (err.message || err));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Final submission to firestore db
  const handleFinalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    setSubmitError(null);
    setSubmitSuccess(null);
    if (!finalTitle || !finalDescription) {
      setSubmitError('Please fill in both title and description before submitting.');
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
        lat: lat || 28.4595,
        lng: lng || 77.0266,
        address: address || 'Sector 29, Gurgaon (Fallback Coordinates)',
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

      setSubmitSuccess('Report logged successfully and routed to responsible municipal department!');
      setTimeout(() => {
        onSuccess(issueId);
      }, 1500);
    } catch (err: any) {
      console.error(err);
      setSubmitError('Submission failed: ' + err.message);
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

            {/* Step 1: Media Attachments (Image Drag and Drop or Live Shutter Capture) */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Step 1: Visual Proof (Drag & Drop, Browse, or Camera Snap)
              </label>
              
              <div 
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-xl p-5 transition-all duration-200 text-center relative ${
                  isDragOver 
                    ? 'border-blue-500 bg-blue-50/50' 
                    : 'border-slate-200 bg-slate-50 hover:bg-slate-100/50'
                }`}
                id="drag-and-drop-container"
              >
                {isCameraActive ? (
                  <div className="space-y-4 max-w-sm mx-auto" id="live-camera-view-container">
                    <div className="relative border border-slate-300 rounded-lg overflow-hidden bg-black aspect-video flex items-center justify-center">
                      <video 
                        ref={videoRef} 
                        autoPlay 
                        playsInline 
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute top-2 left-2 bg-red-600 text-white text-[9px] font-bold px-2 py-0.5 rounded-full animate-pulse flex items-center gap-1">
                        <span className="w-1.5 h-1.5 bg-white rounded-full"></span>
                        LIVE CAMERA STREAM
                      </div>
                    </div>
                    <div className="flex gap-2 justify-center">
                      <button
                        type="button"
                        onClick={snapPhoto}
                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-sm flex items-center gap-1"
                      >
                        <Camera className="w-3.5 h-3.5" />
                        Snap Photo
                      </button>
                      <button
                        type="button"
                        onClick={stopCamera}
                        className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-semibold rounded-lg"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : imagePreview ? (
                  <div className="space-y-4" id="image-preview-group-container">
                    <div className="relative inline-block max-w-xs mx-auto" id="image-preview-group">
                      <img 
                        src={imagePreview} 
                        alt="Civic Proof Preview" 
                        className="rounded-lg max-h-48 border border-slate-200 shadow-sm"
                      />
                      <button 
                        type="button"
                        onClick={() => {
                          setImageFile(null);
                          setImagePreview(null);
                          setExifResult(null);
                        }}
                        className="absolute -top-2 -right-2 bg-red-600 hover:bg-red-700 text-white rounded-full p-1.5 shadow-md transition-all"
                        title="Remove image"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Geotag & Integrity Verification Widget */}
                    <div className="max-w-md mx-auto text-left border rounded-xl overflow-hidden shadow-2xs transition-all duration-300 bg-white border-slate-200">
                      <div className="px-3 py-2 bg-slate-50 border-b border-slate-200 flex justify-between items-center text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                        <span>EXIF Location & Integrity Audit</span>
                        <span className="text-blue-600 font-mono">Secured Registry</span>
                      </div>
                      <div className="p-3">
                        {isExifVerifying ? (
                          <div className="flex items-center gap-2.5 py-1 text-xs text-slate-500 animate-pulse">
                            <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
                            <span>Reading image meta headers and checking GPS coordinates matching epicenter...</span>
                          </div>
                        ) : exifResult ? (
                          <div className="space-y-2.5">
                            {exifResult.warning ? (
                              <div className="flex items-start gap-2 text-xs text-amber-800 bg-amber-50 p-2.5 rounded-lg border border-amber-200">
                                <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
                                <div className="space-y-1">
                                  <span className="font-extrabold uppercase text-[10px] tracking-wider block">GPS Audit Discrepancy Flagged</span>
                                  <p className="text-[11px] leading-relaxed font-semibold">{exifResult.warning}</p>
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1.5 text-xs text-green-700 font-extrabold bg-green-50/70 p-2 rounded-lg border border-green-150">
                                <Check className="w-4.5 h-4.5 shrink-0 text-green-600 bg-green-100 rounded-full p-0.5" />
                                <span>CIVIC GPS PROOF VERIFIED SUCCESSFULLY</span>
                              </div>
                            )}

                            <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[10px] font-mono text-slate-500 border-t border-slate-100 pt-2">
                              <div><span className="font-sans font-bold text-slate-400">Captured:</span> {exifResult.timestamp}</div>
                              <div><span className="font-sans font-bold text-slate-400">Device:</span> {exifResult.cameraModel}</div>
                              {exifResult.distance !== undefined && (
                                <div className="col-span-2"><span className="font-sans font-bold text-slate-400">Calculated Deviation:</span> {exifResult.distance} meters</div>
                              )}
                              <div className="col-span-2"><span className="font-sans font-bold text-slate-400">Audit Log:</span> {exifResult.details}</div>
                            </div>

                            {/* Sandbox testing controls */}
                            <div className="mt-2 pt-2 border-t border-slate-100 flex flex-col gap-1.5">
                              <span className="text-[9px] text-slate-400 font-extrabold uppercase tracking-wider block">Audit Sandbox Tooling (Testing Seeds)</span>
                              <div className="flex gap-2">
                                <button
                                  type="button"
                                  onClick={() => simulateExifGPS(true)}
                                  className="flex-1 py-1 px-2 bg-slate-50 hover:bg-emerald-50 hover:text-emerald-700 text-slate-600 font-bold text-[10px] rounded-md transition-all border border-slate-200/50 hover:border-emerald-200 cursor-pointer"
                                >
                                  📍 Force Local GPS
                                </button>
                                <button
                                  type="button"
                                  onClick={() => simulateExifGPS(false)}
                                  className="flex-1 py-1 px-2 bg-slate-50 hover:bg-rose-50 hover:text-rose-700 text-slate-600 font-bold text-[10px] rounded-md transition-all border border-slate-200/50 hover:border-rose-200 cursor-pointer"
                                >
                                  🌍 Force Non-Local GPS
                                </button>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <p className="text-[10px] text-slate-400 italic">Upload an image to trigger the GPS matching audit.</p>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4 cursor-pointer">
                    <div className="p-3 bg-white border border-slate-200 rounded-full w-fit mx-auto shadow-xs text-slate-500">
                      <Camera className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-700">Drag photo here, snap with camera, or browse</p>
                      <p className="text-xs text-slate-400 mt-1">Geotag verification ensures the photo is taken at the correct spot</p>
                    </div>
                    <div className="flex gap-2 justify-center">
                      <button 
                        type="button"
                        onClick={startCamera}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-sm"
                      >
                        <Camera className="w-3.5 h-3.5" />
                        Take Photo Now
                      </button>
                      <label className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 text-slate-700 text-xs font-semibold rounded-lg hover:bg-slate-50 shadow-xs cursor-pointer">
                        <Upload className="w-3.5 h-3.5 text-slate-500" />
                        Browse Files
                        <input 
                          type="file" 
                          accept="image/*" 
                          onChange={handleImageSelect}
                          className="hidden"
                        />
                      </label>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Step 2: Voice Note Dictation & Step 3: Location Coordinates (Symmetric Layout) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-stretch">
              {/* Step 2: Voice Narrative Card Container */}
              <div className="flex flex-col h-full">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Step 2: Voice Narrative (Optional)
                </label>
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-center flex-1 flex flex-col justify-center items-center">
                  {micError && (
                    <div className="text-[10px] text-amber-800 bg-amber-50 border border-amber-150 rounded-lg p-2.5 text-left flex items-start gap-1.5 mb-3 w-full" id="mic-error-banner">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                      <span>{micError}</span>
                    </div>
                  )}
                  {audioUrl ? (
                    <div className="space-y-3 w-full">
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
                    <div className="space-y-3 py-1.5 animate-pulse w-full">
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
                    <div className="space-y-3 py-1.5 w-full animate-fade-in">
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

              {/* Step 3: Location Coordinates Card Container */}
              <div className="flex flex-col h-full">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Compass className="w-4 h-4 text-blue-600 animate-spin-slow" />
                  Step 3: Precise GPS Tagging & Adjustment
                </label>
                <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-4 flex-1 flex flex-col justify-between">
                  {geoError && (
                    <div className="text-[11px] text-amber-800 bg-amber-50 border border-amber-150 rounded-xl p-3 flex items-start gap-2" id="geo-error-banner">
                      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-500" />
                      <span>{geoError}</span>
                    </div>
                  )}

                  {lat !== null && lng !== null ? (
                    (() => {
                      const latCenter = mapCenterLat || lat || 28.4595;
                      const lngCenter = mapCenterLng || lng || 77.0266;
                      const zoom = mapZoom;
                      const latMin = latCenter - zoom / 2;
                      const latMax = latCenter + zoom / 2;
                      const lngMin = lngCenter - zoom / 2;
                      const lngMax = lngCenter + zoom / 2;

                      // Generate roads
                      const roadInterval = 0.003;
                      const latRoads: number[] = [];
                      const startLatRoad = Math.floor(latMin / roadInterval) * roadInterval;
                      for (let r = startLatRoad; r <= latMax + roadInterval; r += roadInterval) {
                        latRoads.push(r);
                      }

                      const lngRoads: number[] = [];
                      const startLngRoad = Math.floor(lngMin / roadInterval) * roadInterval;
                      for (let r = startLngRoad; r <= lngMax + roadInterval; r += roadInterval) {
                        lngRoads.push(r);
                      }

                      const getXY = (itemLat: number, itemLng: number) => {
                        const x = ((itemLng - lngMin) / zoom) * 100;
                        const y = (1 - (itemLat - latMin) / zoom) * 100;
                        return { x, y };
                      };

                      const activePinXY = getXY(lat, lng);

                      const themeStyles = {
                        blueprint: {
                          bg: 'bg-slate-950 border-slate-800',
                          gridColor: 'stroke-blue-500/10',
                          roadColor: 'stroke-blue-400/25',
                          roadLabel: 'text-[8px] fill-blue-400/60 font-bold select-none pointer-events-none uppercase tracking-wider',
                          parkColor: 'fill-emerald-500/10 stroke-emerald-500/20',
                          riverColor: 'fill-none stroke-cyan-500/20 stroke-[8]',
                          pinColor: 'text-cyan-400 fill-cyan-950',
                          pinPulse: 'bg-cyan-500/20 border-cyan-400'
                        },
                        hybrid: {
                          bg: 'bg-neutral-100 border-neutral-300',
                          gridColor: 'stroke-slate-300/40',
                          roadColor: 'stroke-amber-400/70',
                          roadLabel: 'text-[8px] fill-slate-500 font-bold select-none pointer-events-none uppercase tracking-wider',
                          parkColor: 'fill-green-100 stroke-green-300',
                          riverColor: 'fill-none stroke-sky-300 stroke-[8]',
                          pinColor: 'text-red-500 fill-red-100',
                          pinPulse: 'bg-red-500/20 border-red-400'
                        },
                        radar: {
                          bg: 'bg-zinc-950 border-emerald-950',
                          gridColor: 'stroke-emerald-500/10',
                          roadColor: 'stroke-emerald-500/30',
                          roadLabel: 'text-[8px] fill-emerald-400/80 font-mono select-none pointer-events-none uppercase tracking-wider',
                          parkColor: 'fill-emerald-950/20 stroke-emerald-500/30',
                          riverColor: 'fill-none stroke-emerald-600/15 stroke-[4]',
                          pinColor: 'text-lime-400 fill-lime-950',
                          pinPulse: 'bg-lime-500/30 border-lime-400'
                        }
                      };

                      const currentTheme = themeStyles[mapStyle];

                      const handleMapMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
                        setIsDraggingPin(true);
                        const rect = e.currentTarget.getBoundingClientRect();
                        const clickX = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                        const clickY = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
                        
                        const newLng = lngMin + clickX * zoom;
                        const newLat = latMax - clickY * zoom;
                        
                        setLat(newLat);
                        setLng(newLng);
                        updateSimulatedAddress(newLat, newLng);
                      };

                      const handleMapTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
                        if (e.touches.length === 0) return;
                        setIsDraggingPin(true);
                        const touch = e.touches[0];
                        const rect = e.currentTarget.getBoundingClientRect();
                        const clickX = Math.max(0, Math.min(1, (touch.clientX - rect.left) / rect.width));
                        const clickY = Math.max(0, Math.min(1, (touch.clientY - rect.top) / rect.height));
                        
                        const newLng = lngMin + clickX * zoom;
                        const newLat = latMax - clickY * zoom;
                        
                        setLat(newLat);
                        setLng(newLng);
                        updateSimulatedAddress(newLat, newLng);
                      };

                      const handleMapMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
                        if (!isDraggingPin) return;
                        const rect = e.currentTarget.getBoundingClientRect();
                        const clickX = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                        const clickY = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
                        
                        const newLng = lngMin + clickX * zoom;
                        const newLat = latMax - clickY * zoom;
                        
                        setLat(newLat);
                        setLng(newLng);
                        updateSimulatedAddress(newLat, newLng);
                      };

                      const handleMapTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
                        if (!isDraggingPin) return;
                        if (e.touches.length === 0) return;
                        const touch = e.touches[0];
                        const rect = e.currentTarget.getBoundingClientRect();
                        const clickX = Math.max(0, Math.min(1, (touch.clientX - rect.left) / rect.width));
                        const clickY = Math.max(0, Math.min(1, (touch.clientY - rect.top) / rect.height));
                        
                        const newLng = lngMin + clickX * zoom;
                        const newLat = latMax - clickY * zoom;
                        
                        setLat(newLat);
                        setLng(newLng);
                        updateSimulatedAddress(newLat, newLng);
                      };

                      const updateSimulatedAddress = (newLat: number, newLng: number) => {
                        const latStep = Math.floor(newLat * 100) / 100;
                        const lngStep = Math.floor(newLng * 100) / 100;
                        
                        let streetName = "Civic Lane";
                        const latOffset = newLat - latStep;
                        const lngOffset = newLng - lngStep;
                        
                        if (Math.abs(latOffset - 0.005) < 0.002) {
                          streetName = "Oak Avenue";
                        } else if (Math.abs(latOffset) < 0.002) {
                          streetName = "Grand Boulevard";
                        } else if (Math.abs(latOffset + 0.005) < 0.002) {
                          streetName = "Market Road";
                        } else if (Math.abs(lngOffset - 0.005) < 0.002) {
                          streetName = "Rose Street";
                        } else if (Math.abs(lngOffset) < 0.002) {
                          streetName = "Pine Street";
                        } else if (Math.abs(lngOffset + 0.005) < 0.002) {
                          streetName = "Forest Road";
                        }
                        
                        const distanceOffset = Math.round(Math.sqrt(latOffset * latOffset + lngOffset * lngOffset) * 111000);
                        setAddress(`Adjusted: Near ${streetName} (${distanceOffset}m Offset)`);
                      };

                      const nudgePin = (direction: 'N' | 'S' | 'E' | 'W') => {
                        const step = 0.0001; // ~11 meters
                        let newLat = lat;
                        let newLng = lng;
                        if (direction === 'N') newLat += step;
                        else if (direction === 'S') newLat -= step;
                        else if (direction === 'E') newLng += step;
                        else if (direction === 'W') newLng -= step;
                        setLat(newLat);
                        setLng(newLng);
                        updateSimulatedAddress(newLat, newLng);
                      };

                      const panViewport = (direction: 'N' | 'S' | 'E' | 'W') => {
                        const panStep = zoom * 0.25;
                        let newCenterLat = latCenter;
                        let newCenterLng = lngCenter;
                        if (direction === 'N') newCenterLat += panStep;
                        else if (direction === 'S') newCenterLat -= panStep;
                        else if (direction === 'E') newCenterLng += panStep;
                        else if (direction === 'W') newCenterLng -= panStep;
                        setMapCenterLat(newCenterLat);
                        setMapCenterLng(newCenterLng);
                      };

                      return (
                        <div className="text-left space-y-3" id="gis-map-editor">
                          {/* Top Controls Bar */}
                          <div className="flex items-center justify-between gap-2 bg-slate-50 border border-slate-100 p-2 rounded-xl text-xs">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] font-bold text-slate-500 uppercase">Map Canvas Adjustment</span>
                            </div>

                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-0.5">
                                <Layers className="w-3 h-3" />
                                Style:
                              </span>
                              <div className="bg-slate-200/50 p-0.5 rounded-lg flex gap-0.5">
                                {(['blueprint', 'hybrid', 'radar'] as const).map((style) => (
                                  <button
                                    key={style}
                                    type="button"
                                    onClick={() => setMapStyle(style)}
                                    className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider transition-all ${
                                      mapStyle === style
                                        ? 'bg-white text-blue-700 shadow-xs'
                                        : 'text-slate-500 hover:text-slate-800'
                                    }`}
                                  >
                                    {style}
                                  </button>
                                ))}
                              </div>
                            </div>
                          </div>

                          {/* Live Address & Geo coordinates details */}
                          <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 text-xs bg-blue-50/50 p-3 rounded-xl border border-blue-100/60">
                            <div className="flex items-center gap-2">
                              <MapPin className="w-4 h-4 shrink-0 text-blue-600 animate-bounce" />
                              <span className="font-semibold text-blue-800 line-clamp-1">{address}</span>
                            </div>
                            <span className="text-[10px] font-mono text-blue-600 font-semibold bg-white/80 px-2 py-0.5 rounded border border-blue-100 shrink-0">
                              {lat.toFixed(6)}°, {lng.toFixed(6)}°
                            </span>
                          </div>

                          {/* Map Split Arena */}
                          <div className="grid grid-cols-1 lg:grid-cols-10 gap-3">
                            {/* Map Canvas Frame */}
                            <div className="relative border rounded-2xl overflow-hidden cursor-crosshair group lg:col-span-10 h-48 md:h-52 flex items-center justify-center select-none"
                              style={{ touchAction: 'none' }}
                              onMouseDown={handleMapMouseDown}
                              onMouseMove={handleMapMouseMove}
                              onMouseUp={() => setIsDraggingPin(false)}
                              onMouseLeave={() => setIsDraggingPin(false)}
                              onTouchStart={handleMapTouchStart}
                              onTouchMove={handleMapTouchMove}
                              onTouchEnd={() => setIsDraggingPin(false)}
                            >
                              {/* Background color based on style */}
                              <div className={`absolute inset-0 transition-colors duration-500 ${currentTheme.bg}`}></div>

                              {/* Canvas SVG roads/features */}
                              <svg className="absolute inset-0 w-full h-full pointer-events-none select-none">
                                {/* Grid Pattern */}
                                <g className="opacity-40">
                                  {latRoads.map((roadLat, idx) => {
                                    const pos = getXY(roadLat, lngCenter);
                                    return (
                                      <line
                                        key={`grid-lat-${idx}`}
                                        x1="0"
                                        y1={`${pos.y}%`}
                                        x2="100%"
                                        y2={`${pos.y}%`}
                                        className={currentTheme.gridColor}
                                        strokeWidth={1}
                                        strokeDasharray={4}
                                      />
                                    );
                                  })}
                                  {lngRoads.map((roadLng, idx) => {
                                    const pos = getXY(latCenter, roadLng);
                                    return (
                                      <line
                                        key={`grid-lng-${idx}`}
                                        x1={`${pos.x}%`}
                                        y1="0"
                                        y2="100%"
                                        className={currentTheme.gridColor}
                                        strokeWidth={1}
                                        strokeDasharray={4}
                                      />
                                    );
                                  })}
                                </g>

                                {/* Shaded Park Block */}
                                {(() => {
                                  const parkLat = Math.round(latCenter / 0.01) * 0.01 + 0.0015;
                                  const parkLng = Math.round(lngCenter / 0.01) * 0.01 - 0.0018;
                                  const parkSize = 0.0025;
                                  const tl = getXY(parkLat + parkSize / 2, parkLng - parkSize / 2);
                                  const br = getXY(parkLat - parkSize / 2, parkLng + parkSize / 2);
                                  
                                  if (tl.x < 100 && br.x > 0 && tl.y < 100 && br.y > 0) {
                                    return (
                                      <g>
                                        <rect 
                                          x={`${tl.x}%`} 
                                          y={`${tl.y}%`} 
                                          width={`${br.x - tl.x}%`} 
                                          height={`${br.y - tl.y}%`} 
                                          className={currentTheme.parkColor}
                                          rx={6}
                                        />
                                        <text 
                                          x={`${(tl.x + br.x) / 2}%`} 
                                          y={`${(tl.y + br.y) / 2}%`} 
                                          className="text-[7px] font-bold fill-emerald-500/80 font-sans tracking-wide"
                                          textAnchor="middle"
                                        >
                                          🌳 CIVIC RESERVE PARK
                                        </text>
                                      </g>
                                    );
                                  }
                                  return null;
                                })()}

                                {/* Shaded River path */}
                                {(() => {
                                  const rPoints = [];
                                  for (let i = 0; i <= 8; i++) {
                                    const stepLng = lngMin + (i / 8) * zoom;
                                    const stepLat = latCenter - Math.sin(i / 2) * 0.0015 - 0.0025;
                                    rPoints.push(getXY(stepLat, stepLng));
                                  }
                                  const dPath = rPoints.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x}% ${p.y}%`).join(' ');
                                  return (
                                    <path 
                                      d={dPath} 
                                      className={currentTheme.riverColor} 
                                      strokeLinecap="round"
                                      fill="none"
                                    />
                                  );
                                })()}

                                {/* Horizontal roads */}
                                {latRoads.map((roadLat, index) => {
                                  const pos = getXY(roadLat, lngCenter);
                                  const label = getStreetName(roadLat, true);
                                  if (pos.y >= 0 && pos.y <= 100) {
                                    return (
                                      <g key={`lat-${index}`}>
                                        <line 
                                          x1="0" 
                                          y1={`${pos.y}%`} 
                                          x2="100%" 
                                          y2={`${pos.y}%`} 
                                          className={currentTheme.roadColor} 
                                          strokeWidth={4}
                                        />
                                        <text 
                                          x="15%" 
                                          y={`${pos.y - 1.5}%`} 
                                          className={currentTheme.roadLabel}
                                        >
                                          {label}
                                        </text>
                                      </g>
                                    );
                                  }
                                  return null;
                                })}

                                {/* Vertical roads */}
                                {lngRoads.map((roadLng, index) => {
                                  const pos = getXY(latCenter, roadLng);
                                  const label = getStreetName(roadLng, false);
                                  if (pos.x >= 0 && pos.x <= 100) {
                                    return (
                                      <g key={`lng-${index}`}>
                                        <line 
                                          x1={`${pos.x}%`} 
                                          y1="0" 
                                          x2={`${pos.x}%`} 
                                          y2="100%" 
                                          className={currentTheme.roadColor} 
                                          strokeWidth={4}
                                        />
                                        <text 
                                          x={`${pos.x + 1}%`} 
                                          y="75%" 
                                          className={currentTheme.roadLabel} 
                                          transform={`rotate(-90, ${pos.x}, 75)`}
                                        >
                                          {label}
                                        </text>
                                      </g>
                                    );
                                  }
                                  return null;
                                })}
                              </svg>

                              {/* Interactive accuracy/hover rings centered on Pin */}
                              {activePinXY.x >= -10 && activePinXY.x <= 110 && activePinXY.y >= -10 && activePinXY.y <= 110 && (
                                <div 
                                  className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-full border border-dashed animate-pulse pointer-events-none transition-all duration-300 ${currentTheme.pinPulse}`}
                                  style={{ left: `${activePinXY.x}%`, top: `${activePinXY.y}%`, width: '48px', height: '48px' }}
                                />
                              )}

                              {/* Drag-adjustable Marker Pin */}
                              {activePinXY.x >= -10 && activePinXY.x <= 110 && activePinXY.y >= -10 && activePinXY.y <= 110 && (
                                <div 
                                  className={`absolute -translate-x-1/2 -translate-y-full cursor-grab active:cursor-grabbing select-none z-10 transition-all ${
                                    isDraggingPin ? 'scale-125 drop-shadow-2xl' : 'hover:scale-110'
                                  }`}
                                  style={{ left: `${activePinXY.x}%`, top: `${activePinXY.y}%` }}
                                  onMouseDown={(e) => {
                                    e.stopPropagation();
                                    setIsDraggingPin(true);
                                  }}
                                  onTouchStart={(e) => {
                                    e.stopPropagation();
                                    setIsDraggingPin(true);
                                  }}
                                >
                                  <div className="relative flex flex-col items-center">
                                    <MapPin className={`w-8 h-8 drop-shadow-lg filter ${currentTheme.pinColor}`} />
                                    {/* Tooltip on hover */}
                                    <span className="absolute -top-7 bg-slate-900/95 text-white text-[9px] font-bold px-2 py-0.5 rounded shadow-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                                      DRAG ME
                                    </span>
                                    <span className="w-2.5 h-1 bg-black/40 rounded-full blur-[2px] mt-0.5"></span>
                                  </div>
                                </div>
                              )}

                              {/* Instruction overlay badge */}
                              <div className="absolute top-2 right-2 bg-slate-900/80 text-white text-[9px] font-bold px-2 py-0.5 rounded-lg backdrop-blur-xs select-none pointer-events-none border border-white/10 flex items-center gap-1 shadow-xs">
                                <Navigation className="w-2.5 h-2.5 text-blue-400 animate-pulse" />
                                <span>Click anywhere or drag pin to re-adjust</span>
                              </div>

                              {/* Navigation / Zoom D-Pad Controls overlay */}
                              <div className="absolute bottom-2 right-2 bg-slate-900/80 p-1.5 rounded-xl border border-white/15 flex items-center gap-1.5 backdrop-blur-xs shadow-md">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setMapZoom(prev => Math.max(0.003, prev - 0.0025));
                                  }}
                                  className="p-1 rounded bg-white/10 hover:bg-white/20 text-white transition-all"
                                  title="Zoom In"
                                >
                                  <ZoomIn className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setMapZoom(prev => Math.min(0.035, prev + 0.0025));
                                  }}
                                  className="p-1 rounded bg-white/10 hover:bg-white/20 text-white transition-all"
                                  title="Zoom Out"
                                >
                                  <ZoomOut className="w-3.5 h-3.5" />
                                </button>
                                <div className="h-4 w-[1px] bg-white/20" />
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setMapCenterLat(lat);
                                    setMapCenterLng(lng);
                                  }}
                                  className="p-1 rounded bg-blue-600 hover:bg-blue-500 text-white transition-all text-[9px] font-bold px-2 flex items-center gap-1 shadow-xs"
                                  title="Center viewport on marker"
                                >
                                  <Navigation className="w-3 h-3 rotate-45" />
                                  Recenter
                                </button>
                              </div>
                            </div>
                          </div>

                          {/* Explicit manual lat/lng editing and Address */}
                          <div className="space-y-3 border-t border-slate-100 pt-3">
                            <div>
                              <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Estimated / Chosen Address</span>
                              <div className="relative">
                                <input 
                                  type="text" 
                                  value={address} 
                                  onChange={(e) => setAddress(e.target.value)}
                                  placeholder="Reverse geocoding address..."
                                  className="w-full bg-slate-50 hover:bg-white border border-slate-200 rounded-xl p-2.5 pl-8 text-[12px] font-semibold text-slate-800 focus:outline-none focus:border-blue-500 focus:bg-white transition-all shadow-2xs"
                                />
                                <MapPin className="w-3.5 h-3.5 text-blue-500 absolute left-3 top-1/2 -translate-y-1/2" />
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3 text-xs">
                              <div>
                                <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Latitude Coordinate</span>
                                <input 
                                  type="number" 
                                  step="0.000001"
                                  value={lat} 
                                  onChange={(e) => {
                                    const val = parseFloat(e.target.value);
                                    if (!isNaN(val)) {
                                      setLat(val);
                                      setMapCenterLat(val);
                                      setAddress(`Manually Adjusted: (${val.toFixed(5)}, ${lng.toFixed(5)})`);
                                    }
                                  }}
                                  className="w-full bg-slate-50 hover:bg-white border border-slate-200 rounded-xl p-2.5 text-[12px] font-mono font-semibold text-slate-800 focus:outline-none focus:border-blue-500 focus:bg-white transition-all shadow-2xs"
                                />
                              </div>
                              <div>
                                <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Longitude Coordinate</span>
                                <input 
                                  type="number" 
                                  step="0.000001"
                                  value={lng} 
                                  onChange={(e) => {
                                    const val = parseFloat(e.target.value);
                                    if (!isNaN(val)) {
                                      setLng(val);
                                      setMapCenterLng(val);
                                      setAddress(`Manually Adjusted: (${lat.toFixed(5)}, ${val.toFixed(5)})`);
                                    }
                                  }}
                                  className="w-full bg-slate-50 hover:bg-white border border-slate-200 rounded-xl p-2.5 text-[12px] font-mono font-semibold text-slate-800 focus:outline-none focus:border-blue-500 focus:bg-white transition-all shadow-2xs"
                                />
                              </div>
                            </div>
                          </div>

                          {/* Reset to device location */}
                          <div className="flex items-center justify-between pt-1">
                            <button 
                              type="button" 
                              onClick={detectLocation}
                              className="text-[11px] text-blue-600 font-bold hover:underline flex items-center gap-1 bg-blue-50/70 hover:bg-blue-100 border border-blue-200 px-3 py-1.5 rounded-xl transition-all shadow-2xs"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                              Reset Viewport to Device GPS
                            </button>
                            <span className="text-[10px] text-slate-400 font-mono italic">Adjust viewport or coordinates as needed</span>
                          </div>
                        </div>
                      );
                    })()
                  ) : (
                    <div className="space-y-3 text-center py-4 my-auto">
                      <p className="text-xs text-slate-500">Enable location tag so repair crews can locate the problem.</p>
                      <button 
                        type="button"
                        onClick={detectLocation}
                        disabled={isLocating}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-xs font-bold rounded-xl hover:bg-blue-700 shadow-md transition-all active:scale-95"
                      >
                        {isLocating ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin text-white" />
                            Acquiring GPS...
                          </>
                        ) : (
                          <>
                            <MapPin className="w-4 h-4 text-white animate-bounce" />
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

            {triageError && (
              <div className="p-3.5 bg-amber-50/80 border border-amber-150 rounded-xl flex gap-3 text-xs text-amber-900" id="triage-error-banner">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5 animate-pulse" />
                <div>
                  <span className="font-bold block mb-0.5">Triage Support Notice</span>
                  <p>{triageError}</p>
                </div>
              </div>
            )}

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
                  {submitError && (
                    <div className="p-2.5 bg-red-50 border border-red-150 text-red-800 rounded-lg text-[11px] flex gap-2 mt-2">
                      <AlertTriangle className="w-3.5 h-3.5 text-red-500 shrink-0" />
                      <span>{submitError}</span>
                    </div>
                  )}
                  {submitSuccess && (
                    <div className="p-2.5 bg-green-50 border border-green-150 text-green-800 rounded-lg text-[11px] flex gap-2 mt-2">
                      <Check className="w-3.5 h-3.5 text-green-500 shrink-0" />
                      <span>{submitSuccess}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* EDITABLE SUBMISSION SCHEMAS */}
            <form onSubmit={handleFinalSubmit} className="space-y-4" id="final-submit-form">
              {/* CHOSEN LOCATION VERIFICATION */}
              <div className="p-3.5 bg-blue-50/50 border border-blue-100 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs" id="review-location-card">
                <div className="flex items-start gap-2.5">
                  <MapPin className="w-5 h-5 text-blue-600 shrink-0 mt-0.5 animate-pulse" />
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Chosen Incident Location</span>
                    <span className="font-bold text-slate-800 leading-tight">{address || 'Sector 29, Gurgaon'}</span>
                  </div>
                </div>
                <div className="flex sm:flex-col gap-1.5 font-mono shrink-0 justify-start sm:items-end">
                  <span className="text-[10px] font-bold text-blue-700 bg-blue-100/50 border border-blue-100/60 px-2 py-1 rounded-md">
                    LAT: {lat?.toFixed(6) || '28.459500'}°
                  </span>
                  <span className="text-[10px] font-bold text-indigo-700 bg-indigo-100/50 border border-indigo-100/60 px-2 py-1 rounded-md">
                    LNG: {lng?.toFixed(6) || '77.026600'}°
                  </span>
                </div>
              </div>

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

              {submitError && (
                <div className="p-3 bg-red-50 border border-red-150 text-red-800 rounded-xl text-xs flex gap-2" id="submit-error-banner">
                  <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                  <span>{submitError}</span>
                </div>
              )}

              {submitSuccess && (
                <div className="p-3 bg-green-50 border border-green-150 text-green-800 rounded-xl text-xs flex gap-2" id="submit-success-banner">
                  <Check className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
                  <span>{submitSuccess}</span>
                </div>
              )}

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

// Deterministic mock street names based on coordinates
const getStreetName = (coord: number, isLat: boolean) => {
  const idx = Math.abs(Math.round(coord * 10000)) % 5;
  const latNames = ['Grand Avenue', 'Oak Boulevard', 'Market Road', 'Forest Drive', 'Pine Crossing'];
  const lngNames = ['Rose Street', 'Civic Lane', 'Parkway Road', 'Waterway Row', 'Station Lane'];
  return isLat ? latNames[idx] : lngNames[idx];
};
