import { useEffect, useState } from 'react'
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  type Timestamp,
} from 'firebase/firestore'
import { db } from '../firebase'

export type QuickIdea = {
  id: string
  text: string
  created: Timestamp | null
}

type UseQuickIdeasResult = {
  quickIdeas: QuickIdea[]
  loading: boolean
  error: Error | null
  addQuickIdea: (text: string) => Promise<void>
  updateQuickIdea: (id: string, text: string) => Promise<void>
  deleteQuickIdea: (id: string) => Promise<void>
}

export function useQuickIdeas(pageId: string | null): UseQuickIdeasResult {
  const [quickIdeas, setQuickIdeas] = useState<QuickIdea[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    if (!pageId) {
      setQuickIdeas([])
      setLoading(false)
      return
    }

    setLoading(true)
    const q = query(
      collection(db, 'pages', pageId, 'quickIdeas'),
      orderBy('created', 'desc'),
    )

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const next: QuickIdea[] = snapshot.docs.map((d) => {
          const data = d.data()
          return {
            id: d.id,
            text: (data.text as string | undefined) ?? '',
            created: (data.created as Timestamp | undefined) ?? null,
          }
        })
        setQuickIdeas(next)
        setLoading(false)
      },
      (err) => {
        setError(err)
        setLoading(false)
      },
    )

    return unsubscribe
  }, [pageId])

  async function addQuickIdea(text: string): Promise<void> {
    if (!pageId) throw new Error('No page selected.')
    const trimmed = text.trim()
    if (!trimmed) return
    await addDoc(collection(db, 'pages', pageId, 'quickIdeas'), {
      text: trimmed,
      created: serverTimestamp(),
    })
  }

  async function updateQuickIdea(id: string, text: string): Promise<void> {
    if (!pageId) throw new Error('No page selected.')
    const trimmed = text.trim()
    if (!trimmed) return
    await updateDoc(doc(db, 'pages', pageId, 'quickIdeas', id), { text: trimmed })
  }

  async function deleteQuickIdea(id: string): Promise<void> {
    if (!pageId) throw new Error('No page selected.')
    await deleteDoc(doc(db, 'pages', pageId, 'quickIdeas', id))
  }

  return { quickIdeas, loading, error, addQuickIdea, updateQuickIdea, deleteQuickIdea }
}
