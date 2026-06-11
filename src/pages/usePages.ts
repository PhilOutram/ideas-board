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
  where,
  type Timestamp,
} from 'firebase/firestore'
import { db } from '../firebase'

export type Page = {
  id: string
  title: string
  order: number
  parentId: string | null // null = top-level (a "book" root); enables nesting
  body: string // the section's main content (markdown); rendered/edited in Phase C
  context: string
  memory: string
  owner: string
  created: Timestamp | null
}

export type PagePatch = Partial<
  Pick<Page, 'title' | 'context' | 'memory' | 'order' | 'parentId' | 'body'>
>

type UsePagesResult = {
  pages: Page[]
  loading: boolean
  error: Error | null
  createPage: (title: string, parentId?: string | null, body?: string) => Promise<string>
  updatePage: (id: string, patch: PagePatch) => Promise<void>
  deletePage: (id: string) => Promise<void>
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
            parentId: (data.parentId as string | null | undefined) ?? null,
            body: (data.body as string | undefined) ?? '',
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

  async function createPage(
    title: string,
    parentId: string | null = null,
    body = '',
  ): Promise<string> {
    const trimmed = title.trim()
    if (!trimmed) throw new Error('Title cannot be empty.')
    const ref = await addDoc(collection(db, 'pages'), {
      title: trimmed,
      order: Date.now(),
      parentId,
      body,
      context: '',
      memory: '',
      owner: userId,
      created: serverTimestamp(),
    })
    return ref.id
  }

  async function updatePage(id: string, patch: PagePatch): Promise<void> {
    await updateDoc(doc(db, 'pages', id), patch)
  }

  async function deletePage(id: string): Promise<void> {
    await deleteDoc(doc(db, 'pages', id))
  }

  return { pages, loading, error, createPage, updatePage, deletePage }
}
