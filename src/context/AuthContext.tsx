/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
} from 'react';

import {
  User,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  updateProfile,
  onAuthStateChanged,
} from 'firebase/auth';

import {
  doc,
  setDoc,
} from 'firebase/firestore';

import {
  auth,
  googleProvider,
  appleProvider,
  db,
} from '../lib/firebase';

export interface AppUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  isAnonymous?: boolean;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isAnonymous: boolean;
  signInWithGoogle: () => Promise<void>;
  signInWithApple: () => Promise<void>;
  signInWithEmail: (email: string, pass: string) => Promise<void>;
  signUpWithEmail: (
    email: string,
    pass: string,
    name: string
  ) => Promise<void>;
  signInAsGuest: () => Promise<void>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  updateDisplayName: (name: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(
  undefined
);

/**
 * Create/update the user's Firestore profile.
 *
 * IMPORTANT:
 * This function is only called with a real Firebase Auth user.
 * Therefore Firestore request.auth.uid will match user.uid.
 */
async function syncUserProfile(firebaseUser: User): Promise<void> {
  const userDocRef = doc(db, 'users', firebaseUser.uid);

  const userSnap = await import('firebase/firestore').then(
    ({ getDoc }) => getDoc(userDocRef)
  );

  if (!userSnap.exists()) {
    await setDoc(userDocRef, {
      id: firebaseUser.uid,
      email: firebaseUser.email || '',
      displayName:
        firebaseUser.displayName ||
        (firebaseUser.isAnonymous ? 'Guest User' : 'User'),
      photoURL: firebaseUser.photoURL || '',
      isAnonymous: firebaseUser.isAnonymous,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      lastLoginAt: Date.now(),
    });
  } else {
    await setDoc(
      userDocRef,
      {
        email: firebaseUser.email || '',
        displayName:
          firebaseUser.displayName ||
          (firebaseUser.isAnonymous ? 'Guest User' : 'User'),
        photoURL: firebaseUser.photoURL || '',
        isAnonymous: firebaseUser.isAnonymous,
        updatedAt: Date.now(),
        lastLoginAt: Date.now(),
      },
      { merge: true }
    );
  }
}

export const AuthProvider: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  /**
   * Firebase Auth is the ONLY source of truth for authentication.
   *
   * We intentionally do NOT restore a fake user from localStorage.
   * Firestore Security Rules depend on request.auth, which only exists
   * for a real Firebase Authentication session.
   */
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(
      auth,
      async (currentUser) => {
        try {
          if (currentUser) {
            setUser(currentUser);

            // Keep the user's Firestore profile synchronized.
            try {
              await syncUserProfile(currentUser);
            } catch (firestoreError) {
              console.warn(
                'Could not sync user profile to Firestore:',
                firestoreError
              );
            }
          } else {
            setUser(null);
          }
        } finally {
          setLoading(false);
        }
      }
    );

    return () => unsubscribe();
  }, []);

  /**
   * Google Sign-In
   */
  const signInWithGoogle = async (): Promise<void> => {
    try {
      const result = await signInWithPopup(
        auth,
        googleProvider
      );

      if (result.user) {
        setUser(result.user);

        try {
          await syncUserProfile(result.user);
        } catch (firestoreError) {
          console.warn(
            'Firestore Google profile sync error:',
            firestoreError
          );
        }
      }
    } catch (error: any) {
      if (
        error?.code === 'auth/popup-closed-by-user' ||
        error?.code === 'auth/cancelled-popup-request'
      ) {
        return;
      }

      console.warn(
        'Google Sign-in error:',
        error?.message || error
      );

      throw error;
    }
  };

  /**
   * Apple Sign-In
   *
   * No fake/local Apple account is created if Apple authentication
   * is not configured. Firebase must authenticate the user.
   */
  const signInWithApple = async (): Promise<void> => {
    try {
      const result = await signInWithPopup(
        auth,
        appleProvider
      );

      if (result.user) {
        setUser(result.user);

        try {
          await syncUserProfile(result.user);
        } catch (firestoreError) {
          console.warn(
            'Firestore Apple profile sync error:',
            firestoreError
          );
        }
      }
    } catch (error: any) {
      if (
        error?.code === 'auth/popup-closed-by-user' ||
        error?.code === 'auth/cancelled-popup-request'
      ) {
        return;
      }

      console.warn(
        'Apple Sign-in error:',
        error?.message || error
      );

      throw error;
    }
  };

  /**
   * Email / Password Sign-In
   *
   * No fake user is created when Email/Password is disabled.
   * Firebase must provide a real authenticated user.
   */
  const signInWithEmail = async (
    email: string,
    pass: string
  ): Promise<void> => {
    const result = await signInWithEmailAndPassword(
      auth,
      email,
      pass
    );

    if (result.user) {
      setUser(result.user);

      try {
        await syncUserProfile(result.user);
      } catch (firestoreError) {
        console.warn(
          'Firestore email profile sync error:',
          firestoreError
        );
      }
    }
  };

  /**
   * Email / Password Sign-Up
   */
  const signUpWithEmail = async (
    email: string,
    pass: string,
    name: string
  ): Promise<void> => {
    const result = await createUserWithEmailAndPassword(
      auth,
      email,
      pass
    );

    if (!result.user) {
      throw new Error(
        'Firebase account creation did not return a user.'
      );
    }

    try {
      await updateProfile(result.user, {
        displayName: name,
      });
    } catch (profileError) {
      console.warn(
        'Firebase profile update warning:',
        profileError
      );
    }

    // Refresh the local Firebase User reference after updateProfile.
    setUser(auth.currentUser || result.user);

    try {
      await syncUserProfile(
        auth.currentUser || result.user
      );
    } catch (firestoreError) {
      console.warn(
        'Firestore signup profile sync error:',
        firestoreError
      );
    }
  };

  /**
   * Guest mode is intentionally disabled.
   *
   * If you later want anonymous Firebase authentication,
   * implement it with Firebase signInAnonymously(auth).
   */
  const signInAsGuest = async (): Promise<void> => {
    throw new Error(
      'Guest mode is restricted. Please sign in with Google, Apple, or Email.'
    );
  };

  /**
   * Sign out
   */
  const logout = async (): Promise<void> => {
    try {
      await signOut(auth);
      setUser(null);
    } catch (error: any) {
      console.warn(
        'Sign-out error:',
        error?.message || error
      );
      throw error;
    }
  };

  /**
   * Password reset
   */
  const resetPassword = async (
    email: string
  ): Promise<void> => {
    await sendPasswordResetEmail(auth, email);
  };

  /**
   * Update display name
   */
  const updateDisplayName = async (
    name: string
  ): Promise<void> => {
    const currentUser = auth.currentUser;

    if (!currentUser) {
      throw new Error(
        'You must be signed in to update your display name.'
      );
    }

    try {
      await updateProfile(currentUser, {
        displayName: name,
      });

      // Firebase's User object may need to be refreshed in React state.
      setUser(auth.currentUser);
    } catch (profileError) {
      console.warn(
        'Profile update warning:',
        profileError
      );
      throw profileError;
    }

    try {
      const userDocRef = doc(
        db,
        'users',
        currentUser.uid
      );

      await setDoc(
        userDocRef,
        {
          displayName: name,
          updatedAt: Date.now(),
        },
        { merge: true }
      );
    } catch (firestoreError) {
      console.warn(
        'Firestore display name sync error:',
        firestoreError
      );

      throw firestoreError;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isAnonymous: !!user?.isAnonymous,
        signInWithGoogle,
        signInWithApple,
        signInWithEmail,
        signUpWithEmail,
        signInAsGuest,
        logout,
        resetPassword,
        updateDisplayName,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error(
      'useAuth must be used within an AuthProvider'
    );
  }

  return context;
};
