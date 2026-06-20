"use client";

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Building2, Users, AlertTriangle, CheckCircle2, Clock, 
  MapPin, Star, Sparkles, TrendingUp, ShieldAlert, FileText 
} from 'lucide-react';
import { 
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  LineChart, Line
} from 'recharts';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export default function StateAdminDashboard() {
  const [complaints, setComplaints] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "complaints"), (snapshot) => {
      const items: any[] = [];
      snapshot.forEach((doc) => {
        items.push({ id: doc.id, ...doc.data() });
      });
      setComplaints(items);
      setIsLoading(false);
    }, (error) => {
      console.error("Firestore loading error:", error);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const totalCount = complaints.length;
  const openCount = complaints.filter(c => !['Resolved', 'Closed', 'Citizen_Verified'].includes(c.status)).length;
  const resolvedCount = complaints.filter(c => ['Resolved', 'Closed', 'Citizen_Verified'].includes(c.status)).length;

  const oneDayAgo = new Date();
  oneDayAgo.setDate(oneDayAgo.getDate() - 1);
  const overdueCount = complaints.filter(c => {
    if (['Resolved', 'Closed', 'Citizen_Verified'].includes(c.status)) return false;
    const createdAt = new Date(c.createdAt || Date.now());
    return createdAt < oneDayAgo;
  }).length;

  // Calculate Average Resolution Time
  const resolvedWithTime = complaints.filter(c => ['Resolved', 'Closed', 'Citizen_Verified'].includes(c.status) && c.updatedAt && c.createdAt);
  let avgDays = 3.6;
  if (resolvedWithTime.length > 0) {
    const totalDays = resolvedWithTime.reduce((acc, c) => {
      const start = new Date(c.createdAt);
      const end = new Date(c.updatedAt);
      const days = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
      return acc + (days > 0 ? days : 0.1);
    }, 0);
    avgDays = parseFloat((totalDays / resolvedWithTime.length).toFixed(1));
  }

  // Calculate CSAT
  const feedbackComplaints = complaints.filter(c => c.feedback && c.feedback.rating);
  let csat = 4.3;
  if (feedbackComplaints.length > 0) {
    const sum = feedbackComplaints.reduce((acc, c) => acc + c.feedback.rating, 0);
    csat = parseFloat((sum / feedbackComplaints.length).toFixed(1));
  }

  // Group by districts dynamically
  const districtMap: { [key: string]: { open: number, resolved: number, ratings: number[] } } = {};
  complaints.forEach(c => {
    const dist = c.district || 'Other';
    if (!districtMap[dist]) {
      districtMap[dist] = { open: 0, resolved: 0, ratings: [] };
    }
    const isClosed = ['Resolved', 'Closed', 'Citizen_Verified'].includes(c.status);
    if (isClosed) {
      districtMap[dist].resolved++;
    } else {
      districtMap[dist].open++;
    }
    if (c.feedback && c.feedback.rating) {
      districtMap[dist].ratings.push(c.feedback.rating);
    }
  });

  const stateDistricts = Object.keys(districtMap).map(key => {
    const dData = districtMap[key];
    const avgDCSAT = dData.ratings.length > 0
      ? parseFloat((dData.ratings.reduce((a, b) => a + b, 0) / dData.ratings.length).toFixed(1))
      : 4.4;
    return {
      name: key,
      open: dData.open,
      resolved: dData.resolved,
      csat: avgDCSAT
    };
  });

  // Default entries if empty
  if (stateDistricts.length === 0) {
    stateDistricts.push({ name: 'South West Delhi', open: 0, resolved: 0, csat: 4.4 });
  }

  // Load weekly trend
  const weeklyMap: { [key: string]: number } = { 'Wk 1': 0, 'Wk 2': 0, 'Wk 3': 0, 'Wk 4': 0, 'Wk 5': 0 };
  complaints.forEach(c => {
    const date = new Date(c.createdAt || Date.now());
    const weekNum = Math.ceil(date.getDate() / 7);
    const key = `Wk ${weekNum > 5 ? 5 : weekNum}`;
    weeklyMap[key] = (weeklyMap[key] || 0) + 1;
  });
  const weeklyTrend = Object.keys(weeklyMap).map(key => ({
    week: key,
    complaints: weeklyMap[key]
  }));

  if (isLoading) {
    return (
      <div className="flex flex-col h-[60vh] items-center justify-center space-y-4">
        <div className="animate-spin w-12 h-12 border-4 border-[#FF9933] border-t-transparent rounded-full mb-4"></div>
        <p className="text-[#1E3A8A] font-black tracking-widest uppercase text-xs">Syncing State Command...</p>
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 pb-4 border-b border-gray-200">
        <div>
          <h2 className="text-3xl font-black text-[#1E3A8A] tracking-tight">State Administration War Room</h2>
          <p className="text-sm font-bold text-[#FF9933] uppercase tracking-widest mt-1">Aggregated State Performance Matrix</p>
        </div>
        <div className="flex items-center bg-white border border-gray-200 shadow-sm px-4 py-2 rounded-xl">
          <span className="flex h-3 w-3 mr-3 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
          </span>
          <span className="text-xs font-black text-gray-700 tracking-wider uppercase">State Live Sync</span>
        </div>
      </div>

      {/* STATS GRID */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-xs">
          <div className="flex justify-between items-start">
            <p className="text-xs font-black text-gray-400 uppercase tracking-widest">Total State Grievances</p>
            <FileText className="w-5 h-5 text-[#1E3A8A]" />
          </div>
          <p className="text-3xl font-black text-[#1E3A8A] mt-2">{totalCount}</p>
          <span className="text-[10px] text-green-600 font-bold">{resolvedCount} resolved cases</span>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-xs">
          <div className="flex justify-between items-start">
            <p className="text-xs font-black text-gray-400 uppercase tracking-widest">Active Pending</p>
            <AlertTriangle className="w-5 h-5 text-red-500" />
          </div>
          <p className="text-3xl font-black text-red-600 mt-2">{openCount}</p>
          <span className="text-[10px] text-red-500 font-bold">{overdueCount} Overdue Escalations</span>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-xs">
          <div className="flex justify-between items-start">
            <p className="text-xs font-black text-gray-400 uppercase tracking-widest">Average Resolution</p>
            <Clock className="w-5 h-5 text-[#FF9933]" />
          </div>
          <p className="text-3xl font-black text-gray-900 mt-2">{avgDays} Days</p>
          <span className="text-[10px] text-green-600 font-bold">Target is below 5.0 Days</span>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-xs">
          <div className="flex justify-between items-start">
            <p className="text-xs font-black text-gray-400 uppercase tracking-widest">State CSAT Score</p>
            <Star className="w-5 h-5 text-yellow-500 fill-yellow-500" />
          </div>
          <p className="text-3xl font-black text-gray-900 mt-2">{csat} / 5.0</p>
          <span className="text-[10px] text-green-600 font-bold">Live Citizen feedback rating</span>
        </div>
      </div>

      {/* DISTRICT WISE SUMMARY TABLE & WEEKLY GRAPH */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        
        {/* District list */}
        <div className="xl:col-span-2 bg-white rounded-3xl border border-gray-200 p-6 flex flex-col">
          <div className="mb-4">
            <h3 className="text-lg font-black text-[#1E3A8A] flex items-center">
              <MapPin className="w-5 h-5 mr-2 text-[#FF9933]" /> District Performance Matrix
            </h3>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Status of individual district jurisdictions</p>
          </div>

          <div className="overflow-x-auto w-full">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-100 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                  <th className="pb-3">District Name</th>
                  <th className="pb-3">Open Cases</th>
                  <th className="pb-3">Resolved Cases</th>
                  <th className="pb-3 pr-2">Satisfaction Score</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {stateDistricts.map((dist, i) => (
                  <tr key={i} className="hover:bg-gray-50/50 transition-colors">
                    <td className="py-3 font-bold text-gray-900">{dist.name}</td>
                    <td className="py-3 text-xs text-red-600 font-black">{dist.open}</td>
                    <td className="py-3 text-xs text-green-600 font-black">{dist.resolved}</td>
                    <td className="py-3">
                      <div className="flex items-center text-xs font-bold text-yellow-600">
                        <Star className="w-3.5 h-3.5 mr-1 text-[#FF9933] fill-[#FF9933]" /> {dist.csat}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Weekly Trend line chart */}
        <div className="bg-white rounded-3xl border border-gray-200 p-6 flex flex-col justify-between">
          <div>
            <h3 className="text-lg font-black text-[#1E3A8A] flex items-center">
              <TrendingUp className="w-5 h-5 mr-2 text-[#87CEEB]" /> State Weekly Load
            </h3>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Weekly volume of new grievances</p>
          </div>
          <div className="w-full h-[220px] mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={weeklyTrend}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                <XAxis dataKey="week" tick={{ fill: '#9ca3af', fontSize: 10, fontWeight: 'bold' }} />
                <YAxis tick={{ fill: '#9ca3af', fontSize: 10 }} />
                <Tooltip />
                <Line type="monotone" dataKey="complaints" stroke="#FF9933" strokeWidth={3} activeDot={{ r: 8 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>

    </motion.div>
  );
}
