"use client";

import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { 
  FileText, UserCheck, Wrench, 
  ShieldCheck, CheckCircle2, Lock, Clock, MapPin, Activity,
  Building2, Calendar, FileCheck, User, Sparkles, AlertCircle, Info
} from 'lucide-react';
import { io, Socket } from 'socket.io-client';

const ICON_MAP: Record<string, any> = {
  FileText: FileText,
  ShieldCheck: ShieldCheck,
  Building2: Building2,
  UserCheck: UserCheck,
  Activity: Activity,
  Calendar: Calendar,
  FileCheck: FileCheck,
  Wrench: Wrench,
  CheckCircle2: CheckCircle2,
  User: User,
  Lock: Lock
};

const STAGES = [
  { step: 1, title: 'Complaint Submitted', status: 'Submitted', desc: 'Your complaint was received by the system.', iconName: 'FileText' },
  { step: 2, title: 'AI Validation Completed', status: 'AI_Validated', desc: 'AI reviewed the complaint and verified authenticity.', iconName: 'ShieldCheck' },
  { step: 3, title: 'Assigned To Department', status: 'Assigned_Dept', desc: 'Complaint routed to the responsible department.', iconName: 'Building2' },
  { step: 4, title: 'Officer Assigned', status: 'Officer_Assigned', desc: 'A specific resolving officer has been assigned.', iconName: 'UserCheck' },
  { step: 5, title: 'Investigation Started', status: 'Investigation_Started', desc: 'The department has started reviewing your complaint details.', iconName: 'Activity' },
  { step: 6, title: 'Field Inspection Scheduled', status: 'Inspection_Scheduled', desc: 'A field visit has been scheduled to inspect the site.', iconName: 'Calendar' },
  { step: 7, title: 'Field Inspection Completed', status: 'Inspection_Completed', desc: 'Site inspection completed by the assigned officer.', iconName: 'FileCheck' },
  { step: 8, title: 'Action In Progress', status: 'Action_In_Progress', desc: 'Department team has started resolving the issue at the site.', iconName: 'Wrench' },
  { step: 9, title: 'Issue Resolved', status: 'Resolved', desc: 'The department has resolved the issue. Awaiting citizen verification.', iconName: 'CheckCircle2' },
  { step: 10, title: 'Citizen Verification', status: 'Citizen_Verified', desc: 'Citizen confirmed and verified the resolution.', iconName: 'User' },
  { step: 11, title: 'Complaint Closed', status: 'Closed', desc: 'The complaint has been successfully resolved and closed.', iconName: 'Lock' }
];

