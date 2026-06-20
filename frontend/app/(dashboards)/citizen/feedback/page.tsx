"use client";

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Star, MessageSquare, Send, RefreshCcw } from 'lucide-react';
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, doc, updateDoc, addDoc } from "firebase/firestore";

// ==========================================
// BACKEND TYPES
// ==========================================
interface FeedbackPayload {
  complaintId: string;
  rating: number;
  comments: string;
}

export default function FeedbackPage() {
  const { user } = useAuth();
  const [resolvedComplaints, setResolvedComplaints] = useState<any[]>([]);
  const [selectedComplaint, setSelectedComplaint] = useState('');
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comments, setComments] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchResolvedComplaints = async () => {
      if (!user) return;
      try {
        const q = query(
          collection(db, "complaints"), 
          where("uid", "==", user.uid)
        );
        const querySnapshot = await getDocs(q);
        const list: any[] = [];
        querySnapshot.forEach((docSnap) => {
          const data = docSnap.data();
          // Only show complaints that are resolved or closed, and have not yet had feedback submitted
          const isEligible = (data.status === 'Resolved' || data.status === 'Closed' || data.status === 'Citizen_Verified') && !data.feedbackSubmitted;
          if (isEligible) {
            list.push({
              id: docSnap.id,
              title: data.title || "Untitled Complaint",
              status: data.status
            });
          }
        });
        setResolvedComplaints(list);
        if (list.length > 0) {
          setSelectedComplaint(list[0].id);
        }
      } catch (error) {
        console.error("Error fetching eligible complaints for feedback:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchResolvedComplaints();
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (rating === 0) return alert("Please provide a star rating.");
    if (!selectedComplaint) return alert("Please select a complaint.");
    
    setIsSubmitting(true);
    try {
      // 1. Save feedback to a new feedbacks collection
      await addDoc(collection(db, "feedbacks"), {
        complaintId: selectedComplaint,
        uid: user?.uid,
        rating,
        comments,
        createdAt: new Date().toISOString()
      });

      // 2. Mark the complaint as having feedback submitted
      await updateDoc(doc(db, "complaints", selectedComplaint), {
        feedbackSubmitted: true,
        feedback: { rating, comments, createdAt: new Date().toISOString() }
      });

      alert("Thank you for your feedback!");
      
      // Update local state list
      const updatedList = resolvedComplaints.filter(c => c.id !== selectedComplaint);
      setResolvedComplaints(updatedList);
      setSelectedComplaint(updatedList.length > 0 ? updatedList[0].id : '');
      setRating(0);
      setComments('');
    } catch (err: any) {
      console.error(err);
      alert(`Failed to submit feedback: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReopen = async () => {
    if (!selectedComplaint) return;
    setIsSubmitting(true);
    try {
      // Set status back to 'In Progress' / 'Submitted' or reopen
      await updateDoc(doc(db, "complaints", selectedComplaint), {
        status: "In Progress",
        currentStep: 3, // In Progress
        updatedAt: new Date().toISOString()
      });
      alert(`Complaint ${selectedComplaint} has been requested for reopening.`);
      
      const updatedList = resolvedComplaints.filter(c => c.id !== selectedComplaint);
      setResolvedComplaints(updatedList);
      setSelectedComplaint(updatedList.length > 0 ? updatedList[0].id : '');
      setRating(0);
      setComments('');
    } catch (err: any) {
      console.error(err);
      alert(`Failed to reopen complaint: ${err.message}`);
    } finally {
      setIsSubmitting(false);
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
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-3xl mx-auto space-y-6">
      
      <div>
        <h1 className="text-2xl font-bold text-[#1E3A8A]">Provide Feedback</h1>
        <p className="text-sm text-gray-500 mt-1">Help us improve by rating recently resolved issues.</p>
      </div>

      <div className="bg-white p-6 md:p-8 rounded-3xl border border-gray-100 shadow-sm">
        {resolvedComplaints.length > 0 ? (
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Select Complaint */}
            <div>
              <label className="block text-sm font-bold text-[#1E3A8A] mb-2">Select Resolved Complaint</label>
              <select 
                value={selectedComplaint}
                onChange={(e) => setSelectedComplaint(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-[#87CEEB] bg-gray-50/50 font-medium"
              >
                {resolvedComplaints.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.id}: {c.title}
                  </option>
                ))}
              </select>
            </div>

            {/* Star Rating */}
            <div className="py-4 border-y border-gray-50 text-center">
              <label className="block text-sm font-bold text-[#1E3A8A] mb-4">How satisfied are you with the resolution?</label>
              <div className="flex justify-center gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setRating(star)}
                    onMouseEnter={() => setHoverRating(star)}
                    onMouseLeave={() => setHoverRating(0)}
                    className="focus:outline-none transition-transform hover:scale-110"
                  >
                    <Star 
                      className={`w-10 h-10 ${
                        star <= (hoverRating || rating) 
                          ? 'fill-[#FF9933] text-[#FF9933]' 
                          : 'fill-transparent text-gray-300'
                      }`} 
                    />
                  </button>
                ))}
              </div>
              {rating > 0 && (
                <p className="text-xs font-bold text-[#FF9933] mt-3 uppercase tracking-wider">
                  {['Very Dissatisfied', 'Dissatisfied', 'Neutral', 'Satisfied', 'Very Satisfied'][rating - 1]}
                </p>
              )}
            </div>

            {/* Comments */}
            <div>
              <label className="block text-sm font-bold text-[#1E3A8A] mb-2">Additional Comments</label>
              <textarea 
                rows={4}
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                placeholder="Tell us more about your experience..."
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-[#87CEEB] bg-gray-50/50 resize-none"
              />
            </div>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button 
                type="submit" 
                disabled={isSubmitting || rating === 0}
                className="flex-1 flex justify-center items-center py-3 bg-linear-to-r from-[#1E3A8A] to-[#2a4eab] text-white font-medium rounded-xl hover:opacity-90 transition disabled:opacity-50 shadow-md"
              >
                {isSubmitting ? "Submitting..." : <><Send className="w-4 h-4 mr-2" /> Submit Feedback</>}
              </button>
              
              {/* Show Reopen option only if rating is 1 or 2 */}
              {(rating === 1 || rating === 2) && (
                <button 
                  type="button"
                  onClick={handleReopen}
                  className="flex-1 flex justify-center items-center py-3 bg-red-50 text-red-600 font-medium rounded-xl hover:bg-red-100 transition border border-red-100"
                >
                  <RefreshCcw className="w-4 h-4 mr-2" /> Reopen Complaint
                </button>
              )}
            </div>

          </form>
        ) : (
          <div className="text-center py-12 text-gray-500 font-medium">
            You do not have any resolved complaints eligible for feedback at this time.
          </div>
        )}
      </div>
    </motion.div>
  );
}