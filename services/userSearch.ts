import {
  collection,
  query,
  getDocs,
  limit,
  QueryDocumentSnapshot,
  DocumentData,
} from 'firebase/firestore';
import { db } from '@/firebase';

export interface SearchUser {
  id: string;
  email: string;
  nickname?: string;
  avatar?: string;
}

const MAX_FETCH = 500;
const MAX_RESULTS = 20;

function docToUser(docSnap: QueryDocumentSnapshot<DocumentData>): SearchUser {
  return { id: docSnap.id, ...docSnap.data() } as SearchUser;
}

function matchesKeyword(user: SearchUser, lower: string): boolean {
  const nickname = (user.nickname ?? '').toLowerCase();
  const email = (user.email ?? '').toLowerCase();
  return nickname.includes(lower) || email.includes(lower);
}

function relevanceScore(user: SearchUser, lower: string): number {
  const nickname = (user.nickname ?? '').toLowerCase();
  const email = (user.email ?? '').toLowerCase();
  let score = 0;
  if (nickname === lower || email === lower) score += 100;
  else if (nickname.startsWith(lower) || email.startsWith(lower)) score += 50;
  else if (nickname.includes(lower) || email.includes(lower)) score += 10;
  return score;
}

export async function searchUsers(
  keyword: string,
  excludeUid?: string
): Promise<SearchUser[]> {
  const trimmed = keyword.trim();
  if (!trimmed) return [];

  const lower = trimmed.toLowerCase();
  const snapshot = await getDocs(
    query(collection(db, 'users'), limit(MAX_FETCH))
  );

  return snapshot.docs
    .map(docToUser)
    .filter((u) => u.id !== excludeUid)
    .filter((u) => matchesKeyword(u, lower))
    .sort((a, b) => relevanceScore(b, lower) - relevanceScore(a, lower))
    .slice(0, MAX_RESULTS);
}