export default function PublicTrackingPage() {
  const params = useParams();
  const trackingToken = params?.trackingToken as string;

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [socketStatus, setSocketStatus] = useState<'connected' | 'disconnected'>('disconnected');
  const socketRef = useRef<Socket | null>(null);

  const getBackendUrl = () => {
    if (process.env.NEXT_PUBLIC_API_URL) {
      return process.env.NEXT_PUBLIC_API_URL;
    }
    if (typeof window !== 'undefined') {
      if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        return 'http://localhost:5002';
      }
      return window.location.origin.replace(':5001', ':5002').replace(':3000', ':5002');
    }
    return 'http://localhost:5002';
  };

  const backendUrl = getBackendUrl();

  const fetchComplaintDetails = async () => {
    if (!trackingToken) return;
    try {
      setLoading(true);
      const res = await fetch(`${backendUrl}/api/complaints/track/${trackingToken}`);
      if (!res.ok) {
        throw new Error('Complaint not found or invalid tracking link.');
      }
      const val = await res.json();
      setData(val);
      setError(null);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to load tracking details.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchComplaintDetails();
  }, [trackingToken]);

  // Connect to Socket.IO Room
  useEffect(() => {
    if (!trackingToken) return;

    const socket = io(backendUrl, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 5,
      reconnectionDelay: 2000
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('[Socket.IO] Public tracker connected');
      setSocketStatus('connected');
      socket.emit('track_complaint_by_token', trackingToken);
      
      // Also join by complaint ID if already loaded
      if (data?.id) {
        socket.emit('track_complaint', data.id);
      }
    });

    socket.on('disconnect', () => {
      console.log('[Socket.IO] Public tracker disconnected');
      setSocketStatus('disconnected');
    });

    socket.on('status_update', (payload: any) => {
      console.log('[Socket.IO] Received live status update:', payload);
      setData((prev: any) => {
        if (!prev) return null;
        return {
          ...prev,
          status: payload.status,
          currentStep: payload.currentStep,
          timeline: payload.timeline,
          lastNotes: payload.notes
        };
      });
    });

    return () => {
      socket.disconnect();
    };
  }, [trackingToken, data?.id]);

  // Helper to determine step status
  const getStepStatus = (stepIndex: number, currentStep: number) => {
    if (stepIndex < currentStep) return 'completed';
    if (stepIndex === currentStep) return 'current';
    return 'pending';
  };

  // Generate dynamic 11-stage layout
  const getDisplayTimeline = () => {
    if (!data) return [];
    
    if (data.timeline && data.timeline.length === 11) {
      return data.timeline;
    }
    
    const fallbackDate = new Date(data.createdAt || Date.now()).toLocaleDateString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });
    
    return STAGES.map(stage => {
      const existing = (data.timeline || []).find((t: any) => t.step === stage.step);
      let dateValue = existing?.date || null;
      if (stage.step <= data.currentStep && !dateValue) {
        dateValue = stage.step === 1 ? fallbackDate : "Completed";
      }
      return {
        ...stage,
        date: dateValue
      };
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-4 border-[#1E3A8A] border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-gray-500 font-medium">Fetching grievance live metrics...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
        <div className="max-w-md w-full bg-white p-8 rounded-2xl border border-gray-100 shadow-sm text-center">
          <AlertCircle className="w-16 h-16 mx-auto text-red-500 mb-4" />
          <h3 className="text-xl font-bold text-[#1E3A8A]">Grievance Not Found</h3>
          <p className="text-gray-500 mt-2">
            {error || "The tracking link is invalid or the complaint does not exist in our ledger."}
          </p>
          <div className="mt-6">
            <button 
              onClick={fetchComplaintDetails}
              className="px-6 py-2.5 bg-[#1E3A8A] text-white font-semibold rounded-xl hover:bg-[#FF9933] transition-colors"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* Banner Alert for Security */}
        <div className="bg-[#E0F2FE] border border-sky-100 p-4 rounded-2xl flex items-start gap-3">
          <Info className="w-5 h-5 text-sky-600 shrink-0 mt-0.5" />
          <div>
            <h4 className="text-sm font-bold text-sky-900">Secure Guest Tracker Portal</h4>
            <p className="text-xs text-sky-700 mt-0.5">
              You are viewing this grievance live timeline via a cryptographically secure token. No authentication or login is required to monitor this complaint.
            </p>
          </div>
        </div>

        {/* Header Section */}
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col md:flex-row justify-between items-center gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-[#1E3A8A] flex items-center gap-3">
              Grievance Tracking
              <span className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full border bg-emerald-50 text-emerald-700 border-emerald-200">
                <span className={`w-2 h-2 rounded-full ${socketStatus === 'connected' ? 'bg-emerald-500 animate-ping' : 'bg-gray-400'}`} />
                {socketStatus === 'connected' ? 'Live gateway connected' : 'Live gateway offline'}
              </span>
            </h1>
            <p className="text-sm text-gray-500 mt-1">Real-time status updates sync. No page refresh required.</p>
          </div>
          
          <div className="text-right">
            <span className="text-xs font-medium text-gray-400 block uppercase">Complaint ID</span>
            <span className="text-lg font-extrabold text-[#FF9933] bg-[#FF9933]/10 px-3.5 py-1 rounded-lg border border-[#FF9933]/20 mt-1 inline-block">
              {data.id}
            </span>
          </div>
        </div>

        {/* Content Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Left Column: Core Grievance details */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[#FF9933] via-white to-[#22C55E]" />

              <h2 className="text-lg font-bold text-[#1E3A8A] mb-4 mt-2">Grievance Overview</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-medium text-gray-400 uppercase tracking-wider block">Title</label>
                  <p className="text-sm font-semibold text-gray-800 leading-tight mt-0.5">{data.title}</p>
                </div>

                <div>
                  <label className="text-xs font-medium text-gray-400 uppercase tracking-wider block">Description</label>
                  <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded-xl border border-gray-100 mt-1 whitespace-pre-line">{data.description}</p>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-2">
                  <div>
                    <label className="text-xs font-medium text-gray-400 uppercase tracking-wider block">Category</label>
                    <p className="text-sm font-bold text-gray-700 mt-0.5">{data.category}</p>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-400 uppercase tracking-wider block">Priority</label>
                    <span className={`inline-block mt-0.5 text-xs font-bold px-2.5 py-0.5 rounded-full ${
                      data.priority === 'CRITICAL' ? 'bg-red-50 text-red-700 border border-red-200' :
                      data.priority === 'HIGH' ? 'bg-orange-50 text-orange-700 border border-orange-200' :
                      'bg-sky-50 text-sky-700 border border-sky-200'
                    }`}>
                      {data.priority}
                    </span>
                  </div>
                </div>

                <div className="border-t border-gray-100 pt-4 space-y-3">
                  <div className="flex items-start">
                    <Building2 className="w-4 h-4 mr-2.5 text-gray-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs text-gray-400 font-medium block">Department</p>
                      <p className="text-xs font-bold text-gray-700">{data.department || 'Awaiting Routing'}</p>
                    </div>
                  </div>

                  <div className="flex items-start">
                    <User className="w-4 h-4 mr-2.5 text-gray-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs text-gray-400 font-medium block">Assigned Officer</p>
                      <p className="text-xs font-bold text-gray-700">{data.assignedOfficer || 'Pending Assignment'}</p>
                    </div>
                  </div>

                  <div className="flex items-start">
                    <Calendar className="w-4 h-4 mr-2.5 text-gray-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs text-gray-400 font-medium block">Submission Date</p>
                      <p className="text-xs font-bold text-gray-700">
                        {data.createdAt ? new Date(data.createdAt).toLocaleDateString('en-IN', {
                          day: '2-digit', month: 'short', year: 'numeric'
                        }) : 'N/A'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start">
                    <Clock className="w-4 h-4 mr-2.5 text-gray-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs text-gray-400 font-medium block">Last Updated</p>
                      <p className="text-xs font-bold text-gray-700">
                        {data.updatedAt ? new Date(data.updatedAt).toLocaleString('en-IN', {
                          day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
                        }) : 'N/A'}
                      </p>
                    </div>
                  </div>
                </div>

                {data.aiValidation && (
                  <div className="bg-[#E0F2FE]/40 p-3 rounded-xl border border-sky-100 flex gap-2.5 mt-4">
                    <Sparkles className="w-4.5 h-4.5 text-sky-600 flex-shrink-0 mt-0.5 animate-pulse" />
                    <div>
                      <p className="text-[10px] font-bold text-sky-900 uppercase">AI Verification Safeguard</p>
                      <p className="text-[11px] text-sky-800 mt-0.5">Authenticity verified: {data.aiValidation.confidence}% score.</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Column: Flipkart-style 11-stage vertical timeline progress */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white p-6 sm:p-8 rounded-2xl border border-gray-100 shadow-sm">
              <h3 className="text-lg font-bold text-[#1E3A8A] mb-8 flex items-center">
                <Activity className="w-5 h-5 mr-2 text-[#FF9933] animate-pulse" /> Resolution Timeline Progress
              </h3>

              <div className="relative">
                {/* Vertical Line */}
                <div className="absolute left-6 top-6 bottom-6 w-0.5 bg-gray-100" />
                
                {/* Animated Green completed line */}
                <div 
                  className="absolute left-6 top-6 w-0.5 bg-emerald-500 transition-all duration-1000 ease-in-out" 
                  style={{ 
                    height: data.currentStep <= 1 
                      ? '0%' 
                      : `${((data.currentStep - 1) / (11 - 1)) * 100}%` 
                  }}
                />

                <div className="space-y-8 relative">
                  {getDisplayTimeline().map((item: any) => {
                    const Icon = ICON_MAP[item.iconName] || FileText;
                    const stepStatus = getStepStatus(item.step, data.currentStep);

                    return (
                      <div key={item.step} className="flex relative items-start group">
                        {/* Timeline Circle */}
                        <div className={`relative z-10 flex items-center justify-center w-12 h-12 rounded-full shrink-0 border-4 border-white shadow-md transition-all duration-500 ${
                          stepStatus === 'completed' 
                            ? 'bg-emerald-500 text-white border-emerald-50' 
                            : stepStatus === 'current' 
                            ? 'bg-blue-600 text-white ring-4 ring-blue-500/30 scale-110 shadow-lg' 
                            : 'bg-gray-100 text-gray-400'
                        }`}>
                          <Icon className={`w-5 h-5 ${stepStatus === 'current' ? 'animate-pulse' : ''}`} />
                        </div>

                        {/* Description & Metadata */}
                        <div className={`ml-6 pt-1 flex-1 transition-all duration-500 ${
                          stepStatus === 'pending' ? 'opacity-40' : 'opacity-100'
                        }`}>
                          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-1">
                            <h4 className={`text-base font-bold transition-colors duration-500 ${
                              stepStatus === 'current' ? 'text-blue-600' : 'text-[#1E3A8A]'
                            }`}>
                              {item.title}
                              {stepStatus === 'current' && (
                                <span className="inline-block ml-2 text-[10px] uppercase font-bold tracking-widest bg-blue-50 text-blue-700 px-2 py-0.5 rounded-md border border-blue-200 animate-pulse">
                                  Current Status
                                </span>
                              )}
                            </h4>
                            {item.date && (
                              <span className="text-[11px] font-semibold text-gray-400 bg-gray-50 border border-gray-100 px-2.5 py-1 rounded-lg">
                                {item.date}
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-gray-500 mt-1 leading-relaxed">{item.desc}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
