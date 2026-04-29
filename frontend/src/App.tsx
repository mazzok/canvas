import { Routes, Route } from 'react-router-dom'
import Home from './pages/Home'
import Nickname from './pages/Nickname'
import SessionPage from './pages/SessionPage'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/join/:sessionId" element={<Nickname />} />
      <Route path="/session/:sessionId" element={<SessionPage />} />
    </Routes>
  )
}
