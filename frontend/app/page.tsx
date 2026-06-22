"use client";



import React, { useState } from 'react';

import Link from 'next/link';



import { motion, AnimatePresence, Variants } from 'framer-motion';

import {

Layers,

BarChart3,

ArrowRight,

MapPin,

Menu,

X,

Building2

} from 'lucide-react';



// Animation Variants for smooth staggered 3D effects

const containerVariants: Variants = {

hidden: { opacity: 0 },

show: {

opacity: 1,

transition: { staggerChildren: 0.15, delayChildren: 0.1 }

}

};



const itemVariants: Variants = {

hidden: { opacity: 0, y: 30 },

show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 80, damping: 15 } }

};



export default function LandingPage() {

const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);



return (

<div className="min-h-screen bg-[#F8FAFC] text-[#1E3A8A] overflow-hidden selection:bg-[#FF9933] selection:text-white">


{/* 1. 3D GLASSMORPHISM NAVBAR */}

<nav className="fixed top-0 w-full z-50 bg-white/70 backdrop-blur-xl border-b border-white/50 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">

<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

<div className="flex justify-between h-20 items-center">


{/* Logo Section */}

<motion.div

initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5 }}

className="flex items-center space-x-3"

>

{/* NEW LOGO INTEGRATION WITH 3D HOVER */}

<motion.div

whileHover={{ scale: 1.05, rotate: 5, boxShadow: "0 10px 25px rgba(255,153,51,0.4)" }}

className="w-12 h-12 rounded-full overflow-hidden bg-white shadow-[0_4px_15px_rgba(255,153,51,0.3)] border border-gray-100 relative z-10 flex items-center justify-center p-0.5 transition-shadow"

>

<img src="/logo.jpeg" alt="Apka Sikayat Logo" className="w-full h-full object-contain rounded-full" />

</motion.div>

<span className="font-extrabold text-2xl tracking-tight text-[#1E3A8A] drop-shadow-sm">APKA SIKAYAT</span>

</motion.div>


{/* Desktop Navigation */}

<motion.div

initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.2 }}

className="hidden md:flex items-center space-x-8 font-bold text-sm text-gray-600"

>

<a href="#features" className="hover:text-[#FF9933] transition-colors">Features</a>

<a href="#workflow" className="hover:text-[#FF9933] transition-colors">How It Works</a>

<a href="#stats" className="hover:text-[#FF9933] transition-colors">Impact Analytics</a>

<Link href="/login?type=citizen" className="hover:text-[#1E3A8A] transition-colors">Sign In</Link>

<Link href="/register?type=citizen">

<motion.button

whileHover={{ scale: 1.05, y: -2, boxShadow: "0 10px 25px -5px rgba(30, 58, 138, 0.4)" }}

whileTap={{ scale: 0.95 }}

className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#1E3A8A] to-[#2a4d9e] text-white hover:to-[#FF9933] transition-all shadow-md"

>

Register

</motion.button>

</Link>

</motion.div>



{/* Mobile Menu Button */}

<div className="md:hidden">

<button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="p-2 text-[#1E3A8A]">

{isMobileMenuOpen ? <X className="w-7 h-7" /> : <Menu className="w-7 h-7" />}

</button>

</div>

</div>

</div>



{/* Mobile Dropdown Navigation */}

<AnimatePresence>

{isMobileMenuOpen && (

<motion.div

initial={{ opacity: 0, height: 0 }}

animate={{ opacity: 1, height: 'auto' }}

exit={{ opacity: 0, height: 0 }}

className="md:hidden bg-white/95 backdrop-blur-xl border-b border-gray-100 px-6 py-6 shadow-2xl overflow-hidden"

>

<div className="flex flex-col space-y-4">

<a href="#features" onClick={() => setIsMobileMenuOpen(false)} className="block py-2 text-gray-800 font-bold hover:text-[#FF9933]">Features</a>

<a href="#workflow" onClick={() => setIsMobileMenuOpen(false)} className="block py-2 text-gray-800 font-bold hover:text-[#FF9933]">How It Works</a>

<a href="#stats" onClick={() => setIsMobileMenuOpen(false)} className="block py-2 text-gray-800 font-bold hover:text-[#FF9933]">Impact Analytics</a>

<div className="pt-4 border-t border-gray-100 flex flex-col space-y-3">

<Link href="/login?type=citizen" className="text-center py-3 text-gray-800 font-bold bg-gray-50 rounded-xl hover:bg-gray-100">Sign In</Link>

<Link href="/register?type=citizen" className="text-center py-3 rounded-xl bg-gradient-to-r from-[#1E3A8A] to-[#2a4d9e] text-white font-bold shadow-lg">Register</Link>

</div>

</div>

</motion.div>

)}

