import {
  collection,
  addDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
  doc,
  updateDoc,
  limit,
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../firebase';

/**
 * Subscribes to real-time stream posts/announcements for a specific class.
 * Returns an unsubscribe function.
 */
export function subscribeToClassStream(classId, onUpdate, onError) {
  if (!isFirebaseConfigured || !db || !classId) {
    return () => {};
  }

  try {
    const q = query(
      collection(db, `classes/${classId}/stream`),
      orderBy('createdAt', 'desc'),
      limit(50)
    );

    return onSnapshot(
      q,
      (snapshot) => {
        const posts = snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
          createdAt: d.data().createdAt?.toDate ? d.data().createdAt.toDate() : new Date(),
        }));
        onUpdate(posts);
      },
      (error) => {
        console.warn('Class stream snapshot listener error:', error);
        if (onError) onError(error);
      }
    );
  } catch (err) {
    console.warn('Error creating class stream listener:', err);
    return () => {};
  }
}

/**
 * Posts a new announcement or discussion message to the class stream in Firestore.
 */
export async function postClassAnnouncement(classId, { authorId, authorName, authorRole, content, type = 'announcement' }) {
  if (!isFirebaseConfigured || !db || !classId) {
    return null;
  }

  try {
    const ref = await addDoc(collection(db, `classes/${classId}/stream`), {
      authorId,
      authorName,
      authorRole,
      content,
      type,
      createdAt: serverTimestamp(),
      commentsCount: 0,
    });
    return ref.id;
  } catch (err) {
    console.warn('Error posting announcement to Firebase:', err);
    return null;
  }
}

/**
 * Subscribes to real-time comments on a specific post.
 */
export function subscribeToPostComments(classId, postId, onUpdate) {
  if (!isFirebaseConfigured || !db || !classId || !postId) {
    return () => {};
  }

  try {
    const q = query(
      collection(db, `classes/${classId}/stream/${postId}/comments`),
      orderBy('createdAt', 'asc')
    );

    return onSnapshot(q, (snapshot) => {
      const comments = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
        createdAt: d.data().createdAt?.toDate ? d.data().createdAt.toDate() : new Date(),
      }));
      onUpdate(comments);
    });
  } catch (err) {
    console.warn('Error creating comments listener:', err);
    return () => {};
  }
}

/**
 * Adds a comment to a stream post.
 */
export async function addPostComment(classId, postId, { authorId, authorName, content }) {
  if (!isFirebaseConfigured || !db || !classId || !postId) {
    return null;
  }

  try {
    const ref = await addDoc(collection(db, `classes/${classId}/stream/${postId}/comments`), {
      authorId,
      authorName,
      content,
      createdAt: serverTimestamp(),
    });
    return ref.id;
  } catch (err) {
    console.warn('Error adding comment to Firebase:', err);
    return null;
  }
}

/**
 * Subscribes to real-time notifications for a specific user (e.g. grade published, new lab).
 */
export function subscribeToUserNotifications(userId, onUpdate) {
  if (!isFirebaseConfigured || !db || !userId) {
    return () => {};
  }

  try {
    const q = query(
      collection(db, `users/${userId}/notifications`),
      orderBy('createdAt', 'desc'),
      limit(25)
    );

    return onSnapshot(q, (snapshot) => {
      const notifications = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
        createdAt: d.data().createdAt?.toDate ? d.data().createdAt.toDate() : new Date(),
      }));
      onUpdate(notifications);
    });
  } catch (err) {
    console.warn('Error creating user notifications listener:', err);
    return () => {};
  }
}
