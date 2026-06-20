"use client";

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  LayoutDashboard, Map, Building2, BarChart3, 
  LogOut, ShieldCheck, MapPin
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

const STATE_LINKS = [
  { name: 'State Portal', href: '/state-admin', icon: LayoutDashboard },
];

export default function StateAdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { profile, signOut } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setIsOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = async () => {
    await signOut();
    router.push('/login');
  };

  const isActive = (path: string) => pathname === path;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col md:flex-row font-sans relative overflow-hidden">
      
      {/* DESKTOP SIDEBAR */}
      <aside className="hidden md:flex flex-col w-72 bg-white border-r border-gray-200 shadow-[4px_0_24px_rgba(0,0,0,0.02)] fixed h-full z-20">
        <div className="p-6 flex items-center space-x-3 border-b border-gray-100 h-24 bg-linear-to-b from-gray-50 to-white">
          <div className="w-12 h-12 rounded-xl bg-linear-to-br from-[#FF9933] to-[#FF8C00] flex items-center justify-center shadow-lg shadow-[#FF9933]/30 border border-[#FF9933]/50">
            <ShieldCheck className="w-7 h-7 text-white" />
          </div>
          <div>
            <h1 className="font-black text-lg text-[#1E3A8A] leading-none tracking-tight">Apka Sikayat</h1>
            <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest mt-1">State Command</p>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto py-6 px-4 space-y-1.5">
          {STATE_LINKS.map((link) => {
            const Icon = link.icon;
            const active = isActive(link.href);
            return (
              <Link 
                key={link.name} href={link.href}
                className={`flex items-center px-4 py-3.5 rounded-xl transition-all font-bold text-sm ${
                  active 
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

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 md:ml-72 flex flex-col min-h-screen relative overflow-y-auto">
        
        {/* Desktop Top Header */}
        <header className="hidden md:flex h-24 bg-white/90 backdrop-blur-xl border-b border-gray-200 items-center justify-between px-10 sticky top-0 z-30 shadow-sm">
          <div className="flex items-center">
            <MapPin className="w-5 h-5 text-[#FF9933] mr-2" />
            <span className="text-xs font-black text-gray-500 uppercase tracking-widest">
              State Jurisdiction: <span className="text-[#1E3A8A]">Delhi NCR State</span>
            </span>
          </div>
          
          <div className="flex items-center space-x-4 relative" ref={menuRef}>
            <button 
              onClick={() => setIsOpen(!isOpen)}
              className="flex items-center justify-center w-11 h-11 rounded-full bg-linear-to-br from-[#1E3A8A] to-[#0f172a] text-white font-black text-sm shadow-lg ring-2 ring-[#FF9933]/50 hover:ring-[#FF9933] transition-all"
            >
              SA
            </button>

            <AnimatePresence>
              {isOpen && (
                <motion.div 
                  initial={{ opacity: 0, y: 10, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: 0.95 }} transition={{ duration: 0.15 }}
                  className="absolute right-0 top-14 w-72 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden z-[100]"
                >
                  <div className="p-5 bg-linear-to-r from-[#1E3A8A] to-[#0f172a] text-white border-b border-gray-800">
                    <span className="text-[10px] font-black uppercase tracking-widest text-[#FF9933] bg-[#FF9933]/20 px-2 py-0.5 rounded-sm mb-1.5 inline-block border border-[#FF9933]/30">State Access</span>
                    <p className="text-base font-black">{profile?.fullName || "State Administrator"}</p>
                    <p className="text-xs text-blue-200 truncate">{profile?.email || "stateadmin@demo.com"}</p>
                  </div>
                  
                  <div className="p-2">
                    <button onClick={handleLogout} className="w-full flex items-center px-3 py-2.5 text-sm font-bold text-red-600 rounded-xl hover:bg-red-50 transition-colors">
                      <LogOut className="w-4 h-4 mr-3" /> Secure Logout
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </header>

        {/* Mobile Top Header */}
        <header className="md:hidden fixed top-0 w-full h-16 bg-white border-b border-gray-200 shadow-sm z-40 px-4 flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <ShieldCheck className="w-6 h-6 text-[#FF9933]" />
            <span className="font-black text-[#1E3A8A] tracking-tight">State Portal</span>
          </div>
          <button 
            onClick={() => setIsOpen(!isOpen)}
            className="w-9 h-9 rounded-full bg-linear-to-br from-[#1E3A8A] to-[#0f172a] text-white font-black text-xs flex items-center justify-center"
          >
            SA
          </button>
        </header>

        {/* Page Content */}
        <div className="p-4 sm:p-8 max-w-[1600px] mx-auto w-full pt-20 md:pt-8 pb-24 md:pb-12">
          {children}
        </div>
      </main>
      
    </div>
  );
}
