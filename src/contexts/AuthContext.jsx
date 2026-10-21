import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { initializeApp } from 'firebase/app'
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  updateProfile,
  sendPasswordResetEmail,
  GoogleAuthProvider,
  signInWithPopup,
} from 'firebase/auth'
import { getFirestore, doc, setDoc, getDoc, onSnapshot } from 'firebase/firestore'

// Firebase configuration must come from the application's deployment environment.
// In particular, never substitute a demo project or a local credential store.
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

const firebaseConfigured = Boolean(
  firebaseConfig.apiKey && firebaseConfig.authDomain && firebaseConfig.projectId,
)

// Delete only the two obsolete auth keys. Never read their contents: one may
// contain plaintext credentials and the other is an untrusted identity object.
function clearLegacyAuthStorage() {
  try {
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem('bttsbet_users')
      window.localStorage.removeItem('bttsbet_user')
    }
  } catch (err) {
    // Storage can be unavailable (for example, in a restricted browser context).
    console.warn('Unable to clear legacy authentication storage:', err)
  }
}

// Initialize Firebase only when real deployment configuration is present.
let app
let auth
let db
let googleProvider

if (firebaseConfigured) {
  try {
    app = initializeApp(firebaseConfig)
    auth = getAuth(app)
    db = getFirestore(app)
    googleProvider = new GoogleAuthProvider()
  } catch (err) {
    console.warn('Firebase init failed:', err.message)
  }
}

// ─── Context ───
const AuthContext = createContext(null)

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [userProfile, setUserProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [isFirebaseReady, setIsFirebaseReady] = useState(false)

  useEffect(() => {
    clearLegacyAuthStorage()
    queueMicrotask(() => {
      const ready = Boolean(firebaseConfigured && auth)
      setIsFirebaseReady(ready)
      if (!ready) setLoading(false)
    })
  }, [])

  // Firebase is the sole source of authenticated identity.
  useEffect(() => {
    if (!isFirebaseReady || !auth) return

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const u = {
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          displayName: firebaseUser.displayName,
          photoURL: firebaseUser.photoURL,
          emailVerified: firebaseUser.emailVerified,
        }
        setUser(u)

        // Listen to the trusted profile keyed by the Firebase UID.
        if (db) {
          const userRef = doc(db, 'users', firebaseUser.uid)
          const unsubProfile = onSnapshot(userRef, (snap) => {
            if (snap.exists()) {
              setUserProfile(snap.data())
            } else {
              setUserProfile(null)
            }
          })
          return () => unsubProfile()
        }
      } else {
        setUser(null)
        setUserProfile(null)
      }
      setLoading(false)
    })

    return () => unsubscribe()
  }, [isFirebaseReady])

  const requireFirebaseAuth = useCallback(() => {
    if (!isFirebaseReady || !auth) {
      throw new Error('Authentification indisponible : Firebase doit être configuré. Aucun compte local ne sera utilisé.')
    }
  }, [isFirebaseReady])

  // ─── Auth methods (kept for existing consumers) ───

  const login = useCallback(async (email, password) => {
    requireFirebaseAuth()
    const cred = await signInWithEmailAndPassword(auth, email, password)
    return cred.user
  }, [requireFirebaseAuth])

  const register = useCallback(async (email, password, displayName) => {
    requireFirebaseAuth()
    if (!db) {
      throw new Error('Inscription indisponible : le profil Firebase ne peut pas être enregistré.')
    }

    const cred = await createUserWithEmailAndPassword(auth, email, password)
    await updateProfile(cred.user, { displayName })
    const profile = {
      displayName,
      email,
      createdAt: new Date().toISOString(),
      country: '',
      phone: '',
      linebetId: '',
      isVip: false,
      vipExpiry: null,
      favoriteLeagues: [],
      points: 0,
      predictionsViewed: 0,
      streak: 0,
    }
    await setDoc(doc(db, 'users', cred.user.uid), profile)
    return cred.user
  }, [requireFirebaseAuth])

  const logout = useCallback(async () => {
    clearLegacyAuthStorage()
    if (isFirebaseReady && auth) {
      await signOut(auth)
    }
    setUser(null)
    setUserProfile(null)
  }, [isFirebaseReady])

  const resetPassword = useCallback(async (email) => {
    requireFirebaseAuth()
    await sendPasswordResetEmail(auth, email)
  }, [requireFirebaseAuth])

  const loginWithGoogle = useCallback(async () => {
    requireFirebaseAuth()
    if (!db || !googleProvider) {
      throw new Error('Connexion Google indisponible : le profil Firebase ne peut pas être vérifié.')
    }

    const cred = await signInWithPopup(auth, googleProvider)
    const userRef = doc(db, 'users', cred.user.uid)
    const snap = await getDoc(userRef)
    if (!snap.exists()) {
      const profile = {
        displayName: cred.user.displayName || '',
        email: cred.user.email,
        createdAt: new Date().toISOString(),
        country: '',
        phone: '',
        linebetId: '',
        isVip: false,
        vipExpiry: null,
        favoriteLeagues: [],
        points: 0,
        predictionsViewed: 0,
        streak: 0,
      }
      await setDoc(userRef, profile)
    }
    return cred.user
  }, [requireFirebaseAuth])

  const updateUserData = useCallback(async (data) => {
    requireFirebaseAuth()
    if (!user) {
      throw new Error('Connectez-vous avant de modifier votre profil.')
    }
    if (!db) {
      throw new Error('Modification indisponible : le profil Firebase ne peut pas être enregistré.')
    }
    await setDoc(doc(db, 'users', user.uid), data, { merge: true })
  }, [requireFirebaseAuth, user])

  const value = {
    user,
    userProfile,
    loading,
    isFirebaseReady,
    login,
    register,
    logout,
    resetPassword,
    loginWithGoogle,
    updateUserData,
    // Computed
    isLoggedIn: !!user,
    isVip: userProfile?.isVip === true,
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}
