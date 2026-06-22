"use client";

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, Map, Building2, BarChart3,
  FileSpreadsheet, BrainCircuit, Bell, LogOut, Settings,
  ShieldCheck, Bot, Sparkles
} from 'lucide-react';

// =========================================================================
// SIDEBAR NAVIGATION (Districts and Reports removed from here)
// =========================================================================
const CM_LINKS = [
  { name: 'War Room', href: '/cm', icon: LayoutDashboard },
  { name: 'Live Heatmap', href: '/cm/heatmap', icon: Map },
  { name: 'Departments', href: '/cm/departments', icon: Building2 },
  { name: 'Analytics', href: '/cm/analytics', icon: BarChart3 },
  { name: 'AI Insights', href: '/cm/ai-insights', icon: BrainCircuit },
  { name: 'Reports', href: '/cm/reports', icon: BrainCircuit },
];

// =========================================================================
// TOP RIGHT HEADER ACTIONS (Reports moved here)
// =========================================================================
const TopRightActions = () => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setIsOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="flex items-center space-x-2 sm:space-x-4 relative" ref={menuRef}>

      {/* REPORTS BUTTON (Moved from Sidebar) */}
      <Link href="/cm/reports" title="Executive Reports" className="relative p-2 text-gray-500 hover:text-[#1E3A8A] transition-colors rounded-full hover:bg-[#87CEEB]/10 flex items-center">
        <FileSpreadsheet className="w-5 h-5 sm:w-6 sm:h-6" />
      </Link>

      {/* NOTIFICATIONS BELL */}
      <Link href="/cm/notifications" title="Alerts" className="relative p-2 text-gray-500 hover:text-[#1E3A8A] transition-colors rounded-full hover:bg-gray-100">
        <Bell className="w-5 h-5 sm:w-6 sm:h-6" />
        <span className="absolute top-1.5 right-1.5 flex h-2.5 w-2.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500 border border-white"></span>
        </span>
      </Link>

      {/* PROFILE DROPDOWN */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-center w-9 h-9 sm:w-11 sm:h-11 ml-2 rounded-full bg-linear-to-br from-[#1E3A8A] to-[#0f172a] text-white font-black text-sm shadow-lg ring-2 ring-[#FF9933]/50 hover:ring-[#FF9933] transition-all"
      >
        CM
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: 0.95 }} transition={{ duration: 0.15 }}
            className="absolute right-0 top-14 sm:top-16 w-72 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden z-[100]"
          >
            <div className="p-5 bg-linear-to-r from-[#1E3A8A] to-[#0f172a] text-white border-b border-gray-800">
              <span className="text-[10px] font-black uppercase tracking-widest text-[#FF9933] bg-[#FF9933]/20 px-2 py-0.5 rounded-sm mb-1.5 inline-block border border-[#FF9933]/30">Executive Access</span>
              <p className="text-base font-black">Chief Minister's Office</p>
              <p className="text-xs text-blue-200 truncate">Govt. of NCT of Delhi</p>
            </div>

            <div className="p-2 space-y-1">
              <Link href="/cm/settings" onClick={() => setIsOpen(false)} className="flex items-center px-3 py-2.5 text-sm font-bold text-gray-700 rounded-xl hover:bg-gray-50 transition-colors">
                <Settings className="w-4 h-4 mr-3 text-gray-400" /> Platform Settings
              </Link>
            </div>

            <div className="p-2 border-t border-gray-50">
              <Link href="/login" onClick={() => setIsOpen(false)} className="flex items-center px-3 py-2.5 text-sm font-bold text-red-600 rounded-xl hover:bg-red-50 transition-colors">
                <LogOut className="w-4 h-4 mr-3" /> Secure Logout
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// =========================================================================
// DRAGGABLE FLOATING COPILOT COMPONENT
// =========================================================================
const DraggableCopilot = () => {
  return (
    <motion.div
      drag
      dragMomentum={false}
      // Prevents dragging text accidentally and ensures touch events work on mobile
      style={{ touchAction: "none" }}
      className="fixed bottom-24 right-6 sm:bottom-12 sm:right-12 z-[100] flex flex-col items-center gap-2 cursor-grab active:cursor-grabbing"
    >
      {/* Floating Tooltip */}
      <motion.div
        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1 }}
        className="bg-white/90 backdrop-blur-sm text-[#1E3A8A] px-3 py-1.5 rounded-xl shadow-lg border border-gray-200 text-[10px] font-black uppercase tracking-widest flex items-center pointer-events-none"
      >
        <Sparkles className="w-3 h-3 mr-1 text-[#FF9933]" /> Copilot AI
      </motion.div>

      {/* Main Bot Button */}
      <Link href="/cm/copilot" className="group relative">
        <motion.div
          whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
          className="flex items-center justify-center w-14 h-14 sm:w-16 sm:h-16 bg-linear-to-br from-[#1E3A8A] to-[#0f172a] rounded-full shadow-2xl border-2 border-[#87CEEB]/50 relative overflow-hidden"
        >
          {/* Animated Background Glow */}
          <div className="absolute inset-0 bg-[#FF9933] opacity-0 group-hover:opacity-20 transition-opacity duration-300"></div>

          <Bot className="w-7 h-7 sm:w-8 sm:h-8 text-[#FF9933] group-hover:animate-pulse relative z-10" />
        </motion.div>

        {/* Online Status Dot */}
        <span className="absolute bottom-0 right-0 flex h-4 w-4">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#22C55E] opacity-75"></span>
          <span className="relative inline-flex rounded-full h-4 w-4 bg-[#22C55E] border-2 border-[#1E3A8A]"></span>
        </span>
      </Link>
    </motion.div>
  );
};

