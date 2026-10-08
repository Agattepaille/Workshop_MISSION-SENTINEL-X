import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import SentinelDashboard from './components/SentinelDashboard';
// import Login from './components/Login';

function App() {
  return (
    <Router>
      <Routes>
        {/* <Route path="/" element={<Login />} /> */}
        <Route path="/" element={<SentinelDashboard />} />
      </Routes>
    </Router>
  );
}

export default App;