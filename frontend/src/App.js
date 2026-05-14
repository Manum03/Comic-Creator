import '@/App.css';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import ComicWorkspace from '@/components/ComicWorkspace';

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<ComicWorkspace />} />
        </Routes>
      </BrowserRouter>
    </div>
  );
}

export default App;