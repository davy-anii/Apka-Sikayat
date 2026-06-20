"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut as firebaseSignOut, 
  onAuthStateChanged, 
  User 
} from "firebase/auth";
import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

export interface UserProfile {
  uid: string;
  fullName: string;
  email: string;
  phone: string;
  district: string;
  address: string;
  role: string; // 'Citizen' | 'Officer' | 'Dept Head' | 'CM Office'
  joinedDate: string;
}

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<User>;
  signUp: (email: string, password: string, fullName: string, phone: string) => Promise<User>;
  signOut: () => Promise<void>;
  updateProfile: (data: Partial<Omit<UserProfile, 'uid' | 'email' | 'role'>>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Helper to seed a demo account user profile in Firestore
const getDemoProfileData = (email: string, uid: string): UserProfile => {
  const defaultJoined = new Date().toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
  
  if (email === "citizen@demo.com") {
    return {
      uid,
      fullName: "Rahul Sharma",
      email,
      phone: "+91 9876543210",
      district: "South West Delhi",
      address: "Block C, Vasant Kunj",
      role: "Citizen",
      joinedDate: defaultJoined
    };
  } else if (email === "officer@demo.com") {
    return {
      uid,
      fullName: "Officer Amit Kumar",
      email,
      phone: "+91 9876543211",
      district: "South West Delhi",
      address: "District Headquarters, Sector 4",
      role: "Officer",
      joinedDate: defaultJoined
    };
  } else if (email === "dept@demo.com") {
    return {
      uid,
      fullName: "Dept Head Rajesh Khanna",
      email,
      phone: "+91 9876543212",
      district: "New Delhi",
      address: "Delhi Jal Board HQ",
      role: "Dept Head",
      joinedDate: defaultJoined
    };
  } else if (email === "cm@demo.com") {
    return {
      uid,
      fullName: "CM Office Admin",
      email,
      phone: "+91 9876543213",
      district: "New Delhi",
      address: "CM Secretariat",
      role: "CM Office",
      joinedDate: defaultJoined
    };
  } else if (email === "district@demo.com") {
    return {
      uid,
      fullName: "District Manager Verma",
      email,
      phone: "+91 9876543214",
      district: "South West Delhi",
      address: "South West District Collectorate",
      role: "District Manager",
      joinedDate: defaultJoined
    };
  } else if (email === "stateadmin@demo.com") {
    return {
      uid,
      fullName: "State Admin Saxena",
      email,
      phone: "+91 9876543215",
      district: "Delhi NCR",
      address: "Delhi Secretariat",
      role: "State Administrator",
      joinedDate: defaultJoined
    };
  } else if (email === "superadmin@demo.com") {
    return {
      uid,
      fullName: "Super Admin Administrator",
      email,
      phone: "+91 9876543216",
      district: "Delhi NCR",
      address: "Central Data Command",
      role: "Super Admin",
      joinedDate: defaultJoined
    };
  }
  
  // Fallback default citizen
  return {
    uid,
    fullName: email.split('@')[0],
    email,
    phone: "",
    district: "",
    address: "",
    role: "Citizen",
    joinedDate: defaultJoined
  };
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        try {
          const userDocRef = doc(db, "users", currentUser.uid);
          const userDoc = await getDoc(userDocRef);
          if (userDoc.exists()) {
            setProfile(userDoc.data() as UserProfile);
          } else {
            // If user doc doesn't exist but user is authenticated, create a default profile
            const newProfile = getDemoProfileData(currentUser.email || "", currentUser.uid);
            await setDoc(userDocRef, newProfile);
            setProfile(newProfile);
          }
        } catch (error) {
          console.error("Error fetching user profile from Firestore:", error);
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signIn = async (email: string, password: string): Promise<User> => {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      return userCredential.user;
    } catch (error: any) {
      // Check if it is a demo account. If so, automatically register the demo user in Firebase Auth.
      const isDemo = [
        "citizen@demo.com", 
        "officer@demo.com", 
        "dept@demo.com", 
        "cm@demo.com",
        "district@demo.com",
        "stateadmin@demo.com",
        "superadmin@demo.com"
      ].includes(email);
      if (isDemo && (error.code === "auth/user-not-found" || error.code === "auth/invalid-credential" || error.code === "auth/invalid-email")) {
        console.log(`Demo account ${email} not found. Automatically provisioning account...`);
        // Use password123 as a default password for demo accounts
        const userCredential = await createUserWithEmailAndPassword(auth, email, password || "password123");
        const newUser = userCredential.user;
        
        // Seed Firestore profile
        const newProfile = getDemoProfileData(email, newUser.uid);
        await setDoc(doc(db, "users", newUser.uid), newProfile);
        setProfile(newProfile);
        
        return newUser;
      }
      throw error;
    }
  };

  const signUp = async (email: string, password: string, fullName: string, phone: string): Promise<User> => {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const newUser = userCredential.user;
    
    // Seed standard profile
    const newProfile: UserProfile = {
      uid: newUser.uid,
      fullName,
      email,
      phone,
      district: "",
      address: "",
      role: "Citizen",
      joinedDate: new Date().toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
    };
    
    try {
      await setDoc(doc(db, "users", newUser.uid), newProfile);
    } catch (dbErr) {
      console.error("Failed to save profile in Firestore database:", dbErr);
    }
    
    setProfile(newProfile);
    return newUser;
  };

  const signOut = async () => {
    await firebaseSignOut(auth);
    setUser(null);
    setProfile(null);
  };

  const updateProfile = async (data: Partial<Omit<UserProfile, 'uid' | 'email' | 'role'>>) => {
    if (!user) throw new Error("No authenticated user");
    
    const userDocRef = doc(db, "users", user.uid);
    await updateDoc(userDocRef, data);
    
    setProfile((prev) => prev ? { ...prev, ...data } : null);
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, signIn, signUp, signOut, updateProfile }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
