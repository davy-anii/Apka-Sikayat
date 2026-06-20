"use client";

import React, { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Search, Filter, ArrowUpDown, ChevronLeft, ChevronRight, 
  FileText, CheckCircle2, Clock, AlertCircle, Eye, MapPin, Calendar
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, doc, setDoc } from 'firebase/firestore';

// Mock Data for History - used for seeding
const MOCK_HISTORY = [
  { id: "CMP-1008", title: "Pothole on Main Arterial Road", category: "Roads & Traffic", status: "Resolved", date: "2026-06-19", district: "South Delhi" },
  { id: "CMP-1007", title: "No Water Supply for 2 Days", category: "Water Supply", status: "In Progress", date: "2026-06-18", district: "West Delhi" },
  { id: "CMP-1006", title: "Garbage Dump Overflowing", category: "Sanitation & Waste", status: "Pending", date: "2026-06-17", district: "East Delhi" },
  { id: "CMP-1005", title: "Streetlights not working", category: "Electricity", status: "Closed", date: "2026-06-15", district: "Central Delhi" },
  { id: "CMP-1004", title: "Illegal Parking in Residential Area", category: "Law & Order", status: "Escalated", date: "2026-06-12", district: "South West Delhi" },
  { id: "CMP-1003", title: "Sewer Line Blockage", category: "Sanitation & Waste", status: "Resolved", date: "2026-06-10", district: "North Delhi" },
  { id: "CMP-1002", title: "Frequent Power Cuts", category: "Electricity", status: "Closed", date: "2026-06-08", district: "East Delhi" },
  { id: "CMP-1001", title: "Stray Dog Menace", category: "Public Health", status: "Closed", date: "2026-06-05", district: "South Delhi" },
];

const ITEMS_PER_PAGE = 5;

