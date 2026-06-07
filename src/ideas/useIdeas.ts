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

export type Temperature = 'hot' | 'warm' | 'cold'

// The four default boards are always present; custom boards (step 6) live
// alongside them under arbitrary string keys, hence the index signature.
export type IdeaBoards = {
  messy: string
  tidy: string
  context: string
  memory: string
  [key: string]: string
}

export type Idea = {
  id: string
  title: string
  temperature: Temperature
  boards: IdeaBoards
  created: Timestamp | null
  lastEdited: Timestamp | null
}

export type IdeaPatch = Partial<Pick<Idea, 'title' | 'temperature' | 'boards'>>

// What a freshly promoted idea is seeded with. Title is required; messy is
// pre-filled from the quick idea so nothing the user typed is lost.
export type NewIdeaInput = {
  title: string
  messy?: string
  temperature?: Temperature
}

type UseIdeasResult = {
  ideas: Idea[]
  loading: boolean
  error: Error | null
  createIdea: (input: NewIdeaInput) => Promise<string>
  updateIdea: (id: string, patch: IdeaPatch) => Promise<void>
  updateBoard: (id: string, key: string, value: string) => Promise<void>
  addBoard: (id: string, key: string) => Promise<void>
  setTemperature: (id: string, temperature: Temperature) => Promise<void>
  deleteIdea: (id: string) => Promise<void>
}

// Firestore field-path segments can't contain dots, so board keys are
// sanitised to a safe slug before they ever reach `boards.<key>`. The
// human-facing name is reconstructed for display in the modal.
export function boardKeyFromName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

export function useIdeas(pageId: string | null): UseIdeasResult {
  const [ideas, setIdeas] = useState<Idea[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    if (!pageId) {
      setIdeas([])
      setLoading(false)
      return
    }

    setLoading(true)
    // Single-field order only, so no composite index is needed. The
    // temperature sort that actually drives the layout happens client-side
    // in IdeasList, where it can group cold ideas into their own section.
    const q = query(
      collection(db, 'pages', pageId, 'ideas'),
      orderBy('lastEdited', 'desc'),
    )

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const next: Idea[] = snapshot.docs.map((d) => {
          const data = d.data()
          const boards = (data.boards as Partial<IdeaBoards> | undefined) ?? {}
          return {
            id: d.id,
            title: (data.title as string | undefined) ?? '',
            temperature: (data.temperature as Temperature | undefined) ?? 'warm',
            boards: {
              messy: boards.messy ?? '',
              tidy: boards.tidy ?? '',
              context: boards.context ?? '',
              memory: boards.memory ?? '',
              ...boards,
            },
            created: (data.created as Timestamp | undefined) ?? null,
            lastEdited: (data.lastEdited as Timestamp | undefined) ?? null,
          }
        })
        setIdeas(next)
        setLoading(false)
      },
      (err) => {
        setError(err)
        setLoading(false)
      },
    )

    return unsubscribe
  }, [pageId])

  async function createIdea(input: NewIdeaInput): Promise<string> {
    if (!pageId) throw new Error('No page selected.')
    const title = input.title.trim()
    if (!title) throw new Error('Idea needs a title.')
    const ref = await addDoc(collection(db, 'pages', pageId, 'ideas'), {
      title,
      temperature: input.temperature ?? 'warm',
      boards: {
        messy: input.messy?.trim() ?? '',
        tidy: '',
        context: '',
        memory: '',
      },
      created: serverTimestamp(),
      lastEdited: serverTimestamp(),
    })
    return ref.id
  }

  async function updateIdea(id: string, patch: IdeaPatch): Promise<void> {
    if (!pageId) throw new Error('No page selected.')
    await updateDoc(doc(db, 'pages', pageId, 'ideas', id), {
      ...patch,
      lastEdited: serverTimestamp(),
    })
  }

  // Save a single board via a dotted field path so concurrent edits to
  // sibling boards don't clobber each other (a whole-`boards` write would).
  async function updateBoard(id: string, key: string, value: string): Promise<void> {
    if (!pageId) throw new Error('No page selected.')
    await updateDoc(doc(db, 'pages', pageId, 'ideas', id), {
      [`boards.${key}`]: value,
      lastEdited: serverTimestamp(),
    })
  }

  // Add an empty custom board. Caller is responsible for rejecting blank or
  // already-present keys before calling so we never silently wipe a board.
  async function addBoard(id: string, key: string): Promise<void> {
    if (!key) throw new Error('Board needs a name.')
    await updateBoard(id, key, '')
  }

  async function setTemperature(id: string, temperature: Temperature): Promise<void> {
    await updateIdea(id, { temperature })
  }

  async function deleteIdea(id: string): Promise<void> {
    if (!pageId) throw new Error('No page selected.')
    await deleteDoc(doc(db, 'pages', pageId, 'ideas', id))
  }

  return {
    ideas,
    loading,
    error,
    createIdea,
    updateIdea,
    updateBoard,
    addBoard,
    setTemperature,
    deleteIdea,
  }
}
