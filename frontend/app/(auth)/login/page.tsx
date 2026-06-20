"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { motion } from 'framer-motion';
import { Mail, Lock, ArrowRight, ShieldCheck, AlertCircle } from 'lucide-react';
import { loginSchema, LoginFormValues } from '@/lib/validations/auth';
import { useAuth } from '@/context/AuthContext';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

// Demo Credentials for quick access during presentation
const DEMO_ACCOUNTS = [
  { role: 'Citizen', email: 'citizen@demo.com' },
  { role: 'Officer', email: 'officer@demo.com' },
  { role: 'Dept Head', email: 'dept@demo.com' },
  { role: 'CM Office', email: 'cm@demo.com' },
  { role: 'District Mgr', email: 'district@demo.com' },
  { role: 'State Admin', email: 'stateadmin@demo.com' },
  { role: 'Super Admin', email: 'superadmin@demo.com' },
];

export default function LoginPage() {
  const router = useRouter();
  const { signIn } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const { register, handleSubmit, setValue, formState: { errors } } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginFormValues) => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const user = await signIn(data.email, data.password);
      
      let role = 'Citizen';
      try {
        const userDocRef = doc(db, "users", user.uid);
        const userDoc = await getDoc(userDocRef);
        if (userDoc.exists()) {
          role = userDoc.data().role || 'Citizen';
        }
      } catch (dbErr) {
        console.error("Error reading role from Firestore, using email fallbacks:", dbErr);
        if (data.email === 'officer@demo.com') {
          role = 'Officer';
        } else if (data.email === 'dept@demo.com') {
          role = 'Dept Head';
        } else if (data.email === 'cm@demo.com') {
          role = 'CM Office';
        } else if (data.email === 'district@demo.com') {
          role = 'District Manager';
        } else if (data.email === 'stateadmin@demo.com') {
          role = 'State Administrator';
        } else if (data.email === 'superadmin@demo.com') {
          role = 'Super Admin';
        }
      }
      
      if (role === 'Citizen') {
        router.push('/citizen');
      } else if (role === 'Officer') {
        router.push('/officer');
      } else if (role === 'Dept Head' || role === 'Department Head') {
        router.push('/department');
      } else if (role === 'CM Office' || role === 'Chief Minister') {
        router.push('/cm');
      } else if (role === 'District Manager') {
        router.push('/district');
      } else if (role === 'State Administrator') {
        router.push('/state-admin');
      } else if (role === 'Super Admin') {
        router.push('/super-admin');
      } else {
        router.push('/citizen');
      }
    } catch (err: any) {
      console.error("Login error:", err);
      if (err.code === "auth/invalid-credential" || err.code === "auth/user-not-found" || err.code === "auth/wrong-password") {
        setErrorMsg("Invalid email or password.");
      } else {
        setErrorMsg(err.message || "Failed to sign in. Please try again.");
      }
      setIsLoading(false);
    }
  };

  const loadDemoUser = (email: string) => {
    setValue('email', email);
    setValue('password', 'password123');
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="bg-white/80 backdrop-blur-xl shadow-2xl rounded-3xl p-8 border border-white/50"
    >
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-[#1E3A8A]/10 mb-4">
          <ShieldCheck className="w-6 h-6 text-[#1E3A8A]" />
        </div>
        <h1 className="text-2xl font-bold text-[#1E3A8A]">Apka Sikayat</h1>
        <p className="text-sm text-gray-500 mt-2">Welcome back. Please login to your account.</p>
      </div>

      {errorMsg && (
        <div className="mb-6 p-4 bg-[#EF4444]/10 border border-[#EF4444]/20 text-[#EF4444] text-sm rounded-xl flex items-center gap-2">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Mail className="h-5 w-5 text-gray-400" />
            </div>
            <input
              {...register('email')}
              type="email"
              className="block w-full pl-10 pr-3 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#FF9933]/50 focus:border-[#FF9933] transition-colors bg-white/50"
              placeholder="name@example.com"
            />
          </div>
          {errors.email && <p className="mt-1 text-sm text-[#EF4444]">{errors.email.message}</p>}
        </div>

        <div>
          <div className="flex justify-between items-center mb-1">
            <label className="block text-sm font-medium text-gray-700">Password</label>
            <Link href="/forgot-password" className="text-xs font-medium text-[#87CEEB] hover:text-[#1E3A8A] transition-colors">
              Forgot password?
            </Link>
          </div>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Lock className="h-5 w-5 text-gray-400" />
            </div>
            <input
              {...register('password')}
              type="password"
              className="block w-full pl-10 pr-3 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#FF9933]/50 focus:border-[#FF9933] transition-colors bg-white/50"
              placeholder="••••••••"
            />
          </div>
          {errors.password && <p className="mt-1 text-sm text-[#EF4444]">{errors.password.message}</p>}
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-xl shadow-sm text-sm font-medium text-white bg-linear-to-r from-[#FF9933] to-[#FFC266] hover:from-[#FF9933] hover:to-[#FF9933] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#FF9933] transition-all disabled:opacity-70"
        >
          {isLoading ? "Authenticating..." : "Sign In"}
          {!isLoading && <ArrowRight className="ml-2 w-4 h-4" />}
        </button>
      </form>

      {/* Demo Credentials Section */}
      <div className="mt-8 pt-6 border-t border-gray-100">
        <p className="text-xs text-center text-gray-500 mb-3 font-medium uppercase tracking-wider">Demo Access</p>
        <div className="flex flex-wrap gap-2 justify-center">
          {DEMO_ACCOUNTS.map((demo) => (
            <button
              key={demo.role}
              onClick={() => loadDemoUser(demo.email)}
              type="button"
              className="text-xs px-3 py-1.5 rounded-full border border-[#87CEEB]/30 bg-[#87CEEB]/10 text-[#1E3A8A] hover:bg-[#87CEEB]/20 transition-colors"
            >
              {demo.role}
            </button>
          ))}
        </div>
      </div>

      <p className="mt-8 text-center text-sm text-gray-600">
        Are you a citizen?{' '}
        <Link href="/register" className="font-semibold text-[#FF9933] hover:text-[#1E3A8A] transition-colors">
          Register here
        </Link>
      </p>
    </motion.div>
  );
}