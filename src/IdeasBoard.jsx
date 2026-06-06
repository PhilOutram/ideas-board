import React, { useState, useEffect } from 'react';
import { 
  initializeApp } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  onSnapshot, 
  query, 
  orderBy,
  serverTimestamp 
} from 'firebase/firestore';
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged 
} from 'firebase/auth';

// Firebase configuration - REPLACE WITH YOUR CONFIG
const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// Styles
const styles = `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  
  body {
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    background: #f5f3f0;
    color: #2c2825;
  }
  
  .app {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
  }
  
  /* Auth Screen */
  .auth-screen {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
    background: linear-gradient(135deg, #f5f3f0 0%, #ede9e4 100%);
  }
  
  .auth-box {
    background: white;
    padding: 3rem;
    border-radius: 12px;
    box-shadow: 0 10px 40px rgba(0,0,0,0.1);
    width: 100%;
    max-width: 400px;
  }
  
  .auth-box h1 {
    font-size: 2rem;
    margin-bottom: 0.5rem;
    font-weight: 600;
    font-family: 'Crimson Text', serif;
  }
  
  .auth-box p {
    color: #666;
    margin-bottom: 2rem;
    font-size: 0.95rem;
  }
  
  .auth-form {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }
  
  .auth-form input {
    padding: 0.75rem;
    border: 1px solid #ddd;
    border-radius: 6px;
    font-size: 0.95rem;
    font-family: 'Inter', sans-serif;
  }
  
  .auth-form input:focus {
    outline: none;
    border-color: #910A2E;
    box-shadow: 0 0 0 3px rgba(145, 10, 46, 0.1);
  }
  
  .auth-buttons {
    display: flex;
    gap: 0.75rem;
  }
  
  .btn {
    padding: 0.75rem 1.5rem;
    border: none;
    border-radius: 6px;
    font-size: 0.95rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
    font-family: 'Inter', sans-serif;
  }
  
  .btn-primary {
    background: #910A2E;
    color: white;
    flex: 1;
  }
  
  .btn-primary:hover { background: #7a0820; }
  
  .btn-secondary {
    background: #eee;
    color: #2c2825;
    flex: 1;
  }
  
  .btn-secondary:hover { background: #ddd; }
  
  /* Header */
  .header {
    background: white;
    border-bottom: 1px solid #e5e0db;
    padding: 1.5rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  
  .header h1 {
    font-family: 'Crimson Text', serif;
    font-size: 1.8rem;
    font-weight: 600;
  }
  
  .user-info {
    display: flex;
    align-items: center;
    gap: 1rem;
    color: #666;
    font-size: 0.9rem;
  }
  
  /* Main content */
  .main {
    flex: 1;
    display: flex;
    overflow: hidden;
  }
  
  /* Pages sidebar */
  .pages-sidebar {
    width: 200px;
    background: white;
    border-right: 1px solid #e5e0db;
    padding: 1.5rem;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }
  
  .pages-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  
  .page-item {
    padding: 0.75rem;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.2s;
    border-left: 3px solid transparent;
    font-size: 0.95rem;
  }
  
  .page-item:hover { background: #f5f3f0; }
  
  .page-item.active {
    background: #f0e8e3;
    border-left-color: #910A2E;
    font-weight: 500;
  }
  
  .add-page-btn {
    padding: 0.75rem;
    background: #910A2E;
    color: white;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-size: 0.9rem;
    font-weight: 500;
  }
  
  .add-page-btn:hover { background: #7a0820; }
  
  /* Page content */
  .page-content {
    flex: 1;
    padding: 2rem;
    overflow-y: auto;
    background: #f5f3f0;
  }
  
  .page-header {
    margin-bottom: 2rem;
  }
  
  .page-header h2 {
    font-family: 'Crimson Text', serif;
    font-size: 2rem;
    margin-bottom: 0.5rem;
  }
  
  /* Messy board / Inbox */
  .messy-board {
    background: white;
    border-radius: 8px;
    padding: 1.5rem;
    margin-bottom: 2rem;
    border: 1px solid #e5e0db;
  }
  
  .messy-board h3 {
    font-size: 1.1rem;
    margin-bottom: 1rem;
    color: #666;
  }
  
  .quick-add {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 1rem;
  }
  
  .quick-add input {
    flex: 1;
    padding: 0.75rem;
    border: 1px solid #ddd;
    border-radius: 6px;
    font-family: 'Inter', sans-serif;
  }
  
  .quick-add button {
    padding: 0.75rem 1.5rem;
    background: #910A2E;
    color: white;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-weight: 500;
  }
  
  .quick-ideas {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }
  
  .quick-idea-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.75rem;
    background: #f9f8f7;
    border-radius: 6px;
    border-left: 3px solid #ddd;
  }
  
  .quick-idea-text {
    flex: 1;
  }
  
  .quick-idea-time {
    font-size: 0.8rem;
    color: #999;
  }
  
  .quick-idea-actions {
    display: flex;
    gap: 0.5rem;
  }
  
  .action-btn {
    padding: 0.4rem 0.8rem;
    background: white;
    border: 1px solid #ddd;
    border-radius: 4px;
    font-size: 0.85rem;
    cursor: pointer;
    transition: all 0.2s;
  }
  
  .action-btn:hover { background: #eee; }
  
  /* Ideas grid */
  .ideas-section {
    margin-bottom: 2rem;
  }
  
  .ideas-section h3 {
    font-size: 1.1rem;
    margin-bottom: 1.5rem;
    color: #666;
  }
  
  .ideas-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
    gap: 1.5rem;
  }
  
  .idea-card {
    background: white;
    border-radius: 8px;
    padding: 1.5rem;
    cursor: pointer;
    transition: all 0.3s;
    border: 1px solid #e5e0db;
    position: relative;
    overflow: hidden;
  }
  
  .idea-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 24px rgba(0,0,0,0.1);
  }
  
  .idea-card.hot {
    border-left: 4px solid #910A2E;
    background: linear-gradient(135deg, #fff9f7 0%, white 100%);
  }
  
  .idea-card.warm {
    border-left: 4px solid #d4a574;
    background: linear-gradient(135deg, #fffaf7 0%, white 100%);
  }
  
  .idea-card.cold {
    border-left: 4px solid #8fa8c0;
    opacity: 0.75;
    background: linear-gradient(135deg, #f7f9fb 0%, white 100%);
  }
  
  .idea-temp {
    position: absolute;
    top: 1rem;
    right: 1rem;
    font-size: 1.5rem;
    cursor: pointer;
    transition: transform 0.2s;
  }
  
  .idea-temp:hover { transform: scale(1.2); }
  
  .idea-title {
    font-size: 1.1rem;
    font-weight: 500;
    margin-bottom: 0.5rem;
    word-break: break-word;
    padding-right: 2.5rem;
  }
  
  .idea-boards {
    display: flex;
    gap: 0.4rem;
    font-size: 0.8rem;
    color: #999;
    flex-wrap: wrap;
  }
  
  /* Idea detail modal */
  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0,0,0,0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }
  
  .modal {
    background: white;
    border-radius: 8px;
    max-width: 90%;
    max-height: 90vh;
    overflow: auto;
    width: 1000px;
    box-shadow: 0 20px 60px rgba(0,0,0,0.3);
  }
  
  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 2rem;
    border-bottom: 1px solid #e5e0db;
    background: white;
    position: sticky;
    top: 0;
  }
  
  .modal-title {
    font-family: 'Crimson Text', serif;
    font-size: 1.8rem;
  }
  
  .modal-close {
    background: none;
    border: none;
    font-size: 1.5rem;
    cursor: pointer;
    color: #666;
  }
  
  .modal-content {
    padding: 2rem;
    display: flex;
    flex-direction: column;
    gap: 2rem;
  }
  
  .board-section {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  
  .board-title {
    font-weight: 600;
    font-size: 1rem;
    color: #333;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  
  .copy-btn {
    padding: 0.4rem 0.8rem;
    background: #910A2E;
    color: white;
    border: none;
    border-radius: 4px;
    font-size: 0.8rem;
    cursor: pointer;
  }
  
  .copy-btn:hover { background: #7a0820; }
  
  .board-content {
    background: #f9f8f7;
    border-radius: 6px;
    padding: 1rem;
    min-height: 100px;
    border: 1px solid #e5e0db;
    font-size: 0.95rem;
    line-height: 1.6;
    word-break: break-word;
    cursor: text;
    position: relative;
  }
  
  .board-content.editable {
    border: 2px solid #910A2E;
  }
  
  .board-content textarea {
    width: 100%;
    min-height: 100px;
    border: none;
    font-family: 'Inter', sans-serif;
    font-size: 0.95rem;
    resize: vertical;
    padding: 0;
    background: transparent;
  }
  
  .board-content textarea:focus {
    outline: none;
  }
  
  .edit-toggle {
    padding: 0.4rem 0.8rem;
    background: #f0e8e3;
    color: #333;
    border: none;
    border-radius: 4px;
    font-size: 0.8rem;
    cursor: pointer;
  }
  
  .edit-toggle:hover { background: #e5ddd4; }
  
  /* Export modal */
  .export-section {
    margin-top: 1rem;
    padding-top: 1rem;
    border-top: 1px solid #e5e0db;
  }
  
  .export-format {
    background: #f9f8f7;
    border: 1px solid #e5e0db;
    border-radius: 6px;
    padding: 1rem;
    font-family: 'Courier New', monospace;
    font-size: 0.85rem;
    line-height: 1.6;
    max-height: 300px;
    overflow: auto;
    color: #333;
  }
  
  .export-buttons {
    display: flex;
    gap: 0.75rem;
    margin-top: 1rem;
  }
  
  @media (max-width: 768px) {
    .pages-sidebar { width: 150px; }
    .ideas-grid { grid-template-columns: 1fr; }
    .modal { width: 95%; }
  }
`;

