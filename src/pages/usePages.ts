import { useEffect, useState } from 'react'
import {
  addDoc,
  collection,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  where,
  type Timestamp,
} from 'firebase/firestore'
import { db } from '../firebase'

export type Page = {
  id: string
  title: string
  order: number
  context: string
  memory: string
  owner: string
  created: Timestamp | null
}

type UsePagesResult = {
  pages: Page[]
  loading: boolean
  error: Error | null
  createPage: (title: string) => Promise<string>
}

export function usePages(userId: string): UsePagesResult {
  const [pages, setPages] = useState<Page[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    const q = query(
      collection(db, 'pages'),
      where('owner', '==', userId),
      orderBy('order', 'asc'),
    )

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const next: Page[] = snapshot.docs.map((doc) => {
          const data = doc.data()
          return {
            id: doc.id,
            title: (data.title as string | undefined) ?? '',
            order: (data.order as number | undefined) ?? 0,
            context: (data.context as string | undefined) ?? '',
            memory: (data.memory as string | undefined) ?? '',
            owner: (data.owner as string | undefined) ?? '',
            created: (data.created as Timestamp | undefined) ?? null,
          }
        })
        setPages(next)
        setLoading(false)
      },
      (err) => {
        setError(err)
        setLoading(false)
      },
    )

    return unsubscribe
  }, [userId])

  async function createPage(title: string): Promise<string> {
    const trimmed = title.trim()
    if (!trimmed) throw new Error('Title cannot be empty.')
    const ref = await addDoc(collection(db, 'pages'), {
      title: trimmed,
      order: Date.now(),
      context: '',
      memory: '',
      owner: userId,
      created: serverTimestamp(),
    })
    return ref.id
  }

  return { pages, loading, error, createPage }
}
