import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  deleteDoc,
  query,
  orderBy,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Conversation, Project, UserPreferences } from '../types';
import {
  getSavedConversations,
  saveConversations,
  getSavedProjects,
  saveProjects,
  getSavedPreferences,
  savePreferences,
  DEFAULT_PREFERENCES,
} from './storage';
import {
  mergePersistedConversations,
  normalizePersistedConversation,
} from './conversationPersistence';

function normalizeConversation(conversation: Conversation): Conversation {
  return normalizePersistedConversation(conversation);
}

// 1. Fetch all conversations for a user
export async function fetchUserConversations(userId: string): Promise<Conversation[]> {
  try {
    const colRef = collection(db, 'users', userId, 'conversations');
    const q = query(colRef, orderBy('updatedAt', 'desc'));
    const snapshot = await getDocs(q);
    const localConvs = getSavedConversations().map(normalizeConversation);

    if (snapshot.empty) {
      for (const c of localConvs) {
        await syncConversationToCloud(userId, c);
      }
      return localConvs;
    }

    const cloudConvs: Conversation[] = [];
    snapshot.forEach((docSnap) => {
      cloudConvs.push(normalizeConversation(docSnap.data() as Conversation));
    });

    const merged = mergePersistedConversations(localConvs, cloudConvs);
    saveConversations(merged);

    // Push local-only and newer-local records so the merged state becomes the
    // source of truth for future devices. syncConversationToCloud performs an
    // additional remote timestamp check to protect against stale concurrent writes.
    const cloudById = new Map(cloudConvs.map((conversation) => [conversation.id, conversation]));
    for (const conversation of merged) {
      const cloud = cloudById.get(conversation.id);
      if (!cloud || conversation.updatedAt > cloud.updatedAt) {
        await syncConversationToCloud(userId, conversation);
      }
    }

    return merged;
  } catch (error) {
    console.warn('Error fetching conversations from Firestore, using local cache:', error);
    return getSavedConversations().map(normalizeConversation);
  }
}

// 2. Sync single conversation to Firestore without allowing stale local state
// to overwrite a newer cloud snapshot.
export async function syncConversationToCloud(userId: string, conversation: Conversation): Promise<void> {
  try {
    const normalized = normalizeConversation(conversation);
    const docRef = doc(db, 'users', userId, 'conversations', normalized.id);
    const remote = await getDoc(docRef);
    if (remote.exists()) {
      const remoteConversation = normalizeConversation(remote.data() as Conversation);
      if (remoteConversation.updatedAt >= normalized.updatedAt) return;
    }
    await setDoc(docRef, normalized, { merge: true });
  } catch (error) {
    console.warn('Failed to sync conversation to cloud:', error);
  }
}

// 3. Delete conversation from Firestore
export async function deleteConversationFromCloud(userId: string, conversationId: string): Promise<void> {
  try {
    const docRef = doc(db, 'users', userId, 'conversations', conversationId);
    await deleteDoc(docRef);
  } catch (error) {
    console.warn('Failed to delete conversation from Firestore:', error);
  }
}

// 4. Fetch all projects for a user
export async function fetchUserProjects(userId: string): Promise<Project[]> {
  try {
    const colRef = collection(db, 'users', userId, 'projects');
    const q = query(colRef, orderBy('updatedAt', 'desc'));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      const localProjects = getSavedProjects();
      for (const p of localProjects) {
        await syncProjectToCloud(userId, p);
      }
      return localProjects;
    }

    const cloudProjects: Project[] = [];
    snapshot.forEach((docSnap) => {
      cloudProjects.push(docSnap.data() as Project);
    });

    saveProjects(cloudProjects);
    return cloudProjects;
  } catch (error) {
    console.warn('Error fetching projects from Firestore:', error);
    return getSavedProjects();
  }
}

// 5. Sync single project to Firestore
export async function syncProjectToCloud(userId: string, project: Project): Promise<void> {
  try {
    const docRef = doc(db, 'users', userId, 'projects', project.id);
    await setDoc(docRef, project, { merge: true });
  } catch (error) {
    console.warn('Failed to sync project to cloud:', error);
  }
}

// 6. Delete project from Firestore
export async function deleteProjectFromCloud(userId: string, projectId: string): Promise<void> {
  try {
    const docRef = doc(db, 'users', userId, 'projects', projectId);
    await deleteDoc(docRef);
  } catch (error) {
    console.warn('Failed to delete project from Firestore:', error);
  }
}

// 7. Sync Preferences
export async function fetchUserPreferences(userId: string): Promise<UserPreferences> {
  try {
    const userDocRef = doc(db, 'users', userId);
    const snap = await getDoc(userDocRef);
    if (snap.exists() && snap.data().preferences) {
      const prefs = { ...DEFAULT_PREFERENCES, ...snap.data().preferences };
      savePreferences(prefs);
      return prefs;
    }
    return getSavedPreferences();
  } catch (error) {
    console.warn('Error fetching user preferences from cloud:', error);
    return getSavedPreferences();
  }
}

export async function syncPreferencesToCloud(userId: string, preferences: UserPreferences): Promise<void> {
  try {
    const userDocRef = doc(db, 'users', userId);
    await setDoc(userDocRef, { preferences, updatedAt: Date.now() }, { merge: true });
  } catch (error) {
    console.warn('Failed to sync preferences to cloud:', error);
  }
}
