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
import { DEFAULT_MOONEX_MODEL_ID, normalizeMoonexModelId } from '../../lib/moonex-models';
import {
  getSavedConversations,
  saveConversations,
  getSavedProjects,
  saveProjects,
    getSavedPreferences,
    savePreferences,
    INITIAL_CONVERSATION,
  INITIAL_PROJECT,
  DEFAULT_PREFERENCES,
} from './storage';

const MOONEX_DEFAULT_MODEL = DEFAULT_MOONEX_MODEL_ID;

function normalizeConversation(conversation: Conversation): Conversation {
  const model = normalizeMoonexModelId(conversation.model, MOONEX_DEFAULT_MODEL);

  return {
    ...conversation,
    model,
    messages: Array.isArray(conversation.messages)
      ? conversation.messages.map((message) => ({
          ...message,
          // Legacy/provider IDs must never become the active UI model identity.
          modelUsed:
            message.role === 'assistant'
              ? normalizeMoonexModelId(message.modelUsed, model)
              : message.modelUsed,
        }))
      : [],
  };
}

// 1. Fetch all conversations for a user
export async function fetchUserConversations(userId: string): Promise<Conversation[]> {
  try {
    const colRef = collection(db, 'users', userId, 'conversations');
    const q = query(colRef, orderBy('updatedAt', 'desc'));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      const localConvs = getSavedConversations().map(normalizeConversation);
      for (const c of localConvs) {
        await syncConversationToCloud(userId, c);
      }
      return localConvs;
    }

    const cloudConvs: Conversation[] = [];
    snapshot.forEach((docSnap) => {
      cloudConvs.push(normalizeConversation(docSnap.data() as Conversation));
    });

    saveConversations(cloudConvs);

    // Persist the normalized model IDs so old cloud data does not return on the next login.
    for (const conversation of cloudConvs) {
      await syncConversationToCloud(userId, conversation);
    }

    return cloudConvs;
  } catch (error) {
    console.warn('Error fetching conversations from Firestore, using local cache:', error);
    return getSavedConversations().map(normalizeConversation);
  }
}

// 2. Sync single conversation to Firestore
export async function syncConversationToCloud(userId: string, conversation: Conversation): Promise<void> {
  try {
    const docRef = doc(db, 'users', userId, 'conversations', conversation.id);
    await setDoc(docRef, normalizeConversation(conversation), { merge: true });
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
    console.warn('Failed to delete conversation from cloud:', error);
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
