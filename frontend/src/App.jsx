import { Routes, Route, Link } from 'react-router-dom';
import MapPage from './features/map/MapPage.jsx';

// Minimal router shell. Add auth, reports, and admin routes as features land (see docs/ROADMAP.md).
export default function App() {
  return (
    <div>
      <nav style={{ display: 'flex', gap: 12, padding: 12, borderBottom: '1px solid #ddd' }}>
        <Link to="/">Map</Link>
        <Link to="/reports">Reports</Link>
        <Link to="/login">Login</Link>
      </nav>
      <Routes>
        <Route path="/" element={<MapPage />} />
        <Route path="/reports" element={<Placeholder name="Reports list (week 4)" />} />
        <Route path="/login" element={<Placeholder name="Login (week 2)" />} />
        <Route path="*" element={<Placeholder name="Not found" />} />
      </Routes>
    </div>
  );
}

function Placeholder({ name }) {
  return <div style={{ padding: 24 }}>{name}</div>;
}