// =========================================================================
// MAIN LAYOUT COMPONENT
// =========================================================================
export default function CMLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  // Ensure the drag boundary is the entire screen
  const containerRef = useRef<HTMLDivElement>(null);
  const isActive = (path: string) => pathname === path || (path !== '/cm' && pathname.startsWith(path));

  return (
    <div ref={containerRef} className="min-h-screen bg-gray-50 flex flex-col md:flex-row font-sans relative overflow-hidden">

      {/* --------------------------------------------------------- */}
      {/* DESKTOP SIDEBAR */}
      {/* --------------------------------------------------------- */}
      <aside className="hidden md:flex flex-col w-72 bg-white border-r border-gray-200 shadow-[4px_0_24px_rgba(0,0,0,0.02)] fixed h-full z-20">
        <div className="p-6 flex items-center space-x-3 border-b border-gray-100 h-24 bg-linear-to-b from-gray-50 to-white">
          <div className="w-12 h-12 rounded-xl bg-linear-to-br from-[#FF9933] to-[#FF8C00] flex items-center justify-center shadow-lg shadow-[#FF9933]/30 border border-[#FF9933]/50">
            <ShieldCheck className="w-7 h-7 text-white" />
          </div>
          <div>
            <h1 className="font-black text-xl text-[#1E3A8A] leading-none tracking-tight">Apka Sikayat</h1>
            <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mt-1">Command Center</p>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto py-6 px-4 space-y-1.5">
          {CM_LINKS.map((link) => {
            const Icon = link.icon;
            const active = isActive(link.href);
            return (
              <Link
                key={link.name} href={link.href}
                className={`flex items-center px-4 py-3.5 rounded-xl transition-all font-bold text-sm ${active
                    ? 'bg-[#1E3A8A] text-white shadow-md shadow-[#1E3A8A]/20'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-[#1E3A8A]'
                  }`}
              >
                <Icon className={`w-5 h-5 mr-3 ${active ? 'text-[#FF9933]' : 'text-gray-400'}`} />
                {link.name}
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* --------------------------------------------------------- */}
      {/* MAIN CONTENT AREA */}
      {/* --------------------------------------------------------- */}
      <main className="flex-1 md:ml-72 flex flex-col min-h-screen relative overflow-y-auto">

        {/* Desktop Top Header */}
        <header className="hidden md:flex h-24 bg-white/90 backdrop-blur-xl border-b border-gray-200 items-center justify-between px-10 sticky top-0 z-30 shadow-sm">
          <div className="flex items-center">
            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse mr-3"></div>
            <span className="text-xs font-black text-gray-500 uppercase tracking-widest">Live System Status: <span className="text-green-600">Operational</span></span>
          </div>
          <TopRightActions />
        </header>

        {/* Mobile Top Header */}
        <header className="md:hidden fixed top-0 w-full h-16 bg-white border-b border-gray-200 shadow-sm z-40 px-4 flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <ShieldCheck className="w-6 h-6 text-[#FF9933]" />
            <span className="font-black text-[#1E3A8A] tracking-tight">CM Portal</span>
          </div>
          <TopRightActions />
        </header>

        {/* Page Content */}
        <div className="p-4 sm:p-8 max-w-[1600px] mx-auto w-full pt-20 md:pt-8 pb-24 md:pb-12">
          {children}
        </div>
      </main>

      {/* --------------------------------------------------------- */}
      {/* DRAGGABLE COPILOT FAB */}
      {/* --------------------------------------------------------- */}
      <DraggableCopilot />

      {/* --------------------------------------------------------- */}
      {/* MOBILE BOTTOM NAVIGATION */}
      {/* --------------------------------------------------------- */}
      <nav className="md:hidden fixed bottom-0 w-full bg-white border-t border-gray-200 z-50 flex overflow-x-auto shadow-[0_-4px_20px_-1px_rgba(0,0,0,0.08)] pb-safe [&::-webkit-scrollbar]:hidden">
        {CM_LINKS.map((link) => {
          const Icon = link.icon;
          const active = isActive(link.href);
          return (
            <Link
              key={link.name} href={link.href}
              className={`flex-shrink-0 flex flex-col items-center justify-center w-[76px] py-3 transition-colors ${active ? 'text-[#1E3A8A]' : 'text-gray-400'}`}
            >
              <div className={`p-1.5 rounded-xl mb-1 transition-all ${active ? 'bg-[#1E3A8A]/10 scale-110 text-[#FF9933]' : 'bg-transparent'}`}>
                <Icon className="w-5 h-5" />
              </div>
              <span className="text-[9px] font-black uppercase tracking-wider text-center px-1 truncate w-full">{link.name}</span>
            </Link>
          );
        })}
      </nav>

    </div>
  );
}