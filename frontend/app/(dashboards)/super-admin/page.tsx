"use client";

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Building2, Users, AlertTriangle, ShieldCheck, Server, 
  Activity, Settings, Database, RefreshCw, Key, ShieldAlert
} from 'lucide-react';

const ADMIN_USERS = [
  { name: 'Rahul Sharma', email: 'citizen@demo.com', role: 'Citizen' },
  { name: 'Officer Amit Kumar', email: 'officer@demo.com', role: 'Officer' },
  { name: 'Dept Head Rajesh Khanna', email: 'dept@demo.com', role: 'Dept Head' },
  { name: 'CM Office Admin', email: 'cm@demo.com', role: 'CM Office' },
  { name: 'District Manager Verma', email: 'district@demo.com', role: 'District Manager' },
  { name: 'State Admin Saxena', email: 'stateadmin@demo.com', role: 'State Administrator' },
];

export default function SuperAdminDashboard() {
  const [diagnostics, setDiagnostics] = useState({
    server: 'Loading...',
    database: 'Loading...',
    redis: 'Loading...',
    timestamp: 'N/A'
  });
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchDiagnostics = async () => {
    setIsRefreshing(true);
    try {
      // Try to fetch local dev health status
      const res = await fetch('http://localhost:5002/health');
      if (res.ok) {
        const data = await res.json();
        setDiagnostics({
          server: 'Operational',
          database: data.database === 'connected' ? 'Connected' : 'Disconnected',
          redis: data.redis === 'connected' ? 'Connected' : 'Disconnected',
          timestamp: data.timestamp
        });
      } else {
        throw new Error();
      }
    } catch {
      // Simulation mode defaults
      setDiagnostics({
        server: 'Operational (Simulation Mode)',
        database: 'Connected (Firestore Fallback)',
        redis: 'Disconnected (In-Memory Fallback)',
        timestamp: new Date().toISOString()
      });
    }
    setIsRefreshing(false);
  };

  useEffect(() => {
    fetchDiagnostics();
  }, []);

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 pb-4 border-b border-gray-200">
        <div>
          <h2 className="text-3xl font-black text-[#1E3A8A] tracking-tight">Super Admin Platform Console</h2>
          <p className="text-sm font-bold text-[#FF9933] uppercase tracking-widest mt-1">Global System Diagnostics & User Controls</p>
        </div>
        <button 
          onClick={fetchDiagnostics}
          disabled={isRefreshing}
          className="flex items-center bg-white border border-gray-200 hover:bg-gray-50 transition-colors shadow-sm px-4 py-2 rounded-xl text-xs font-black text-gray-700 tracking-wider uppercase disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
          Refresh Stats
        </button>
      </div>

      {/* DIAGNOSTIC TELEMETRY */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-xs flex items-center space-x-4">
          <div className="w-12 h-12 rounded-2xl bg-green-50 flex items-center justify-center text-green-600">
            <Server className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Web Server</p>
            <p className="text-lg font-black text-gray-900 mt-1">{diagnostics.server}</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-xs flex items-center space-x-4">
          <div className="w-12 h-12 rounded-2xl bg-[#87CEEB]/10 flex items-center justify-center text-[#1E3A8A]">
            <Database className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Database Sync</p>
            <p className="text-lg font-black text-gray-900 mt-1">{diagnostics.database}</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-xs flex items-center space-x-4">
          <div className="w-12 h-12 rounded-2xl bg-[#FF9933]/10 flex items-center justify-center text-[#FF9933]">
            <Activity className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Redis Queues</p>
            <p className="text-lg font-black text-gray-900 mt-1">{diagnostics.redis}</p>
          </div>
        </div>
      </div>

      {/* USER MANAGEMENT CONSOLE */}
      <div className="bg-white rounded-3xl border border-gray-200 p-6 flex flex-col">
        <div className="mb-6 flex justify-between items-center">
          <div>
            <h3 className="text-lg font-black text-[#1E3A8A] flex items-center">
              <Users className="w-5 h-5 mr-2 text-[#FF9933]" /> User Access Controls
            </h3>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Review and manage platform roles & credentials</p>
          </div>
        </div>

        <div className="overflow-x-auto w-full">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-gray-100 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                <th className="pb-3">User Name</th>
                <th className="pb-3">Email Address</th>
                <th className="pb-3">Active Role</th>
                <th className="pb-3 pr-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {ADMIN_USERS.map((usr, i) => (
                <tr key={i} className="hover:bg-gray-50/50 transition-colors">
                  <td className="py-3 font-bold text-gray-900">{usr.name}</td>
                  <td className="py-3 text-xs text-gray-500 font-medium">{usr.email}</td>
                  <td className="py-3">
                    <span className="inline-flex px-2.5 py-0.5 rounded text-[10px] font-black uppercase tracking-widest bg-gray-100 text-gray-700">
                      {usr.role}
                    </span>
                  </td>
                  <td className="py-3 text-right">
                    <button className="text-[10px] font-black text-[#1E3A8A] bg-[#87CEEB]/10 px-3 py-1.5 rounded-lg hover:bg-[#87CEEB]/20 transition-colors uppercase">
                      Edit Permissions
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </motion.div>
  );
}