</AnimatePresence>

</nav>



{/* 2. 3D ANIMATED HERO SECTION */}

<section className="relative pt-32 pb-20 md:pt-44 md:pb-32 overflow-hidden">

{/* Animated 3D Floating Orbs Background */}

<motion.div

animate={{ y: [0, -40, 0], x: [0, 30, 0], scale: [1, 1.1, 1] }}

transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}

className="absolute top-10 right-[5%] w-[40vw] h-[40vw] bg-gradient-to-bl from-[#FF9933]/20 to-[#FFC266]/10 blur-[100px] rounded-full pointer-events-none"

/>

<motion.div

animate={{ y: [0, 40, 0], x: [0, -30, 0], scale: [1, 1.2, 1] }}

transition={{ duration: 12, repeat: Infinity, ease: "easeInOut", delay: 1 }}

className="absolute bottom-0 left-[0%] w-[50vw] h-[50vw] bg-gradient-to-tr from-[#87CEEB]/30 to-[#1E3A8A]/5 blur-[120px] rounded-full pointer-events-none"

/>


<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">

<motion.div variants={containerVariants} initial="hidden" animate="show" className="flex flex-col items-center">


{/* Glowing Badge */}

<motion.div variants={itemVariants}>

<span className="inline-flex items-center px-4 py-1.5 rounded-full text-xs sm:text-sm font-bold bg-white text-[#FF9933] mb-8 border border-[#FF9933]/30 shadow-[0_4px_25px_rgba(255,153,51,0.2)] backdrop-blur-md">

<span className="flex h-2 w-2 relative mr-2">

<span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#FF9933] opacity-75"></span>

<span className="relative inline-flex rounded-full h-2 w-2 bg-[#FF9933]"></span>

</span>

Next-Generation Public Grievance Architecture

</span>

</motion.div>


{/* 3D Text Effect */}

<motion.h1 variants={itemVariants} className="text-5xl sm:text-6xl md:text-7xl font-extrabold tracking-tight mb-6 text-[#1E3A8A] leading-[1.15] max-w-5xl">

AI-Powered <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#FF9933] to-[#FFB366] drop-shadow-sm">CM Grievance</span><br className="hidden sm:block"/> Intelligence Platform

</motion.h1>


<motion.p variants={itemVariants} className="text-lg sm:text-xl text-gray-600 max-w-3xl mx-auto mb-12 leading-relaxed font-medium">

Bridging the gap between citizens and administration through modern machine intelligence, real-time tracking, and automated institutional accountability.

</motion.p>


{/* 3D Interactive Buttons with updated links */}

<motion.div variants={itemVariants} className="flex flex-col sm:flex-row justify-center items-center gap-5 w-full sm:w-auto">

<Link href="/register?type=citizen" className="w-full sm:w-auto">

<motion.div

whileHover={{ scale: 1.05, y: -4, boxShadow: "0 20px 40px -10px rgba(255,153,51,0.5)" }}

whileTap={{ scale: 0.98 }}

className="px-8 py-4 rounded-2xl bg-gradient-to-r from-[#FF9933] to-[#FF8C00] text-white font-bold shadow-xl flex items-center justify-center group overflow-hidden relative"

>

<div className="absolute inset-0 bg-white/20 transform -skew-x-12 -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-out" />

<span className="relative z-10 flex items-center">File a Complaint <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-2 transition-transform duration-300" /></span>

</motion.div>

</Link>


<Link href="/login?type=official" className="w-full sm:w-auto">

<motion.div

whileHover={{ scale: 1.05, y: -4, boxShadow: "0 20px 40px -10px rgba(30,58,138,0.15)" }}

whileTap={{ scale: 0.98 }}

className="px-8 py-4 rounded-2xl bg-white border-2 border-gray-100 text-[#1E3A8A] font-bold hover:border-[#87CEEB]/50 transition-all flex items-center justify-center shadow-lg relative overflow-hidden group"

>

<div className="absolute inset-0 bg-[#87CEEB]/10 transform scale-x-0 group-hover:scale-x-100 transition-transform origin-left duration-300" />

<span className="relative z-10">Officer Portal Login</span>

</motion.div>

</Link>

</motion.div>


</motion.div>

</div>

</section>



{/* 3. 3D FLOATING FEATURES */}

