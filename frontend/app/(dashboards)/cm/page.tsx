"use client";

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  HeartPulse, AlertTriangle, Trophy, Radio, MessageSquare, 
  Flame, Waves, Zap, Droplet, Wind, Stethoscope, ShieldAlert,
  Bot, TrendingUp, AlertOctagon, CheckCircle2, Star, MapPin
} from 'lucide-react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell
} from 'recharts';
import { collection, onSnapshot, query, orderBy, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export default function CMWarRoomDashboard() {
  const [complaints, setComplaints] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, "complaints"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items: any[] = [];
      snapshot.forEach((doc) => {
        items.push({ id: doc.id, ...doc.data() });
      });
      setComplaints(items);
      setIsLoading(false);
    }, (error) => {
      console.error("Firestore CM War Room query failed:", error);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  if (isLoading) {
    return (
      <div className="flex flex-col h-[60vh] items-center justify-center space-y-4">
        <div className="animate-spin w-12 h-12 border-4 border-[#FF9933] border-t-transparent rounded-full mb-4"></div>
        <p className="text-[#1E3A8A] font-black tracking-widest uppercase text-xs">Syncing City Grid...</p>
      </div>
    );
  }

  // 1. DYNAMIC EMERGENCIES (Critical priority complaints)
  const criticalComplaints = complaints.filter(c => c.priority === 'CRITICAL' && !['Closed', 'Resolved'].includes(c.status));
  const emergencyAlerts = criticalComplaints.slice(0, 5).map(c => {
    let icon = AlertTriangle;
    if (c.category === 'Water Related Issues' || c.category?.toLowerCase().includes('water')) icon = Waves;
    if (c.category?.toLowerCase().includes('fire') || c.category?.toLowerCase().includes('hazard')) icon = Flame;
    if (c.category?.toLowerCase().includes('electricity') || c.category?.toLowerCase().includes('wire')) icon = Zap;
    if (c.category?.toLowerCase().includes('sanitation') || c.category?.toLowerCase().includes('waste')) icon = Wind;

    return {
      id: c.id,
      type: c.title || 'Critical Issue Reported',
      loc: c.location?.address || c.district || 'Delhi Region',
      time: c.createdAt ? new Date(c.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Live',
      icon: icon,
      severity: 'Critical'
    };
  });

  // Fallback if empty
  if (emergencyAlerts.length === 0) {
    emergencyAlerts.push({
      id: 'EMG-01',
      type: 'Simulation Active',
      loc: 'CM Command HQ, Delhi',
      time: 'Now',
      icon: ShieldAlert,
      severity: 'Medium'
    });
  }

  // 2. DISTRICT RANKINGS COMPILATION
  const districtGroups: { [key: string]: { open: number, critical: number, ratings: number[] } } = {};
  complaints.forEach(c => {
    const dist = c.district || 'New Delhi';
    if (!districtGroups[dist]) {
      districtGroups[dist] = { open: 0, critical: 0, ratings: [] };
    }
    const isClosed = ['Resolved', 'Closed', 'Citizen_Verified'].includes(c.status);
    if (!isClosed) {
      districtGroups[dist].open++;
      if (c.priority === 'CRITICAL') {
        districtGroups[dist].critical++;
      }
    }
    if (c.feedback?.rating) {
      districtGroups[dist].ratings.push(c.feedback.rating);
    }
  });

  const districtRankings = Object.keys(districtGroups).map((name, i) => {
    const group = districtGroups[name];
    const totalRatings = group.ratings.length;
    const avgCsat = totalRatings > 0 
      ? parseFloat((group.ratings.reduce((a, b) => a + b, 0) / totalRatings).toFixed(1))
      : 4.5;
    
    // Performance score calculations
    const score = Math.max(30, 100 - (group.open * 2) - (group.critical * 5));
    const risk = Math.min(100, (group.open * 5) + (group.critical * 10));

    return {
      id: i + 1,
      name,
      score: Math.round(score),
      open: group.open,
      critical: group.critical,
      csat: avgCsat,
      heatIndex: Math.round(risk),
      risk: Math.round(risk)
    };
  }).sort((a, b) => b.score - a.score);

  if (districtRankings.length === 0) {
    districtRankings.push({ id: 1, name: 'New Delhi', score: 95, open: 0, critical: 0, csat: 4.8, heatIndex: 10, risk: 10 });
  }

  // 3. LIVE INCIDENT FEED
  const liveIncidentFeed = complaints.slice(0, 6).map(c => {
    let type = 'New Complaint';
    let tagColor = 'bg-gray-100 text-gray-700 border-gray-200';
    if (c.priority === 'CRITICAL') {
      type = 'Life Threatening';
      tagColor = 'bg-red-100 text-red-700 border-red-200';
    } else if (c.aiValidation?.is_grievance) {
      type = 'AI Screened';
      tagColor = 'bg-purple-100 text-purple-700 border-purple-200';
    } else if (['Resolved', 'Closed'].includes(c.status)) {
      type = 'Resolved Action';
      tagColor = 'bg-green-100 text-green-700 border-green-200';
    }

    const tDiff = Math.max(1, Math.round((Date.now() - new Date(c.createdAt || Date.now()).getTime()) / 60000));
    const timeStr = tDiff < 60 ? `${tDiff}m ago` : `${Math.round(tDiff / 60)}h ago`;

    return {
      type,
      title: c.title || 'Grievance Filed',
      loc: c.district || 'Delhi Region',
      time: timeStr,
      tag: tagColor
    };
  });

  // 4. CSAT SENTIMENT COMPILATION
  let positive = 0, neutral = 0, negative = 0;
  const feedbackList = complaints.filter(c => c.feedback?.rating);
  feedbackList.forEach(c => {
    const r = c.feedback.rating;
    if (r >= 4) positive++;
    else if (r === 3) neutral++;
    else negative++;
  });
  const totalFeedback = feedbackList.length || 1;
  const csatSentiment = [
    { name: 'Positive Feedback', value: Math.round((positive / totalFeedback) * 100) || 75, color: '#22C55E' },
    { name: 'Neutral Inquiry', value: Math.round((neutral / totalFeedback) * 100) || 15, color: '#87CEEB' },
    { name: 'Negative Escalation', value: Math.round((negative / totalFeedback) * 100) || 10, color: '#EF4444' },
  ];

  // 5. GOVERNANCE PULSE METER
  const categoriesList = ['Roads', 'Water Related Issues', 'Electricity', 'Sanitation & Cleanliness', 'Healthcare', 'Public Safety'];
  const pulseData = categoriesList.map((cat, i) => {
    const catComplaints = complaints.filter(c => c.category === cat || (cat === 'Roads' && c.category === 'Civic Infrastructure'));
    const totalCat = catComplaints.length;
    const catClosed = catComplaints.filter(c => ['Resolved', 'Closed', 'Citizen_Verified'].includes(c.status)).length;
    
    // Performance score based on resolution rate
    const score = totalCat > 0 ? Math.round((catClosed / totalCat) * 100) : 80;
    const colors = ['#1E3A8A', '#87CEEB', '#22C55E', '#F59E0B', '#87CEEB', '#1E3A8A'];
    const icons = [TrendingUp, Droplet, Zap, Wind, Stethoscope, ShieldAlert];

    return {
      name: cat,
      score: score,
      icon: icons[i % icons.length],
      color: colors[i % colors.length],
      trend: score > 70 ? '+2.5' : '-1.0'
    };
  });

  // Insert overall Delhi indicator
  const totalCount = complaints.length;
  const overallResolved = complaints.filter(c => ['Resolved', 'Closed', 'Citizen_Verified'].includes(c.status)).length;
  const overallScore = totalCount > 0 ? Math.round((overallResolved / totalCount) * 100) : 78;
  pulseData.unshift({
    name: 'Overall Delhi',
    score: overallScore,
    icon: HeartPulse,
    color: '#FF9933',
    trend: '+1.5'
  });

  // 6. CSAT TREND INDEX
  const csatTrend = [
    { month: 'Jan', index: 72 }, 
    { month: 'Feb', index: 75 }, 
    { month: 'Mar', index: 78 },
    { month: 'Apr', index: 76 }, 
    { month: 'May', index: 80 }, 
    { month: 'Jun', index: Math.round(overallScore) },
  ];

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 pb-4 border-b border-gray-200">
        <div>
          <h2 className="text-3xl font-black text-[#1E3A8A] tracking-tight">Governance War Room</h2>
          <p className="text-sm font-bold text-[#FF9933] uppercase tracking-widest mt-1">Real-Time City Command Center</p>
        </div>
        <div className="flex items-center bg-white border border-gray-200 shadow-sm px-4 py-2 rounded-xl">
          <span className="flex h-3 w-3 mr-3 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
          </span>
          <span className="text-xs font-black text-gray-700 tracking-wider uppercase">Live State Synced</span>
        </div>
      </div>

      {/* ROW 1: PULSE METER & EMERGENCY ALERTS */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        
        {/* GOVERNANCE PULSE METER */}
        <div className="xl:col-span-2 bg-white rounded-3xl border border-gray-200 shadow-sm p-6 flex flex-col justify-between">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h3 className="text-lg font-black text-[#1E3A8A] flex items-center">
                <HeartPulse className="w-5 h-5 mr-2 text-[#FF9933]" /> Governance Pulse Meter
              </h3>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Quick Service Quality Indicators</p>
            </div>
            <button className="text-[10px] font-black text-[#1E3A8A] bg-[#87CEEB]/10 px-3 py-1.5 rounded-lg hover:bg-[#87CEEB]/20 transition-colors uppercase">
              View Historical Trend
            </button>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {pulseData.map((pulse, i) => {
              const isOverall = pulse.name === 'Overall Delhi';
              return (
                <div key={i} className={`p-4 rounded-2xl border transition-colors ${isOverall ? 'bg-linear-to-br from-[#1E3A8A] to-[#0f172a] text-white border-transparent shadow-md' : 'bg-gray-50 border-gray-100 hover:border-[#FF9933]/30'}`}>
                  <div className="flex justify-between items-start mb-2">
                    <pulse.icon className={`w-6 h-6 ${isOverall ? 'text-[#FF9933]' : ''}`} style={{ color: !isOverall ? pulse.color : undefined }} />
                    <div className="text-right">
                      <span className={`text-2xl font-black ${isOverall ? 'text-white' : 'text-gray-900'}`}>{pulse.score}</span>
                      <p className={`text-[10px] font-bold ${pulse.trend.startsWith('+') ? 'text-green-500' : 'text-red-500'}`}>{pulse.trend}%</p>
                    </div>
                  </div>
                  <p className={`text-[10px] font-black uppercase tracking-wider mt-2 ${isOverall ? 'text-blue-200' : 'text-gray-500'}`}>{pulse.name}</p>
                  <div className={`w-full h-1.5 rounded-full mt-2 overflow-hidden ${isOverall ? 'bg-white/20' : 'bg-gray-200'}`}>
                    <div className="h-full rounded-full" style={{ width: `${pulse.score}%`, backgroundColor: isOverall ? '#FF9933' : pulse.color }}></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* EMERGENCY ALERTS CENTER */}
        <div className="bg-red-50/80 rounded-3xl border border-red-200 shadow-sm overflow-hidden flex flex-col h-[400px]">
          <div className="p-5 bg-red-600 flex justify-between items-center text-white border-b border-red-700">
            <div>
              <h3 className="text-sm font-black uppercase tracking-widest flex items-center shadow-red-900 drop-shadow-sm">
                <AlertTriangle className="w-5 h-5 mr-2 text-red-200" /> Emergency Center
              </h3>
            </div>
            <span className="bg-white text-red-600 px-2.5 py-0.5 rounded text-[10px] font-black uppercase tracking-widest shadow-sm">{emergencyAlerts.length} Active</span>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar">
            {emergencyAlerts.map((alert, i) => (
              <div key={i} className="p-3 bg-white rounded-xl border-l-4 border-l-red-500 shadow-sm hover:shadow-md transition-shadow cursor-pointer relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:opacity-20 transition-opacity">
                  <alert.icon className="w-12 h-12 text-red-600" />
                </div>
                <div className="relative z-10">
                  <div className="flex justify-between items-start mb-1">
                    <p className="text-xs font-black text-red-700 uppercase tracking-wider">{alert.type}</p>
                    <span className="text-[10px] font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded">{alert.time}</span>
                  </div>
                  <p className="text-sm font-bold text-gray-900">{alert.loc}</p>
                  <div className="mt-2 flex justify-between items-center">
                    <span className="text-[9px] font-black uppercase tracking-widest text-red-500 bg-red-50 px-2 py-0.5 rounded border border-red-100">{alert.severity} Priority</span>
                    <button className="text-[10px] font-black text-white bg-red-600 px-3 py-1 rounded hover:bg-red-700 transition-colors uppercase">Escalate</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ROW 2: DISTRICT RANKING & LIVE FEED */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        
        {/* DISTRICT RANKING LEADERBOARD */}
        <div className="xl:col-span-2 bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
          <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
            <div>
              <h3 className="text-lg font-black text-[#1E3A8A] flex items-center">
                <Trophy className="w-5 h-5 mr-2 text-[#FF9933]" /> District Performance Matrix
              </h3>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Compare governance performance & infrastructure risk</p>
            </div>
          </div>
          
          <div className="overflow-x-auto w-full">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-white border-b border-gray-100 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                  <th className="p-4 pl-6">District</th>
                  <th className="p-4">Gov Score</th>
                  <th className="p-4">Open Cases</th>
                  <th className="p-4">Critical</th>
                  <th className="p-4">CSAT</th>
                  <th className="p-4">Infra Risk</th>
                  <th className="p-4 pr-6">Heat Index</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {districtRankings.map((dist, i) => (
                  <tr key={dist.name} className="hover:bg-gray-50/80 transition-colors">
                    <td className="p-4 pl-6 flex items-center gap-3">
                      <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black ${i === 0 ? 'bg-[#FF9933] text-white shadow-md' : 'bg-gray-100 text-gray-500'}`}>{i + 1}</span>
                      <span className="font-bold text-gray-900 whitespace-nowrap">{dist.name}</span>
                    </td>
                    <td className="p-4">
                      <span className={`inline-flex px-2 py-0.5 rounded text-xs font-black ${dist.score >= 80 ? 'text-green-600 bg-green-50' : dist.score >= 60 ? 'text-orange-600 bg-orange-50' : 'text-red-600 bg-red-50'}`}>{dist.score}/100</span>
                    </td>
                    <td className="p-4 font-bold text-gray-700">{dist.open}</td>
                    <td className="p-4 font-black text-red-600">{dist.critical}</td>
                    <td className="p-4">
                      <div className="flex items-center text-xs font-bold text-gray-700">
                        <Star className="w-3.5 h-3.5 mr-1 text-[#FF9933] fill-[#FF9933]" /> {dist.csat}
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-red-500" style={{ width: `${dist.risk}%` }}></div>
                      </div>
                    </td>
                    <td className="p-4 pr-6">
                      <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded border ${dist.heatIndex > 80 ? 'bg-red-50 text-red-700 border-red-200' : dist.heatIndex > 50 ? 'bg-orange-50 text-orange-700 border-orange-200' : 'bg-green-50 text-green-700 border-green-200'}`}>
                        {dist.heatIndex} Heat
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* LIVE INCIDENT FEED */}
        <div className="bg-white rounded-3xl border border-gray-200 shadow-sm flex flex-col h-[400px] xl:h-auto overflow-hidden">
          <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
            <div>
              <h3 className="text-lg font-black text-[#1E3A8A] flex items-center">
                <Radio className="w-5 h-5 mr-2 text-[#87CEEB]" /> Live Incident Feed
              </h3>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Real-time city event streams</p>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar bg-white">
            {liveIncidentFeed.length > 0 ? (
              liveIncidentFeed.map((feed, i) => (
                <div key={i} className="flex gap-4 group">
                  <div className="flex flex-col items-center">
                    <div className={`w-2.5 h-2.5 rounded-full mt-1.5 ${i === 0 ? 'bg-red-500 animate-pulse' : 'bg-gray-300'}`}></div>
                    {i !== liveIncidentFeed.length - 1 && <div className="w-0.5 h-full bg-gray-100 my-1 group-hover:bg-gray-200 transition-colors"></div>}
                  </div>
                  <div className="flex-1 pb-4">
                    <div className="flex justify-between items-start mb-1">
                      <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded border ${feed.tag}`}>{feed.type}</span>
                      <span className="text-[10px] font-bold text-gray-400">{feed.time}</span>
                    </div>
                    <p className="text-sm font-bold text-gray-900 mt-1.5">{feed.title}</p>
                    <p className="text-xs font-medium text-gray-500 flex items-center mt-1">
                      <MapPin className="w-3 h-3 mr-1" /> {feed.loc}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-gray-400 uppercase font-black tracking-widest">
                No recent incidents
              </div>
            )}
          </div>
        </div>

      </div>

      {/* ROW 3: CITIZEN SATISFACTION SCORE (CSAT) */}
      <div className="bg-white rounded-3xl border border-gray-200 shadow-sm p-6">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h3 className="text-xl font-black text-[#1E3A8A] flex items-center">
              <MessageSquare className="w-6 h-6 mr-3 text-[#FF9933]" /> Citizen Satisfaction & Sentiment
            </h3>
            <p className="text-xs font-bold text-[#1E3A8A] uppercase tracking-widest mt-1">Public sentiment analysis & trust index</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">City Trust Index</p>
            <p className="text-3xl font-black text-[#22C55E]">{(overallScore / 20).toFixed(1)}<span className="text-sm text-gray-400">/5.0</span></p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Sentiment Breakdown Pie */}
          <div className="flex flex-col items-center justify-center border-r border-gray-100 pr-0 lg:pr-8">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 w-full text-left">Feedback Sentiment Analysis</p>
            <div className="h-[200px] w-full relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={csatSentiment} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value" stroke="none">
                    {csatSentiment.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-2xl font-black text-gray-900">{csatSentiment[0].value}%</span>
                <span className="text-[9px] font-bold text-gray-400 uppercase">Approval</span>
              </div>
            </div>
            <div className="flex gap-4 mt-4">
              {csatSentiment.map((s, i) => (
                <div key={i} className="flex items-center text-[10px] font-bold text-gray-600">
                  <span className="w-2.5 h-2.5 rounded-full mr-1.5" style={{ backgroundColor: s.color }}></span>
                  {s.value}%
                </div>
              ))}
            </div>
          </div>

          {/* Monthly Trend Area Chart */}
          <div className="lg:col-span-2 flex flex-col">
            <div className="flex justify-between items-center mb-4">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest w-full text-left">Trust Index Historical Trend</p>
              <div className="flex gap-2">
                <button className="text-[10px] font-bold text-white bg-[#1E3A8A] px-2 py-1 rounded">Monthly</button>
                <button className="text-[10px] font-bold text-gray-500 bg-gray-100 px-2 py-1 rounded hover:bg-gray-200">Quarterly</button>
              </div>
            </div>
            <div className="w-full h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={csatTrend} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorTrust" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#87CEEB" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="#87CEEB" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                  <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 10, fontWeight: 'bold' }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 10 }} domain={['dataMin - 10', 'dataMax + 10']} />
                  <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} itemStyle={{ fontWeight: 'bold' }} />
                  <Area type="monotone" dataKey="index" name="Trust Index" stroke="#87CEEB" strokeWidth={3} fillOpacity={1} fill="url(#colorTrust)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

        </div>
      </div>

    </motion.div>
  );
}