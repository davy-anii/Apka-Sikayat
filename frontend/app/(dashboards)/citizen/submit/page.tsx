"use client";

import React, { useState } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { motion } from 'framer-motion';
import { useDropzone } from 'react-dropzone';
import { 
  FileText, MapPin, UploadCloud, Camera, Video, 
  Mic, ShieldAlert, ArrowRight, EyeOff, File,
  Brain, Loader2, CheckCircle2, AlertTriangle
} from 'lucide-react';
import { complaintSchema, ComplaintFormValues, CATEGORIES, DISTRICTS } from '@/lib/validations/complaint';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/lib/firebase';
import { doc, setDoc } from 'firebase/firestore';

// Dynamically import the map to prevent Next.js SSR errors
const LocationPicker = dynamic(() => import('@/components/maps/LocationPicker'), { ssr: false });

export default function SubmitComplaintPage() {
  const { user, profile } = useAuth();
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  
  // AI Validation States
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiAnalysisResult, setAiAnalysisResult] = useState<any>(null);
  const [aiError, setAiError] = useState<string | null>(null);

  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<ComplaintFormValues>({
    resolver: zodResolver(complaintSchema),
    defaultValues: { priority: 'LOW', isAnonymous: false }
  });

  const isAnonymous = watch('isAnonymous');

  const validateImage = async (file: File): Promise<boolean> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64Data = reader.result as string;
        try {
          setIsAnalyzing(true);
          setAiError(null);
          setAiAnalysisResult(null);

          const currentValues = watch();

          const response = await fetch("/api/validate-grievance", {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              image: base64Data,
              title: currentValues.title,
              description: currentValues.description,
              category: currentValues.category,
              district: currentValues.district
            })
          });

          if (!response.ok) {
            const errBody = await response.json();
            throw new Error(errBody.error || "Failed to validate image.");
          }

          const result = await response.json();
          if (result.accepted && result.is_grievance) {
            setAiAnalysisResult(result);
            
            // Auto-fill form fields
            if (result.grievance_category) {
              const matchedCategory = CATEGORIES.find(
                cat => cat.toLowerCase().replace(/[^a-z]/g, "") === result.grievance_category.toLowerCase().replace(/[^a-z]/g, "")
              );
              if (matchedCategory) {
                setValue("category", matchedCategory);
              } else {
                setValue("category", "Other");
              }
            }
            if (result.severity) {
              const severityUpper = result.severity.toUpperCase();
              if (["LOW", "MEDIUM", "HIGH", "CRITICAL"].includes(severityUpper)) {
                setValue("priority", severityUpper as any);
              }
            }
            resolve(true);
          } else {
            setAiError(result.reason || "This image does not represent a valid public grievance.");
            resolve(false);
          }
        } catch (error: any) {
          console.error("AI Validation Error:", error);
          setAiError(error.message || "Failed to connect to AI validation service.");
          resolve(false);
        } finally {
          setIsAnalyzing(false);
        }
      };
      reader.onerror = () => {
        setAiError("Failed to read image file.");
        resolve(false);
      };
      reader.readAsDataURL(file);
    });
  };

  // Drag and Drop configuration
  const { getRootProps, getInputProps } = useDropzone({
    accept: { 'image/*': [], 'video/*': [], 'audio/*': [] },
    onDrop: async (acceptedFiles) => {
      const validatedFiles: File[] = [];
      for (const file of acceptedFiles) {
        if (file.type.startsWith("image/")) {
          const isValid = await validateImage(file);
          if (isValid) {
            validatedFiles.push(file);
          }
        } else {
          // Non-images (audio/video) are accepted directly as before
          validatedFiles.push(file);
        }
      }
      if (validatedFiles.length > 0) {
        setFiles((prev) => [...prev, ...validatedFiles]);
      }
    }
  });

  const onSubmit = async (data: ComplaintFormValues) => {
    if (!user) {
      alert("You must be logged in to submit a complaint.");
      return;
    }

    setIsSubmitting(true);
    try {
      // Generate a unique, timestamp-based complaint ID that cannot collide with mock data
      const now = new Date();
      const datePart = now.toISOString().slice(0, 10).replace(/-/g, ''); // e.g. 20260620
      const randPart = Math.floor(1000 + Math.random() * 9000);          // e.g. 4732
      const complaintId = `CMP-${datePart}-${randPart}`;                 // e.g. CMP-20260620-4732

      // Generate tracking token and link
      const { generateTrackingToken, getAppUrl, getBackendUrl } = require('@/lib/urlHelper');
      const trackingToken = generateTrackingToken();
      const appUrl = getAppUrl();
      const trackingLink = `${appUrl}/track/${trackingToken}`;

      const docRef = doc(db, "complaints", complaintId);

      const newComplaint = {
        id: complaintId,
        uid: user.uid,
        title: data.title,
        description: data.description,
        category: data.category,
        priority: data.priority,
        district: data.district,
        location: {
          lat: data.location.lat,
          lng: data.location.lng,
          address: data.location.address || `${data.district}, Delhi`
        },
        isAnonymous: data.isAnonymous || false,
        status: "Pending",
        createdAt: new Date().toISOString(),
        date: new Date().toISOString().split('T')[0],
        assignedOfficer: "Pending Assignment",
        timeline: [
          { step: 1, title: "Complaint Submitted", date: new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }), desc: "Your complaint was received by the system.", iconName: "FileText" },
          { step: 2, title: "Assigned to Department", date: null, desc: "Awaiting routing to department.", iconName: "UserCheck" },
          { step: 3, title: "In Progress", date: null, desc: "Team will work on resolution at the site.", iconName: "Wrench" },
          { step: 4, title: "Pending Verification", date: null, desc: "Awaiting field evidence and supervisor approval.", iconName: "ShieldCheck" },
          { step: 5, title: "Resolved", date: null, desc: "Issue has been fixed.", iconName: "CheckCircle2" },
          { step: 6, title: "Closed", date: null, desc: "Complaint officially closed.", iconName: "Lock" },
        ],
        currentStep: 1,
        aiValidation: aiAnalysisResult || null,
        trackingToken,
        trackingLink
      };

      await setDoc(docRef, newComplaint);

      // Trigger Twilio SMS alert and database logger on the backend
      try {
        const backendUrl = getBackendUrl();
        await fetch(`${backendUrl}/api/complaints/${complaintId}/status`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            status: 'Submitted',
            notes: 'Dear Citizen, Your grievance has been successfully submitted and is under AI validation.',
            updatedBy: 'Citizen',
            phoneNumber: profile?.phone || '',
            citizenId: user?.uid || '',
            trackingToken,
            trackingLink
          })
        });
      } catch (smsError) {
        console.error("Failed to trigger backend SMS service:", smsError);
      }

      alert(`Complaint Submitted Successfully! ID: ${complaintId}`);
      router.push('/citizen/history');
    } catch (error) {
      console.error("Error submitting complaint:", error);
      alert("Failed to submit complaint. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-5xl mx-auto">
      
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-[#1E3A8A] flex items-center gap-3">
          File a New Complaint
          <span className="flex items-center gap-1 text-xs bg-blue-50 text-blue-700 px-2.5 py-1 rounded-full border border-blue-200">
            <Brain className="w-3.5 h-3.5" /> AI Guarded
          </span>
        </h1>
        <p className="text-sm text-gray-500 mt-1">Please provide detailed information to help us resolve the issue quickly.</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column: Core Details */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Card 1: Basic Info */}
          <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
            <h2 className="text-lg font-bold text-[#1E3A8A] flex items-center mb-5">
              <FileText className="w-5 h-5 mr-2 text-[#FF9933]" /> Issue Details
            </h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Complaint Title</label>
                <input {...register('title')} className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-[#87CEEB] focus:border-[#87CEEB] transition-all bg-gray-50/50" placeholder="e.g., Severe waterlogging on Main Road" />
                {errors.title && <p className="text-red-500 text-xs mt-1">{errors.title.message}</p>}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                  <select {...register('category')} className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-[#87CEEB] bg-gray-50/50 appearance-none">
                    <option value="">Select Category...</option>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  {errors.category && <p className="text-red-500 text-xs mt-1">{errors.category.message}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Severity Priority</label>
                  <select {...register('priority')} className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-[#87CEEB] bg-gray-50/50 appearance-none">
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                    <option value="CRITICAL">Critical / Emergency</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea {...register('description')} rows={4} className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-[#87CEEB] bg-gray-50/50 resize-none" placeholder="Provide as much detail as possible..." />
                {errors.description && <p className="text-red-500 text-xs mt-1">{errors.description.message}</p>}
              </div>
            </div>
          </div>

          {/* Card 2: Location Mapping */}
          <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
            <h2 className="text-lg font-bold text-[#1E3A8A] flex items-center mb-5">
              <MapPin className="w-5 h-5 mr-2 text-[#FF9933]" /> Geolocation
            </h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">District</label>
                <select {...register('district')} className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-[#87CEEB] bg-gray-50/50">
                  <option value="">Select your district...</option>
                  {DISTRICTS.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
                {errors.district && <p className="text-red-500 text-xs mt-1">{errors.district.message}</p>}
              </div>
              
              <div className="pt-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">Pinpoint exact location on map</label>
                <LocationPicker onLocationSelect={(lat, lng) => setValue('location', { lat, lng })} />
              </div>
            </div>
          </div>

        </div>

        {/* Right Column: Media & Submission */}
        <div className="space-y-6">
          
          {/* Card 3: Media Upload */}
          <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
            <h2 className="text-lg font-bold text-[#1E3A8A] flex items-center mb-5">
              <UploadCloud className="w-5 h-5 mr-2 text-[#FF9933]" /> Attach Evidence
            </h2>
            
            <div 
              {...getRootProps()} 
              className="border-2 border-dashed border-[#87CEEB]/50 rounded-xl p-6 text-center hover:bg-[#87CEEB]/5 transition-colors cursor-pointer group"
            >
              <input {...getInputProps()} />
              <div className="flex justify-center space-x-4 mb-3 text-gray-400 group-hover:text-[#1E3A8A] transition-colors">
                <Camera className="w-6 h-6" />
                <Video className="w-6 h-6" />
                <Mic className="w-6 h-6" />
              </div>
              <p className="text-sm font-medium text-gray-600">Drag & drop files here</p>
              <p className="text-xs text-gray-400 mt-1">or click to browse (Photos, Videos, Audio)</p>
            </div>

            {/* AI Evidence Verification Status */}
            {(isAnalyzing || aiError || aiAnalysisResult) && (
              <div className={`mt-4 rounded-xl border overflow-hidden transition-all duration-300 ${
                isAnalyzing
                  ? 'border-blue-100 bg-gradient-to-r from-blue-50 to-indigo-50/40'
                  : aiError
                  ? 'border-red-100 bg-red-50/30'
                  : 'border-emerald-100 bg-gradient-to-r from-emerald-50 to-teal-50/40'
              }`}>
                <div className="px-4 py-3 flex items-center gap-3">
                  {/* Status Icon */}
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                    isAnalyzing ? 'bg-blue-100' : aiError ? 'bg-red-100' : 'bg-emerald-100'
                  }`}>
                    {isAnalyzing && <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />}
                    {aiError && <AlertTriangle className="w-4 h-4 text-red-500" />}
                    {aiAnalysisResult && <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
                  </div>

                  {/* Label */}
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs font-semibold uppercase tracking-wider mb-0.5 ${
                      isAnalyzing ? 'text-blue-500' : aiError ? 'text-red-500' : 'text-emerald-600'
                    }`}>AI Evidence Screening</p>
                    <p className={`text-sm font-medium leading-snug ${
                      isAnalyzing ? 'text-blue-800' : aiError ? 'text-red-800' : 'text-emerald-900'
                    }`}>
                      {isAnalyzing && 'Analysing uploaded evidence…'}
                      {aiError && 'Evidence does not represent a valid public grievance.'}
                      {aiAnalysisResult && 'Evidence accepted. Ready to submit.'}
                    </p>
                  </div>

                  {/* Status Pill */}
                  <span className={`flex-shrink-0 text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wide ${
                    isAnalyzing ? 'bg-blue-100 text-blue-700'
                    : aiError ? 'bg-red-100 text-red-700'
                    : 'bg-emerald-100 text-emerald-700'
                  }`}>
                    {isAnalyzing ? 'Scanning' : aiError ? 'Rejected' : 'Verified'}
                  </span>
                </div>

                {/* Bottom progress bar — only while scanning */}
                {isAnalyzing && (
                  <div className="h-0.5 bg-blue-100">
                    <div className="h-full bg-blue-400 animate-pulse" style={{ width: '60%' }} />
                  </div>
                )}
              </div>
            )}

            {/* Attached File List */}
            {files.length > 0 && (
              <div className="mt-4 space-y-1.5">
                {files.map((file, i) => (
                  <div key={i} className="flex items-center gap-2.5 px-3 py-2 bg-gray-50 rounded-lg border border-gray-100">
                    <File className="w-3.5 h-3.5 text-[#FF9933] flex-shrink-0" />
                    <span className="truncate flex-1 text-xs font-medium text-gray-600">{file.name}</span>
                    <span className="flex-shrink-0 text-[10px] font-semibold text-gray-400 uppercase">
                      {file.name.split('.').pop()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Card 4: Submission Settings */}
          <div className="bg-gradient-to-br from-[#1E3A8A] to-[#2a4eab] p-6 rounded-2xl shadow-md text-white">
            <div className="flex items-center justify-between mb-6 border-b border-white/10 pb-4">
              <div className="flex items-center">
                <EyeOff className="w-5 h-5 mr-2 text-[#FFC266]" />
                <span className="font-medium">File Anonymously</span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" {...register('isAnonymous')} className="sr-only peer" />
                <div className="w-11 h-6 bg-white/20 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#FF9933]"></div>
              </label>
            </div>
            
            <p className="text-xs text-blue-100 mb-6">
              {isAnonymous 
                ? "Your identity will be hidden from district officers. Only the CM office can verify it if required."
                : "Your identity will be visible to resolving officers for better follow-up."}
            </p>

            <button 
              type="submit" 
              disabled={isSubmitting || isAnalyzing}
              className="w-full flex justify-center items-center py-3.5 px-4 rounded-xl text-[#1E3A8A] bg-white hover:bg-gray-50 font-bold transition-all disabled:opacity-70 shadow-lg"
            >
              {isSubmitting ? "Processing..." : "Submit Grievance"} 
              {!isSubmitting && <ArrowRight className="ml-2 w-5 h-5" />}
            </button>
          </div>

        </div>
      </form>
    </motion.div>
  );
}