<section id="features" className="py-24 bg-white relative z-20">

<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

<motion.div

initial={{ opacity: 0, y: 20 }}

whileInView={{ opacity: 1, y: 0 }}

viewport={{ once: true, margin: "-100px" }}

className="text-center mb-20"

>

<h2 className="text-4xl font-extrabold tracking-tight text-[#1E3A8A] sm:text-5xl">Platform Capabilities</h2>

<p className="mt-5 text-lg text-gray-500 max-w-2xl mx-auto font-medium">Engineered to eliminate administrative delays and maintain absolute tracking precision.</p>

</motion.div>


<div className="grid grid-cols-1 md:grid-cols-3 gap-8">

{/* Feature 1 */}

<motion.div

whileHover={{ y: -15, boxShadow: "0 30px 60px -15px rgba(255,153,51,0.2)" }}

initial={{ opacity: 0, y: 40 }}

whileInView={{ opacity: 1, y: 0 }}

viewport={{ once: true }}

className="p-8 rounded-[2rem] bg-white border border-gray-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-all duration-300 relative overflow-hidden group"

>

<div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-[#FF9933]/10 to-transparent rounded-bl-[100px] transition-transform duration-500 group-hover:scale-125" />

<div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#FF9933]/20 to-[#FF9933]/5 flex items-center justify-center text-[#FF9933] mb-8 shadow-inner border border-[#FF9933]/20 relative z-10">

<Layers className="w-8 h-8" />

</div>

<h3 className="text-2xl font-black mb-4 text-[#1E3A8A] relative z-10">Intelligent AI Routing</h3>

<p className="text-gray-500 leading-relaxed font-medium relative z-10">Automatically analyzes grievance context to safely categorize and dispatch it directly to the exact department holding correct jurisdiction.</p>

</motion.div>



{/* Feature 2 */}

<motion.div

whileHover={{ y: -15, boxShadow: "0 30px 60px -15px rgba(135,206,235,0.3)" }}

initial={{ opacity: 0, y: 40 }}

whileInView={{ opacity: 1, y: 0 }}

viewport={{ once: true }}

transition={{ delay: 0.15 }}

className="p-8 rounded-[2rem] bg-white border border-gray-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-all duration-300 relative overflow-hidden group"

>

<div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-[#87CEEB]/20 to-transparent rounded-bl-[100px] transition-transform duration-500 group-hover:scale-125" />

<div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#87CEEB]/30 to-[#87CEEB]/10 flex items-center justify-center text-[#1E3A8A] mb-8 shadow-inner border border-[#87CEEB]/40 relative z-10">

<MapPin className="w-8 h-8" />

</div>

<h3 className="text-2xl font-black mb-4 text-[#1E3A8A] relative z-10">Geospatial Mapping</h3>

<p className="text-gray-500 leading-relaxed font-medium relative z-10">Maps live grievance coordinates to locate multi-incident failure zones, enabling accurate community hot-spot interventions.</p>

</motion.div>



{/* Feature 3 */}

<motion.div

whileHover={{ y: -15, boxShadow: "0 30px 60px -15px rgba(30,58,138,0.2)" }}

initial={{ opacity: 0, y: 40 }}

whileInView={{ opacity: 1, y: 0 }}

viewport={{ once: true }}

transition={{ delay: 0.3 }}

className="p-8 rounded-[2rem] bg-white border border-gray-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-all duration-300 relative overflow-hidden group"

>

<div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-[#1E3A8A]/10 to-transparent rounded-bl-[100px] transition-transform duration-500 group-hover:scale-125" />

<div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#1E3A8A]/10 to-[#1E3A8A]/5 flex items-center justify-center text-[#1E3A8A] mb-8 shadow-inner border border-[#1E3A8A]/20 relative z-10">

<BarChart3 className="w-8 h-8" />

</div>

<h3 className="text-2xl font-black mb-4 text-[#1E3A8A] relative z-10">Executive Visibility</h3>

<p className="text-gray-500 leading-relaxed font-medium relative z-10">Provides high-level dashboard feeds to the central leadership framework, displaying officer performance and automated resolution tracking metrics.</p>

</motion.div>

</div>

</div>

</section>



{/* 4. DEEP 3D STATISTICS */}

<section id="stats" className="py-24 relative overflow-hidden">

<div className="absolute inset-0 bg-[#1E3A8A]" />

<div className="absolute inset-0 bg-gradient-to-br from-[#1E3A8A] via-[#14285F] to-[#0A1430] opacity-95" />


{/* Animated Radial Glows */}

<motion.div

animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.5, 0.3] }}

transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}

className="absolute top-1/2 left-1/4 -translate-y-1/2 w-[600px] h-[600px] bg-[radial-gradient(circle,_rgba(255,153,51,0.15)_0%,_transparent_70%)] pointer-events-none"

/>



<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">

<div className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-12 text-center">

{[

{ val: "94%", label: "SLA Resolution Rate", color: "text-[#FF9933]", shadow: "drop-shadow-[0_0_15px_rgba(255,153,51,0.5)]" },

{ val: "2.4 hrs", label: "Avg. Initial Response", color: "text-[#87CEEB]", shadow: "drop-shadow-[0_0_15px_rgba(135,206,235,0.5)]" },

{ val: "45+", label: "Integrated Departments", color: "text-white", shadow: "drop-shadow-[0_0_15px_rgba(255,255,255,0.5)]" },

{ val: "250k+", label: "Grievances Processed", color: "text-[#FFC266]", shadow: "drop-shadow-[0_0_15px_rgba(255,194,102,0.5)]" }

].map((stat, i) => (

<motion.div

key={i}

initial={{ opacity: 0, scale: 0.5, y: 50 }}

whileInView={{ opacity: 1, scale: 1, y: 0 }}

viewport={{ once: true }}

transition={{ delay: i * 0.15, type: "spring", stiffness: 100 }}

className="p-8 rounded-[2rem] bg-white/5 backdrop-blur-xl border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.3)] hover:bg-white/10 transition-all duration-300"

>

<p className={`text-4xl sm:text-5xl md:text-6xl font-black ${stat.color} ${stat.shadow} mb-3 tracking-tight`}>{stat.val}</p>

<p className="text-xs sm:text-sm text-blue-100 font-bold tracking-widest uppercase opacity-90">{stat.label}</p>

</motion.div>

))}

</div>

</div>

</section>



{/* 5. GLOWING GOVERNMENT MISSION */}

<section className="py-32 bg-[#F8FAFC] relative overflow-hidden">

{/* Soft center glow */}

<div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[60vw] h-[60vw] bg-white rounded-full blur-[120px] pointer-events-none opacity-60" />


<div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">

<motion.div

initial={{ opacity: 0, scale: 0.9 }}

whileInView={{ opacity: 1, scale: 1 }}

viewport={{ once: true }}

transition={{ duration: 0.6 }}

className="flex flex-col items-center"

>

<motion.div

whileHover={{ rotateY: 180 }}

transition={{ duration: 0.8, ease: "backOut" }}

className="inline-flex items-center justify-center w-20 h-20 rounded-[2rem] bg-gradient-to-br from-white to-gray-50 shadow-[0_10px_40px_rgba(0,0,0,0.1)] border border-gray-100 mb-8 text-[#FF9933]"

>

<Building2 className="w-10 h-10" />

</motion.div>

<h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-[#1E3A8A] mb-8 tracking-tight">Transparent Governance Commitment</h2>

<div className="relative">

<span className="absolute -top-6 -left-6 text-6xl text-[#FF9933]/20 font-serif">"</span>

<p className="text-gray-600 leading-relaxed text-lg sm:text-xl md:text-2xl font-medium italic relative z-10">

The metric of effective leadership is determined by how swiftly an administrative grid listens, adapts, and implements relief mechanics for its public sphere. Apka Sikayat translates governance objectives directly into actionable technology, removing legacy bottlenecks completely to uphold citizen accountability.

</p>

<span className="absolute -bottom-10 -right-6 text-6xl text-[#FF9933]/20 font-serif">"</span>

</div>

</motion.div>

</div>

</section>



{/* 6. MODERN FOOTER */}

<footer className="bg-white border-t border-gray-100 py-10 relative z-20">

<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row justify-between items-center gap-6">

<div className="flex items-center space-x-3">

<div className="w-10 h-10 rounded-full bg-white shadow-md border border-gray-100 overflow-hidden flex items-center justify-center p-0.5">

<img src="/logo.jpg" alt="Logo mini" className="w-full h-full object-contain rounded-full" />

</div>

<span className="font-extrabold text-sm tracking-widest text-[#1E3A8A]">APKA SIKAYAT © 2026</span>

</div>

<p className="text-xs font-bold text-gray-400 uppercase tracking-widest text-center sm:text-right">Designed for advanced civic engineering and systemic public infrastructure optimization.</p>

</div>

</footer>

</div>

);

}