export default function ComplaintHistoryPage() {
  const { user } = useAuth();
  const [complaints, setComplaints] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [sortBy, setSortBy] = useState("Newest");
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    const fetchAndSeedComplaints = async () => {
      if (!user) return;
      try {
        const q = query(collection(db, "complaints"), where("uid", "==", user.uid));
        const querySnapshot = await getDocs(q);
        const fetchedList: any[] = [];
        querySnapshot.forEach((doc) => {
          fetchedList.push(doc.data());
        });

        setComplaints(fetchedList);
      } catch (error) {
        console.error("Error fetching complaints:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchAndSeedComplaints();
  }, [user]);

  // Status Badge Styling Helper
  const getStatusConfig = (status: string) => {
    switch(status) {
      case 'Resolved': return { bg: 'bg-[#22C55E]/10', text: 'text-[#22C55E]', icon: CheckCircle2 };
      case 'Closed': return { bg: 'bg-gray-100', text: 'text-gray-600', icon: CheckCircle2 };
      case 'In Progress': return { bg: 'bg-[#87CEEB]/20', text: 'text-[#1E3A8A]', icon: Clock };
      case 'Pending': return { bg: 'bg-[#FF9933]/10', text: 'text-[#FF9933]', icon: Clock };
      case 'Escalated': return { bg: 'bg-[#EF4444]/10', text: 'text-[#EF4444]', icon: AlertCircle };
      default: return { bg: 'bg-gray-100', text: 'text-gray-600', icon: FileText };
    }
  };

  // Filter and Sort Logic
  const filteredAndSortedData = useMemo(() => {
    let result = [...complaints];

    // 1. Search
    if (searchTerm) {
      const lowerSearch = searchTerm.toLowerCase();
      result = result.filter(item => 
        item.title.toLowerCase().includes(lowerSearch) || 
        item.id.toLowerCase().includes(lowerSearch)
      );
    }

    // 2. Filter by Status
    if (statusFilter !== "All") {
      result = result.filter(item => item.status === statusFilter);
    }

    // 3. Sort
    result.sort((a, b) => {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      return sortBy === "Newest" ? dateB - dateA : dateA - dateB;
    });

    return result;
  }, [complaints, searchTerm, statusFilter, sortBy]);

  // Pagination Logic
  const totalPages = Math.ceil(filteredAndSortedData.length / ITEMS_PER_PAGE);
  const paginatedData = filteredAndSortedData.slice(
    (currentPage - 1) * ITEMS_PER_PAGE, 
    currentPage * ITEMS_PER_PAGE
  );

  // Reset to page 1 when filters change
  React.useEffect(() => { setCurrentPage(1); }, [searchTerm, statusFilter, sortBy]);

  if (loading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center bg-transparent">
        <div className="w-8 h-8 border-4 border-[#1E3A8A] border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-6xl mx-auto space-y-6">
      
      {/* Header Section */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-[#1E3A8A]">Complaint History</h1>
        <p className="text-sm text-gray-500 mt-1">Review and track all your previously submitted grievances.</p>
      </div>

      {/* Toolbar: Search & Filters */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col md:flex-row gap-4 justify-between items-center z-10 relative">
        
        {/* Search Bar */}
        <div className="relative w-full md:w-96">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-gray-400" />
          </div>
          <input
            type="text"
            placeholder="Search by ID or Title..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-[#87CEEB] focus:border-[#87CEEB] transition-all bg-gray-50/50 text-sm"
          />
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
          <div className="relative flex-1 sm:flex-none">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Filter className="h-4 w-4 text-gray-400" />
            </div>
            <select 
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full sm:w-40 pl-9 pr-8 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-[#87CEEB] bg-gray-50/50 text-sm appearance-none text-gray-700 font-medium"
            >
              <option value="All">All Statuses</option>
              <option value="Pending">Pending</option>
              <option value="In Progress">In Progress</option>
              <option value="Resolved">Resolved</option>
              <option value="Closed">Closed</option>
              <option value="Escalated">Escalated</option>
            </select>
          </div>

          <div className="relative flex-1 sm:flex-none">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <ArrowUpDown className="h-4 w-4 text-gray-400" />
            </div>
            <select 
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="w-full sm:w-40 pl-9 pr-8 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-[#87CEEB] bg-gray-50/50 text-sm appearance-none text-gray-700 font-medium"
            >
              <option value="Newest">Newest First</option>
              <option value="Oldest">Oldest First</option>
            </select>
          </div>
        </div>
      </div>

      {/* Complaint List */}
      <div className="space-y-4">
        <AnimatePresence mode="popLayout">
          {paginatedData.length > 0 ? (
            paginatedData.map((complaint) => {
              const { bg, text, icon: StatusIcon } = getStatusConfig(complaint.status);
              return (
                <motion.div 
                  key={complaint.id}
                  layout
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  transition={{ duration: 0.2 }}
                  className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:border-[#87CEEB]/50 transition-all group flex flex-col md:flex-row md:items-center gap-4 md:gap-6"
                >
                  {/* ID & Title */}
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-xs font-bold text-[#FF9933] bg-[#FF9933]/10 px-2 py-1 rounded-md tracking-wide">
                        {complaint.id}
                      </span>
                      <span className={`inline-flex items-center text-xs font-bold px-2.5 py-1 rounded-full ${bg} ${text}`}>
                        <StatusIcon className="w-3.5 h-3.5 mr-1" />
                        {complaint.status}
                      </span>
                    </div>
                    <h3 className="text-lg font-bold text-[#1E3A8A] group-hover:text-[#FF9933] transition-colors line-clamp-1">
                      {complaint.title}
                    </h3>
                  </div>

                  {/* Meta Data */}
                  <div className="grid grid-cols-2 md:flex gap-4 md:gap-8 text-sm text-gray-500">
                    <div className="flex items-center">
                      <FileText className="w-4 h-4 mr-1.5 text-[#87CEEB]" />
                      <span className="truncate">{complaint.category}</span>
                    </div>
                    <div className="flex items-center">
                      <MapPin className="w-4 h-4 mr-1.5 text-[#87CEEB]" />
                      <span className="truncate">{complaint.district}</span>
                    </div>
                    <div className="flex items-center col-span-2 md:col-span-1">
                      <Calendar className="w-4 h-4 mr-1.5 text-[#87CEEB]" />
                      <span>{new Date(complaint.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                    </div>
                  </div>

                  {/* Action Button */}
                  <div className="mt-2 md:mt-0 md:ml-4 flex justify-end">
                    <Link 
                      href={`/citizen/track?id=${complaint.id}`}
                      className="w-full md:w-auto inline-flex justify-center items-center px-4 py-2 rounded-xl bg-gray-50 text-[#1E3A8A] font-medium border border-gray-200 hover:bg-[#1E3A8A] hover:text-white transition-colors"
                    >
                      <Eye className="w-4 h-4 mr-2" /> View Details
                    </Link>
                  </div>
                </motion.div>
              );
            })
          ) : (
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="bg-white p-12 rounded-2xl border border-gray-100 shadow-sm text-center"
            >
              <Search className="w-12 h-12 mx-auto text-gray-300 mb-4" />
              <h3 className="text-lg font-bold text-[#1E3A8A]">No complaints found</h3>
              <p className="text-gray-500 mt-1">Try adjusting your search or filters.</p>
              <button 
                onClick={() => { setSearchTerm(""); setStatusFilter("All"); }}
                className="mt-4 text-sm font-medium text-[#FF9933] hover:underline"
              >
                Clear all filters
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between bg-white px-4 py-3 sm:px-6 rounded-2xl border border-gray-100 shadow-sm">
          <p className="hidden sm:block text-sm text-gray-500">
            Showing <span className="font-medium">{(currentPage - 1) * ITEMS_PER_PAGE + 1}</span> to <span className="font-medium">{Math.min(currentPage * ITEMS_PER_PAGE, filteredAndSortedData.length)}</span> of <span className="font-medium">{filteredAndSortedData.length}</span> results
          </p>
          <div className="flex flex-1 justify-between sm:justify-end gap-2">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="relative inline-flex items-center rounded-xl bg-white px-4 py-2 text-sm font-medium text-gray-700 border border-gray-200 hover:bg-gray-50 disabled:opacity-50 transition-colors"
            >
              <ChevronLeft className="w-4 h-4 mr-1" /> Previous
            </button>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="relative inline-flex items-center rounded-xl bg-white px-4 py-2 text-sm font-medium text-gray-700 border border-gray-200 hover:bg-gray-50 disabled:opacity-50 transition-colors"
            >
              Next <ChevronRight className="w-4 h-4 ml-1" />
            </button>
          </div>
        </div>
      )}

    </motion.div>
  );
}