// Main App Component
export default function IdeasBoard() {
  const [user, setUser] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pages, setPages] = useState([]);
  const [selectedPageId, setSelectedPageId] = useState(null);
  const [quickIdeas, setQuickIdeas] = useState([]);
  const [ideas, setIdeas] = useState([]);
  const [selectedIdea, setSelectedIdea] = useState(null);
  const [editingBoards, setEditingBoards] = useState({});
  const [newPageTitle, setNewPageTitle] = useState('');
  const [newQuickIdea, setNewQuickIdea] = useState('');

  // Auth state listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        loadPages();
      }
    });
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load pages
  const loadPages = async () => {
    const q = query(collection(db, 'pages'), orderBy('order', 'asc'));
    onSnapshot(q, (snapshot) => {
      const pagesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setPages(pagesData);
      if (pagesData.length > 0 && !selectedPageId) {
        setSelectedPageId(pagesData[0].id);
      }
    });
  };

  // Load ideas for selected page
  useEffect(() => {
    if (!selectedPageId) return;
    
    const ideasRef = collection(db, 'pages', selectedPageId, 'ideas');
    const q = query(ideasRef, orderBy('created', 'desc'));
    
    onSnapshot(q, (snapshot) => {
      const ideasData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setIdeas(ideasData);
    });

    // Load quick ideas (messy board)
    const quickRef = collection(db, 'pages', selectedPageId, 'quickIdeas');
    const quickQ = query(quickRef, orderBy('created', 'desc'));
    
    onSnapshot(quickQ, (snapshot) => {
      const quickData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setQuickIdeas(quickData);
    });
  }, [selectedPageId]);

  // Auth functions
  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      await signInWithEmailAndPassword(auth, email, password);
      setEmail('');
      setPassword('');
    } catch (err) {
      alert('Login failed: ' + err.message);
    }
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    try {
      await signInWithEmailAndPassword(auth, email, password);
      setEmail('');
      setPassword('');
    } catch (err) {
      alert('Signup failed: ' + err.message);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    setPages([]);
    setIdeas([]);
    setQuickIdeas([]);
  };

  // Page functions
  const addPage = async () => {
    if (!newPageTitle.trim()) return;
    
    try {
      await addDoc(collection(db, 'pages'), {
        title: newPageTitle,
        context: '',
        memory: '',
        order: pages.length,
        created: serverTimestamp(),
      });
      setNewPageTitle('');
    } catch (err) {
      alert('Error creating page: ' + err.message);
    }
  };

  // Quick idea functions
  const addQuickIdea = async () => {
    if (!newQuickIdea.trim() || !selectedPageId) return;
    
    try {
      await addDoc(collection(db, 'pages', selectedPageId, 'quickIdeas'), {
        text: newQuickIdea,
        created: serverTimestamp(),
      });
      setNewQuickIdea('');
    } catch (err) {
      alert('Error adding idea: ' + err.message);
    }
  };

  const promoteQuickIdea = async (quickIdea) => {
    try {
      // Create idea
      await addDoc(collection(db, 'pages', selectedPageId, 'ideas'), {
        title: quickIdea.text,
        temperature: 'warm',
        boards: {
          messy: '',
          tidy: '',
          context: '',
          memory: '',
        },
        created: serverTimestamp(),
        lastEdited: serverTimestamp(),
      });
      
      // Delete quick idea
      await deleteDoc(doc(db, 'pages', selectedPageId, 'quickIdeas', quickIdea.id));
    } catch (err) {
      alert('Error promoting idea: ' + err.message);
    }
  };

  const deleteQuickIdea = async (quickId) => {
    try {
      await deleteDoc(doc(db, 'pages', selectedPageId, 'quickIdeas', quickId));
    } catch (err) {
      alert('Error deleting idea: ' + err.message);
    }
  };

  // Idea functions
  const updateIdeaBoard = async (ideaId, boardName, content) => {
    try {
      const ideaRef = doc(db, 'pages', selectedPageId, 'ideas', ideaId);
      const idea = ideas.find(i => i.id === ideaId);
      
      await updateDoc(ideaRef, {
        boards: {
          ...idea.boards,
          [boardName]: content,
        },
        lastEdited: serverTimestamp(),
      });
    } catch (err) {
      alert('Error updating board: ' + err.message);
    }
  };

  const updateIdeaTemp = async (ideaId, newTemp) => {
    try {
      await updateDoc(doc(db, 'pages', selectedPageId, 'ideas', ideaId), {
        temperature: newTemp,
        lastEdited: serverTimestamp(),
      });
    } catch (err) {
      alert('Error updating temperature: ' + err.message);
    }
  };

  // Export functions
  const exportAsMarkdown = (idea) => {
    const md = `# ${idea.title}

## Context
${idea.boards?.context || '(empty)'}

## Messy Thoughts
${idea.boards?.messy || '(empty)'}

## Memory
${idea.boards?.memory || '(empty)'}

## Tidy Board
${idea.boards?.tidy || '(empty)'}`;
    
    return md;
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text).then(() => {
      alert('Copied to clipboard!');
    });
  };

  const tempEmoji = {
    hot: '🔥',
    warm: '🟡',
    cold: '❄️',
  };

  // UI: Auth screen
  if (!user) {
    return (
      <>
        <style>{styles}</style>
        <div className="auth-screen">
          <div className="auth-box">
            <h1>Ideas Board</h1>
            <p>AI-friendly hierarchical note-taking</p>
            <div className="auth-form">
              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <div className="auth-buttons">
                <button className="btn btn-primary" onClick={handleLogin}>
                  Sign In
                </button>
                <button className="btn btn-secondary" onClick={handleSignup}>
                  Sign Up
                </button>
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  const selectedPage = pages.find(p => p.id === selectedPageId);
  const hotIdeas = ideas.filter(i => i.temperature === 'hot');
  const warmIdeas = ideas.filter(i => i.temperature === 'warm');
  const coldIdeas = ideas.filter(i => i.temperature === 'cold');

  return (
    <>
      <style>{styles}</style>
      <div className="app">
        <div className="header">
          <h1>Ideas Board</h1>
          <div className="user-info">
            <span>{user.email}</span>
            <button className="btn btn-secondary" onClick={handleLogout}>Sign Out</button>
          </div>
        </div>

        <div className="main">
          {/* Pages Sidebar */}
          <div className="pages-sidebar">
            <div className="pages-list">
              {pages.map(page => (
                <div
                  key={page.id}
                  className={`page-item ${selectedPageId === page.id ? 'active' : ''}`}
                  onClick={() => setSelectedPageId(page.id)}
                >
                  {page.title}
                </div>
              ))}
            </div>
            
            <div className="quick-add">
              <input
                type="text"
                placeholder="New page..."
                value={newPageTitle}
                onChange={(e) => setNewPageTitle(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && addPage()}
              />
              <button className="add-page-btn" onClick={addPage}>+</button>
            </div>
          </div>

          {/* Page Content */}
          <div className="page-content">
            {selectedPage && (
              <>
                <div className="page-header">
                  <h2>{selectedPage.title}</h2>
                </div>

                {/* Messy Board / Inbox */}
                <div className="messy-board">
                  <h3>📥 Inbox</h3>
                  <div className="quick-add">
                    <input
                      type="text"
                      placeholder="Quick idea? Type or paste..."
                      value={newQuickIdea}
                      onChange={(e) => setNewQuickIdea(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && addQuickIdea()}
                    />
                    <button onClick={addQuickIdea}>Add</button>
                  </div>

                  {quickIdeas.length > 0 && (
                    <div className="quick-ideas">
                      {quickIdeas.map(idea => (
                        <div key={idea.id} className="quick-idea-item">
                          <div className="quick-idea-text">
                            <div>{idea.text}</div>
                            <div className="quick-idea-time">
                              {new Date(idea.created?.toDate?.() || new Date()).toLocaleString()}
                            </div>
                          </div>
                          <div className="quick-idea-actions">
                            <button className="action-btn" onClick={() => promoteQuickIdea(idea)}>
                              Promote
                            </button>
                            <button className="action-btn" onClick={() => deleteQuickIdea(idea.id)}>
                              Delete
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Hot Ideas */}
                {hotIdeas.length > 0 && (
                  <div className="ideas-section">
                    <h3>🔥 Hot Ideas</h3>
                    <div className="ideas-grid">
                      {hotIdeas.map(idea => (
                        <div
                          key={idea.id}
                          className="idea-card hot"
                          onClick={() => setSelectedIdea(idea)}
                        >
                          <div className="idea-temp" onClick={(e) => {
                            e.stopPropagation();
                            updateIdeaTemp(idea.id, 'warm');
                          }}>
                            {tempEmoji['hot']}
                          </div>
                          <div className="idea-title">{idea.title}</div>
                          <div className="idea-boards">
                            {Object.entries(idea.boards || {}).map(([name, content]) => 
                              content && <span key={name}>{name}</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Warm Ideas */}
                {warmIdeas.length > 0 && (
                  <div className="ideas-section">
                    <h3>🟡 Warm Ideas</h3>
                    <div className="ideas-grid">
                      {warmIdeas.map(idea => (
                        <div
                          key={idea.id}
                          className="idea-card warm"
                          onClick={() => setSelectedIdea(idea)}
                        >
                          <div className="idea-temp" onClick={(e) => {
                            e.stopPropagation();
                            updateIdeaTemp(idea.id, idea.temperature === 'warm' ? 'hot' : 'cold');
                          }}>
                            {tempEmoji['warm']}
                          </div>
                          <div className="idea-title">{idea.title}</div>
                          <div className="idea-boards">
                            {Object.entries(idea.boards || {}).map(([name, content]) => 
                              content && <span key={name}>{name}</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Cold Ideas */}
                {coldIdeas.length > 0 && (
                  <div className="ideas-section">
                    <h3>❄️ Cold Ideas</h3>
                    <div className="ideas-grid">
                      {coldIdeas.map(idea => (
                        <div
                          key={idea.id}
                          className="idea-card cold"
                          onClick={() => setSelectedIdea(idea)}
                        >
                          <div className="idea-temp" onClick={(e) => {
                            e.stopPropagation();
                            updateIdeaTemp(idea.id, 'warm');
                          }}>
                            {tempEmoji['cold']}
                          </div>
                          <div className="idea-title">{idea.title}</div>
                          <div className="idea-boards">
                            {Object.entries(idea.boards || {}).map(([name, content]) => 
                              content && <span key={name}>{name}</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Idea Detail Modal */}
        {selectedIdea && (
          <div className="modal-overlay" onClick={() => setSelectedIdea(null)}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2 className="modal-title">{selectedIdea.title}</h2>
                <button className="modal-close" onClick={() => setSelectedIdea(null)}>×</button>
              </div>

              <div className="modal-content">
                {Object.entries(selectedIdea.boards || {}).map(([boardName, content]) => (
                  <div key={boardName} className="board-section">
                    <div className="board-title">
                      <span>{boardName.charAt(0).toUpperCase() + boardName.slice(1)}</span>
                      <button className="copy-btn" onClick={() => copyToClipboard(content)}>
                        Copy
                      </button>
                    </div>
                    {editingBoards[boardName] ? (
                      <div className="board-content editable">
                        <textarea
                          value={content}
                          onChange={(e) => {
                            updateIdeaBoard(selectedIdea.id, boardName, e.target.value);
                            setSelectedIdea({
                              ...selectedIdea,
                              boards: { ...selectedIdea.boards, [boardName]: e.target.value }
                            });
                          }}
                          onBlur={() => setEditingBoards({ ...editingBoards, [boardName]: false })}
                          autoFocus
                        />
                      </div>
                    ) : (
                      <>
                        <div
                          className="board-content"
                          onClick={() => setEditingBoards({ ...editingBoards, [boardName]: true })}
                        >
                          {content || '(empty - click to edit)'}
                        </div>
                      </>
                    )}
                  </div>
                ))}

                <div className="export-section">
                  <h3>Export</h3>
                  <div className="export-format">
                    {exportAsMarkdown(selectedIdea)}
                  </div>
                  <div className="export-buttons">
                    <button className="btn btn-primary" onClick={() => copyToClipboard(exportAsMarkdown(selectedIdea))}>
                      Copy as Markdown
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
