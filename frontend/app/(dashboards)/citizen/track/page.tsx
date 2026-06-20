"use client";

import React, { useState, useEffect, Suspense, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Search, FileText, UserCheck, Wrench, 
  ShieldCheck, CheckCircle2, Lock, Clock, MapPin, Activity,
  Building2, Calendar, FileCheck, User, Sparkles, AlertCircle
} from 'lucide-react';
import { doc, getDoc, collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
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

// The 11 Stages of our Lifecyle Tracker
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

function TrackComplaintContent() {
  const searchParams = useSearchParams();
  const idParam = searchParams.get('id');
  
  const [searchId, setSearchId] = useState(idParam || "");
  const [isSearching, setIsSearching] = useState(false);
  const [data, setData] = useState<any>(null);
  const [timelineEvents, setTimelineEvents] = useState<any[]>([]);
  const [socketStatus, setSocketStatus] = useState<'connected' | 'disconnected'>('disconnected');
  const socketRef = useRef<Socket | null>(null);

  // Initialize Socket.IO connection
  useEffect(() => {
    // Connect to backend Express/Socket.IO server
    const { getBackendUrl } = require('@/lib/urlHelper');
    const backendUrl = getBackendUrl();
    const socket = io(backendUrl, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 5,
      reconnectionDelay: 2000
    });
    
    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('[Socket.IO] Connected to notifications server');
      setSocketStatus('connected');
      
      // If we have an active complaint ID loaded, subscribe to it
      if (data?.id) {
        socket.emit('track_complaint', data.id);
      }
    });

    socket.on('disconnect', () => {
      console.log('[Socket.IO] Disconnected from notifications server');
      setSocketStatus('disconnected');
    });

    // Real-time live status update listener!
    socket.on('status_update', (payload: any) => {
      console.log('[Socket.IO] Received live status update:', payload);
      if (payload.complaintId === data?.id || payload.complaintId === searchId) {
        // Update local status states instantly without page refresh!
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

        // Query the updated permanent timeline events
        fetchTimelineEvents(payload.complaintId);
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [data?.id, searchId]);

  // Join Socket.IO room when data.id changes
  useEffect(() => {
    if (socketRef.current && socketRef.current.connected && data?.id) {
      console.log(`[Socket.IO] Joining room for complaint: ${data.id}`);
      socketRef.current.emit('track_complaint', data.id);
    }
  }, [data?.id]);

  const fetchTimelineEvents = async (id: string) => {
    try {
      const q = query(
        collection(db, "grievance_events"),
        where("grievance_id", "==", id)
      );
      const querySnapshot = await getDocs(q);
      const events = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as any[];

      // Sort client-side DESC by timestamp
      events.sort((a, b) => {
        const timeA = a.timestamp?.seconds 
          ? (a.timestamp.seconds * 1000 + (a.timestamp.nanoseconds || 0) / 1000000) 
          : new Date(a.timestamp).getTime();
        const timeB = b.timestamp?.seconds 
          ? (b.timestamp.seconds * 1000 + (b.timestamp.nanoseconds || 0) / 1000000) 
          : new Date(b.timestamp).getTime();
        return timeB - timeA;
      });

      setTimelineEvents(events);
    } catch (error) {
      console.error("Error fetching grievance events:", error);
    }
  };

  const fetchComplaint = async (id: string) => {
    if (!id) return;
    setIsSearching(true);
    try {
      const docRef = doc(db, "complaints", id);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const complaintVal = docSnap.data();
        setData(complaintVal);
        
        // Fetch permanent audit events
        await fetchTimelineEvents(id);
      } else {
        setData(null);
        setTimelineEvents([]);
      }
    } catch (error) {
      console.error("Error fetching complaint:", error);
      setData(null);
      setTimelineEvents([]);
    } finally {
      setIsSearching(false);
    }
  };

  useEffect(() => {
    if (idParam) {
      setSearchId(idParam);
      fetchComplaint(idParam);
    } else {
      // Clear data if no id param is present
      setData(null);
    }
  }, [idParam]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchId.trim()) {
      fetchComplaint(searchId.trim());
    }
  };

  // Helper to determine step status
  const getStepStatus = (stepIndex: number, currentStep: number) => {
    if (stepIndex < currentStep) return 'completed';
    if (stepIndex === currentStep) return 'current';
    return 'pending';
  };

  // Generate fallback timeline dates if Firestore timeline list is empty
  const getDisplayTimeline = () => {
    if (!data) return [];
    
    // If the complaint doc already has a timeline array, use it
    if (data.timeline && data.timeline.length === 11) {
      return data.timeline;
    }
    
    // Otherwise construct the 11-stage layout dynamically
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

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-7xl mx-auto space-y-6">
      
      {/* Header & Search Bar */}
      <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col md:flex-row justify-between items-center gap-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#1E3A8A] flex items-center gap-3">
            Track Grievance Live
            <span className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full border bg-emerald-50 text-emerald-700 border-emerald-200">
              <span className={`w-2 h-2 rounded-full ${socketStatus === 'connected' ? 'bg-emerald-500 animate-ping' : 'bg-gray-400'}`} />
              {socketStatus === 'connected' ? 'Live Gateway Connected' : 'Live Gateway Offline'}
            </span>
          </h1>
          <p className="text-sm text-gray-500 mt-1">Real-time complaint verification system. No page refresh required.</p>
        </div>
        
        <form onSubmit={handleSearch} className="w-full md:w-96 relative">
          <input 
            type="text" 
            value={searchId}
            onChange={(e) => setSearchId(e.target.value)}
            placeholder="Enter Complaint ID (e.g. CMP-1001)"
            className="w-full pl-5 pr-12 py-3.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-[#FF9933] focus:border-[#FF9933] transition-all bg-gray-50 font-medium text-[#1E3A8A]"
            required
          />
          <button 
            type="submit" 
            disabled={isSearching}
            className="absolute right-2 top-2 bottom-2 aspect-square bg-[#1E3A8A] text-white rounded-lg flex items-center justify-center hover:bg-[#FF9933] transition-colors disabled:opacity-70"
          >
            {isSearching ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Search className="w-4 h-4" />}
          </button>
        </form>
      </div>

      {data ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Left Column: Complaint Details Summary */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm relative overflow-hidden">
              {/* Saffron & Saffron header accents */}
              <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[#FF9933] via-white to-[#22C55E]" />

              <div className="flex justify-between items-center mb-4 mt-2">
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-[#FF9933]/10 text-[#FF9933] border border-[#FF9933]/20">
                  {data.id}
                </span>
                {data.priority === 'CRITICAL' && (
                  <span className="bg-red-50 text-red-700 border border-red-200 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full">
                    Critical Priority
                  </span>
                )}
              </div>
              
              <h2 className="text-xl font-bold text-[#1E3A8A] leading-tight mb-4">{data.title}</h2>
              <p className="text-sm text-gray-600 mb-6 bg-gray-50 p-3 rounded-xl border border-gray-100">{data.description}</p>
              
              <div className="space-y-4 pt-2">
                <div className="flex items-start">
                  <FileText className="w-5 h-5 mr-3 text-[#87CEEB] shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs text-gray-400 font-medium uppercase tracking-wider">Category</p>
                    <p className="text-sm font-semibold text-gray-700">{data.category}</p>
                  </div>
                </div>
                <div className="flex items-start">
                  <MapPin className="w-5 h-5 mr-3 text-[#87CEEB] shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs text-gray-400 font-medium uppercase tracking-wider">Location / Address</p>
                    <p className="text-sm font-semibold text-gray-700">{data.location?.address || `${data.district || 'New Delhi'}, Delhi`}</p>
                  </div>
                </div>
                <div className="flex items-start">
                  <Building2 className="w-5 h-5 mr-3 text-[#87CEEB] shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs text-gray-400 font-medium uppercase tracking-wider">Assigned Department</p>
                    <p className="text-sm font-semibold text-gray-700">{data.department || 'Awaiting Routing'}</p>
                  </div>
                </div>
                <div className="flex items-start">
                  <UserCheck className="w-5 h-5 mr-3 text-[#87CEEB] shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs text-gray-400 font-medium uppercase tracking-wider">Assigned Officer</p>
                    <p className="text-sm font-semibold text-gray-700">{data.assignedOfficer || 'Pending Assignment'}</p>
                  </div>
                </div>
              </div>

              {data.aiValidation && (
                <div className="mt-6 pt-6 border-t border-gray-100 bg-[#E0F2FE]/30 p-4 rounded-xl border border-sky-100 flex gap-3">
                  <Sparkles className="w-5 h-5 text-sky-600 flex-shrink-0 mt-0.5 animate-pulse" />
                  <div>
                    <p className="text-xs font-bold text-sky-900 uppercase tracking-wide">AI Guard Validation</p>
                    <p className="text-xs text-sky-800 mt-0.5">Authenticity verified: {data.aiValidation.confidence}% Confidence. Category: {data.aiValidation.grievance_category}.</p>
                  </div>
                </div>
              )}

              <div className="mt-6 pt-4 border-t border-gray-100">
                <div className="bg-gray-50 rounded-xl p-4 flex items-center border border-gray-100">
                  <Clock className="w-8 h-8 text-[#FF9933] mr-3" />
                  <div>
                    <p className="text-xs text-gray-500 font-medium">Estimated SLA Resolution</p>
                    <p className="text-sm font-bold text-[#1E3A8A]">{data.estResolution || '7 Working Days'}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Columns: Flipkart-Style Lifecycle Tracker & Auditing log */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Component 1: Flipkart-style progress tracker */}
            <div className="bg-white p-6 sm:p-8 rounded-2xl border border-gray-100 shadow-sm">
              <h3 className="text-lg font-bold text-[#1E3A8A] mb-8 flex items-center">
                <Activity className="w-5 h-5 mr-2 text-[#FF9933] animate-pulse" /> Live Status Tracker
              </h3>

              <div className="relative">
                {/* Connecting Vertical Line */}
                <div className="absolute left-6 top-6 bottom-6 w-0.5 bg-gray-100" />
                
                {/* Green connection line highlighting completed steps */}
                <div 
                  className="absolute left-6 top-6 w-0.5 bg-emerald-500 transition-all duration-1000 ease-in-out" 
                  style={{ 
                    height: data.currentStep <= 1 
                      ? '0%' 
                      : `${((data.currentStep - 1) / (11 - 1)) * 100}%` 
                  }}
                />

                <div className="space-y-8 relative">
                  {getDisplayTimeline().map((item: any, index: number) => {
                    const Icon = ICON_MAP[item.iconName] || FileText;
                    const stepStatus = getStepStatus(item.step, data.currentStep);

                    return (
                      <div key={item.step} className="flex relative items-start group">
                        {/* Timeline Node Icon wrapper */}
                        <div className={`relative z-10 flex items-center justify-center w-12 h-12 rounded-full shrink-0 border-4 border-white shadow-md transition-all duration-500 ${
                          stepStatus === 'completed' 
                            ? 'bg-emerald-500 text-white border-emerald-50' 
                            : stepStatus === 'current' 
                            ? 'bg-blue-600 text-white ring-4 ring-blue-500/30 scale-110 shadow-lg' 
                            : 'bg-gray-100 text-gray-400'
                        }`}>
                          <Icon className={`w-5 h-5 ${stepStatus === 'current' ? 'animate-pulse' : ''}`} />
                        </div>

                        {/* Timeline Text Content */}
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

            {/* Component 2: Permanent Auditing Logs */}
            <div className="bg-white p-6 sm:p-8 rounded-2xl border border-gray-100 shadow-sm">
              <h3 className="text-lg font-bold text-[#1E3A8A] mb-5 flex items-center">
                <Clock className="w-5 h-5 mr-2 text-[#FF9933]" /> Official Activity Timeline
              </h3>
              
              {timelineEvents.length > 0 ? (
                <div className="space-y-4">
                  <p className="text-xs text-gray-400 font-semibold mb-2">PERMANENT REGISTRATION LEDGER (NON-EDITABLE HISTORY)</p>
                  <div className="border border-gray-100 rounded-xl overflow-hidden divide-y divide-gray-50 shadow-inner bg-gray-50/50">
                    {timelineEvents.map((evt: any) => (
                      <div key={evt.id} className="p-4 flex items-start justify-between gap-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-gray-800 bg-white px-2 py-0.5 rounded-md border border-gray-100">
                              {evt.status.replace('_', ' ')}
                            </span>
                            <span className="text-[11px] text-gray-400 font-medium">by {evt.created_by}</span>
                          </div>
                          <p className="text-sm text-gray-600">{evt.message}</p>
                        </div>
                        <span className="text-[11px] text-gray-400 font-medium text-right shrink-0 mt-0.5">
                          {(() => {
                            if (!evt.timestamp) return 'N/A';
                            const dateObj = evt.timestamp.seconds !== undefined 
                              ? new Date(evt.timestamp.seconds * 1000 + (evt.timestamp.nanoseconds || 0) / 1000000)
                              : (evt.timestamp.toDate ? evt.timestamp.toDate() : new Date(evt.timestamp));
                            return isNaN(dateObj.getTime()) ? 'N/A' : dateObj.toLocaleString('en-IN', {
                              day: '2-digit', month: 'short', year: 'numeric',
                              hour: '2-digit', minute: '2-digit'
                            });
                          })()}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center p-8 bg-gray-50 border border-dashed border-gray-200 rounded-xl text-gray-400 text-sm">
                  <AlertCircle className="w-6 h-6 mx-auto mb-2 text-gray-300" />
                  No audit trail recorded. Timeline is currently running in fallback mode.
                </div>
              )}
            </div>

          </div>

        </div>
      ) : (
        <div className="bg-white p-16 rounded-2xl border border-gray-100 shadow-sm text-center max-w-2xl mx-auto">
          <Search className="w-16 h-16 mx-auto text-gray-300 mb-4" />
          <h3 className="text-xl font-bold text-[#1E3A8A]">Grievance Tracker</h3>
          <p className="text-gray-500 mt-2 max-w-md mx-auto">
            Please enter your unique Complaint ID in the search box to view real-time tracking, department assignments, and notification queues.
          </p>
          <div className="mt-8 flex justify-center gap-3 text-xs text-gray-400 font-semibold uppercase tracking-wider">
            <span>✓ Socket Gateway</span>
            <span>•</span>
            <span>✓ Audit Ledger</span>
            <span>•</span>
            <span>✓ SMS Worker Ready</span>
          </div>
        </div>
      )}
    </motion.div>
  );
}

export default function TrackComplaintPage() {
  return (
    <Suspense fallback={
      <div className="min-h-[50vh] flex items-center justify-center bg-transparent">
        <div className="w-8 h-8 border-4 border-[#1E3A8A] border-t-transparent rounded-full animate-spin"></div>
      </div>
    }>
      <TrackComplaintContent />
    </Suspense>
  );
}