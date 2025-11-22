// src/AuthContext.jsx
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db } from './firebaseConfig';

// Avatar por defecto (silueta)
const DEFAULT_AVATAR = 'https://cdn-icons-png.flaticon.com/512/149/149071.png';

const AuthCtx = createContext({
  currentUser: null,
  loading: true,
  currentUserRole: 'Cliente',
  userDoc: null,
});

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [userDoc, setUserDoc] = useState(null);
  const [loading, setLoading] = useState(true);

  // 1) Suscripción a Firebase Auth
  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user || null);
      setLoading(false);
    });
    return () => unsubAuth();
  }, []);

  // 2) Suscripción al doc del usuario (rol, KYC, foto, etc.)
  useEffect(() => {
    if (!currentUser) {
      setUserDoc(null);
      return;
    }

    const ref = doc(db, 'usuarios', currentUser.uid);
    const unsubDoc = onSnapshot(
      ref,
      (snap) => {
        if (!snap.exists()) {
          setUserDoc(null);
          return;
        }
        const data = snap.data();

        // Foto: prioriza la foto base64 subida por el usuario si existe
        const finalPhotoURL =
          data?.customPhotoBase64 || currentUser.photoURL || DEFAULT_AVATAR;

        // Nombre visible
        const finalDisplayName =
          data?.displayName ||
          currentUser.displayName ||
          (currentUser.email ? currentUser.email.split('@')[0] : 'Usuario');

        setUserDoc({
          id: snap.id,
          ...data,
          photoURL: finalPhotoURL,
          displayName: finalDisplayName,
        });
      },
      () => setUserDoc(null)
    );

    return () => unsubDoc();
  }, [currentUser]);

  const value = useMemo(
    () => ({
      currentUser,
      loading,
      userDoc,
      currentUserRole: userDoc?.rol || 'Cliente',
    }),
    [currentUser, loading, userDoc]
  );

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useAuth() {
  return useContext(AuthCtx);
}
