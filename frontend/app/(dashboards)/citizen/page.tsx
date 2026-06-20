"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { FileText, AlertCircle, CheckCircle2, Clock, ArrowRight, Plus, Eye } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';

export default function CitizenDashboardOverview() {
  const { user, profile } = useAuth();
  const [complaints, setComplaints] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchComplaints = async () => {
      if (!user) return;
      try {
        const q = query(collection(db, "complaints"), where("uid", "==", user.uid));
        const querySnapshot = await getDocs(q);
        const list: any[] = [];
        querySnapshot.forEach((doc) => {
          list.push(doc.data());
        });
        
        // Sort by date/createdAt descending
        list.sort((a, b) => {
          const dateA = new Date(a.createdAt || a.date || 0).getTime();
          const dateB = new Date(b.createdAt || b.date || 0).getTime();
          return dateB - dateA;
        });
        
        setComplaints(list);
      } catch (error) {
        console.error("Error fetching complaints for dashboard:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchComplaints();
  }, [user]);

  // Dynamic Metrics Calculation
  const total = complaints.length;
  const active = complaints.filter(c => c.status !== 'Resolved' && c.status !== 'Closed').length;
  const resolved = complaints.filter(c => c.status === 'Resolved' || c.status === 'Citizen_Verified').length;
  const escalated = complaints.filter(c => c.status === 'Escalated').length;

  const metrics = [
    { title: "Total Complaints", value: total, icon: FileText, color: "text-[#1E3A8A]", bg: "bg-[#1E3A8A]/10" },
    { title: "Active Issues", value: active, icon: Clock, color: "text-[#FF9933]", bg: "bg-[#FF9933]/10" },
    { title: "Resolved", value: resolved, icon: CheckCircle2, color: "text-[#22C55E]", bg: "bg-[#22C55E]/10" },
    { title: "Escalated", value: escalated, icon: AlertCircle, color: "text-[#EF4444]", bg: "bg-[#EF4444]/10" },
  ];

  const recentComplaints = complaints.slice(0, 5); // show top 5 recent

  const displayName = profile?.fullName || user?.displayName || user?.email?.split('@')[0] || "Citizen";

  const getStatusBadge = (status: string) => {
    switch(status) {
      case 'Resolved':
      case 'Citizen_Verified':
        return <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-[#22C55E]/10 text-[#22C55E]">Resolved</span>;
      case 'Closed':
        return <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">Closed</span>;
      case 'Escalated':
        return <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-[#EF4444]/10 text-[#EF4444]">Escalated</span>;
      case 'In Progress':
        return <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-[#1E3A8A]/10 text-[#1E3A8A]">In Progress</span>;
      default:
        return <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-[#FF9933]/10 text-[#FF9933]">{status || 'Pending'}</span>;
    }
  };

  if (loading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center bg-transparent">
        <div className="w-8 h-8 border-4 border-[#1E3A8A] border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
      
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-[#1E3A8A]">Welcome, {displayName}</h2>
          <p className="text-sm text-gray-500 mt-1">Here is a summary of your civic requests.</p>
        </div>
        <Link 
          href="/citizen/submit" 
          className="inline-flex items-center px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#FF9933] to-[#FFC266] text-white font-medium shadow-md shadow-[#FF9933]/20 hover:opacity-90 transition-opacity"
        >
          <Plus className="w-5 h-5 mr-2" />
          New Complaint
        </Link>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
        {metrics.map((metric, index) => {
          const Icon = metric.icon;
          return (
            <div key={index} className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-4">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${metric.bg}`}>
                  <Icon className={`w-5 h-5 ${metric.color}`} />
                </div>
              </div>
              <h3 className="text-3xl font-bold text-gray-900">{metric.value}</h3>
              <p className="text-sm font-medium text-gray-500 mt-1">{metric.title}</p>
            </div>
          );
        })}
      </div>

      {/* Recent Activity Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-50 flex justify-between items-center">
          <h3 className="text-lg font-bold text-[#1E3A8A]">Recent Complaints</h3>
          <Link href="/citizen/history" className="text-sm font-medium text-[#87CEEB] hover:text-[#1E3A8A] transition-colors flex items-center">
            View All <ArrowRight className="w-4 h-4 ml-1" />
          </Link>
        </div>
        <div className="overflow-x-auto">
          {recentComplaints.length > 0 ? (
            <table className="w-full text-sm text-left">
              <thead className="bg-[#F8FAFC] text-gray-500 font-medium border-b border-gray-100">
                <tr>
                  <th className="px-6 py-4">Complaint ID</th>
                  <th className="px-6 py-4">Category</th>
                  <th className="px-6 py-4">Submitted On</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {recentComplaints.map((complaint) => (
                  <tr key={complaint.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 font-medium text-[#1E3A8A]">{complaint.id}</td>
                    <td className="px-6 py-4 text-gray-600">{complaint.category}</td>
                    <td className="px-6 py-4 text-gray-500">
                      {new Date(complaint.createdAt || complaint.date).toLocaleDateString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric'
                      })}
                    </td>
                    <td className="px-6 py-4">{getStatusBadge(complaint.status)}</td>
                    <td className="px-6 py-4 text-right">
                      <Link 
                        href={`/citizen/track?id=${complaint.id}`}
                        className="inline-flex items-center px-3 py-1.5 rounded-lg bg-gray-50 text-[#1E3A8A] font-medium border border-gray-200 hover:bg-[#1E3A8A] hover:text-white transition-all text-xs"
                      >
                        <Eye className="w-3.5 h-3.5 mr-1" /> Track
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="p-12 text-center text-gray-500">
              No complaints found. Create your first complaint using the "New Complaint" button.
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}