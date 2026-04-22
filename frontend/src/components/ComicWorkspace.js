import { useState, useRef, useEffect } from 'react';
import { Pen, Eraser, Palette, Undo2, Redo2, Sparkles, Type, Download, Plus, Trash2 } from 'lucide-react';
import axios from 'axios';
import { toast, Toaster } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;
const MAX_PANELS = 8;

const PRESET_COLORS = [
  '#000000', '#FFFFFF', '#EF4444', '#F59E0B', '#10B981',
  '#3B82F6', '#8B5CF6', '#EC4899', '#6B7280'
];

const ComicWorkspace = () => {
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [tool, setTool] = useState('brush');
  const [brushColor, setBrushColor] = useState('#000000');
  const [brushSize, setBrushSize] = useState(3);
  const [history, setHistory] = useState([]);
  const [historyStep, setHistoryStep] = useState(-1);
  const [panels, setPanels] = useState([]);
  const [activePanelIndex, setActivePanelIndex] = useState(0);
  const [isImproving, setIsImproving] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [projectId, setProjectId] = useState(null);
  const [textBubbles, setTextBubbles] = useState([]);
  const [draggingBubble, setDraggingBubble] = useState(null);
  const [resizingBubble, setResizingBubble] = useState(null);
  const canvasContainerRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      saveToHistory();
    }
    createNewProject();
  }, []);

  const createNewProject = async () => {
    try {
      const response = await axios.post(`${API}/projects`, { title: 'Mi Historieta' });
      setProjectId(response.data.id);
      const initialPanel = {
        id: Date.now().toString(),
        position: 0,
        canvasData: canvasRef.current?.toDataURL(),
        improvedImageUrl: null,
        textBubbles: []
      };
      setPanels([initialPanel]);
    } catch (error) {
      console.error('Error creating project:', error);
      toast.error('Error al crear el proyecto');
    }
  };

  const saveToHistory = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const dataUrl = canvas.toDataURL();
    const newHistory = history.slice(0, historyStep + 1);
    newHistory.push(dataUrl);
    setHistory(newHistory);
    setHistoryStep(newHistory.length - 1);
  };

  const undo = () => {
    if (historyStep > 0) {
      const newStep = historyStep - 1;
      setHistoryStep(newStep);
      loadFromHistory(history[newStep]);
    }
  };

  const redo = () => {
    if (historyStep < history.length - 1) {
      const newStep = historyStep + 1;
      setHistoryStep(newStep);
      loadFromHistory(history[newStep]);
    }
  };

  const loadFromHistory = (dataUrl) => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const img = new Image();
    img.onload = () => {
      ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      ctx.drawImage(img, 0, 0);
    };
    img.src = dataUrl;
  };

  const startDrawing = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const ctx = canvas.getContext('2d');
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
  };

  const draw = (e) => {
    if (!isDrawing) return;
    
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const ctx = canvas.getContext('2d');
    
    if (tool === 'brush') {
      ctx.strokeStyle = brushColor;
      ctx.lineWidth = brushSize;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.lineTo(x, y);
      ctx.stroke();
    } else if (tool === 'eraser') {
      ctx.strokeStyle = 'white';
      ctx.lineWidth = brushSize * 2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.lineTo(x, y);
      ctx.stroke();
    }
  };

  const stopDrawing = () => {
    if (isDrawing) {
      setIsDrawing(false);
      saveToHistory();
      saveCurrentPanelToState();
    }
  };

  const saveCurrentPanelToState = (nextTextBubbles = textBubbles) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const updatedPanels = [...panels];
    if (updatedPanels[activePanelIndex]) {
      updatedPanels[activePanelIndex] = {
        ...updatedPanels[activePanelIndex],
        canvasData: canvas.toDataURL(),
        textBubbles: nextTextBubbles
      };
      setPanels(updatedPanels);
    }
  };

  const improveDrawing = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    setIsImproving(true);
    try {
      const canvasData = canvas.toDataURL();
      const response = await axios.post(`${API}/panels/improve`, {
        canvasData,
        prompt: 'Mejora y perfecciona este dibujo de cómic, hazlo más detallado y profesional manteniendo la misma composición y estilo'
      });
      
      const improvedImage = response.data.improvedImage;
      const updatedPanels = [...panels];
      updatedPanels[activePanelIndex] = {
        ...updatedPanels[activePanelIndex],
        improvedImageUrl: improvedImage
      };
      setPanels(updatedPanels);
      
      const img = new Image();
      img.onload = () => {
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        ctx.drawImage(img, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        saveToHistory();
      };
      img.src = improvedImage;
      
      toast.success('¡Dibujo mejorado con IA!');
    } catch (error) {
      console.error('Error improving drawing:', error);
      toast.error('Error al mejorar el dibujo');
    } finally {
      setIsImproving(false);
    }
  };

  const addNewPanel = () => {
    if (panels.length >= MAX_PANELS) {
      toast.error(`Máximo ${MAX_PANELS} paneles por página`);
      return;
    }
    
    saveCurrentPanelToState();
    
    const newPanel = {
      id: Date.now().toString(),
      position: panels.length,
      canvasData: null,
      improvedImageUrl: null,
      textBubbles: []
    };
    
    setPanels([...panels, newPanel]);
    setActivePanelIndex(panels.length);
    setTextBubbles([]);
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    
    setHistory([canvas.toDataURL()]);
    setHistoryStep(0);
  };

  const switchToPanel = (index) => {
    saveCurrentPanelToState();
    
    setActivePanelIndex(index);
    const panel = panels[index];
    setTextBubbles(panel.textBubbles || []);
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    
    if (panel.canvasData) {
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0);
        const newHistory = [canvas.toDataURL()];
        setHistory(newHistory);
        setHistoryStep(0);
      };
      img.src = panel.canvasData;
    } else {
      const newHistory = [canvas.toDataURL()];
      setHistory(newHistory);
      setHistoryStep(0);
    }
  };

  const deletePanel = (index) => {
    if (panels.length <= 1) {
      toast.error('Debe haber al menos un panel');
      return;
    }
    
    const updatedPanels = panels.filter((_, i) => i !== index);
    setPanels(updatedPanels);
    
    if (activePanelIndex >= updatedPanels.length) {
      switchToPanel(updatedPanels.length - 1);
    } else if (activePanelIndex === index) {
      switchToPanel(Math.max(0, index - 1));
    }
  };

  const addTextBubble = () => {
    const newBubble = {
      id: Date.now().toString(),
      text: 'Texto...',
      x: 50,
      y: 50,
      width: 150,
      height: 80,
      style: 'speech'
    };
    const updated = [...textBubbles, newBubble];
    setTextBubbles(updated);
    saveCurrentPanelToState(updated);
  };

  const updateBubbleText = (id, newText) => {
    const updated = textBubbles.map(b => b.id === id ? { ...b, text: newText } : b);
    setTextBubbles(updated);
    saveCurrentPanelToState(updated);
  };

  const deleteBubble = (id) => {
    const updated = textBubbles.filter(b => b.id !== id);
    setTextBubbles(updated);
    saveCurrentPanelToState(updated);
  };

  const startDragging = (e, bubble) => {
    if (e.target.closest('textarea, button, .resize-handle')) return;
    e.preventDefault();
    setDraggingBubble({ ...bubble, startX: e.clientX, startY: e.clientY });
  };

  const startResizing = (e, bubble) => {
    e.preventDefault();
    e.stopPropagation();
    setResizingBubble({ ...bubble, startX: e.clientX, startY: e.clientY });
  };

  const handleMouseMove = (e) => {
    if (draggingBubble) {
      const deltaX = e.clientX - draggingBubble.startX;
      const deltaY = e.clientY - draggingBubble.startY;
      
      const updated = textBubbles.map(b => 
        b.id === draggingBubble.id 
          ? { ...b, x: b.x + deltaX, y: b.y + deltaY }
          : b
      );
      setTextBubbles(updated);
      saveCurrentPanelToState(updated);
      setDraggingBubble({ ...draggingBubble, startX: e.clientX, startY: e.clientY });
    } else if (resizingBubble) {
      const deltaX = e.clientX - resizingBubble.startX;
      const deltaY = e.clientY - resizingBubble.startY;
      
      const updated = textBubbles.map(b => 
        b.id === resizingBubble.id 
          ? { ...b, width: Math.max(100, b.width + deltaX), height: Math.max(50, b.height + deltaY) }
          : b
      );
      setTextBubbles(updated);
      saveCurrentPanelToState(updated);
      setResizingBubble({ ...resizingBubble, startX: e.clientX, startY: e.clientY });
    }
  };

  const handleMouseUp = () => {
    setDraggingBubble(null);
    setResizingBubble(null);
  };

  const exportComic = () => {
    saveCurrentPanelToState();
    
    const exportCanvas = document.createElement('canvas');
    const cols = Math.ceil(Math.sqrt(panels.length));
    const rows = Math.ceil(panels.length / cols);
    
    exportCanvas.width = cols * CANVAS_WIDTH;
    exportCanvas.height = rows * CANVAS_HEIGHT;
    
    const ctx = exportCanvas.getContext('2d');
    ctx.fillStyle = '#F4F4F5';
    ctx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);
    
    const promises = panels.map((panel, index) => {
      return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
          const col = index % cols;
          const row = Math.floor(index / cols);
          ctx.drawImage(img, col * CANVAS_WIDTH, row * CANVAS_HEIGHT, CANVAS_WIDTH, CANVAS_HEIGHT);
          
          ctx.strokeStyle = '#27272A';
          ctx.lineWidth = 4;
          ctx.strokeRect(col * CANVAS_WIDTH, row * CANVAS_HEIGHT, CANVAS_WIDTH, CANVAS_HEIGHT);
          
          resolve();
        };
        img.src = panel.canvasData || canvasRef.current.toDataURL();
      });
    });
    
    Promise.all(promises).then(() => {
      const link = document.createElement('a');
      link.download = 'mi-historieta.png';
      link.href = exportCanvas.toDataURL();
      link.click();
      toast.success('¡Historieta exportada!');
    });
  };

  useEffect(() => {
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [draggingBubble, resizingBubble, textBubbles]);

  return (
    <div className="h-screen flex flex-col bg-zinc-950 text-white">
      <Toaster position="top-center" richColors />
      
      {/* Header */}
      <div className="h-16 border-b border-zinc-800 flex items-center justify-between px-6 bg-zinc-950">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight" data-testid="app-title">COMICMAKER</h1>
          <p className="text-xs uppercase tracking-[0.2em] text-zinc-400">Crea tus propias historietas</p>
        </div>
        <button
          onClick={exportComic}
          data-testid="export-button"
          className="bg-yellow-400 text-black font-semibold rounded-none border border-yellow-400 hover:bg-yellow-500 transition-colors px-6 py-2.5 flex items-center gap-2"
        >
          <Download size={18} />
          EXPORTAR
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left Toolbar */}
        <div className="w-16 border-r border-zinc-800 bg-zinc-950 flex flex-col items-center py-4 gap-2 z-10" data-testid="left-toolbar">
          <button
            onClick={() => setTool('brush')}
            data-testid="brush-tool"
            className={tool === 'brush' 
              ? 'h-10 w-10 flex items-center justify-center rounded-md text-yellow-400 bg-yellow-400/10 border border-yellow-400/30'
              : 'h-10 w-10 flex items-center justify-center rounded-md text-zinc-400 hover:text-white hover:bg-zinc-800 transition-all'
            }
            title="Pincel"
          >
            <Pen size={20} />
          </button>
          
          <button
            onClick={() => setTool('eraser')}
            data-testid="eraser-tool"
            className={tool === 'eraser'
              ? 'h-10 w-10 flex items-center justify-center rounded-md text-yellow-400 bg-yellow-400/10 border border-yellow-400/30'
              : 'h-10 w-10 flex items-center justify-center rounded-md text-zinc-400 hover:text-white hover:bg-zinc-800 transition-all'
            }
            title="Borrador"
          >
            <Eraser size={20} />
          </button>
          
          <div className="relative">
            <button
              onClick={() => setShowColorPicker(!showColorPicker)}
              data-testid="color-picker-toggle"
              className="h-10 w-10 flex items-center justify-center rounded-md text-zinc-400 hover:text-white hover:bg-zinc-800 transition-all"
              title="Color"
            >
              <Palette size={20} />
            </button>
            {showColorPicker && (
              <div className="absolute left-16 top-0 bg-zinc-900 border border-zinc-800 rounded p-2 grid grid-cols-3 gap-2 z-50" data-testid="color-picker-panel">
                {PRESET_COLORS.map(color => (
                  <button
                    key={color}
                    onClick={() => {
                      setBrushColor(color);
                      setShowColorPicker(false);
                    }}
                    data-testid={`color-${color}`}
                    className="w-8 h-8 rounded border-2 border-zinc-700 hover:border-yellow-400 transition-all"
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            )}
          </div>
          
          <div className="w-10 h-px bg-zinc-800 my-2" />
          
          <button
            onClick={undo}
            disabled={historyStep <= 0}
            data-testid="undo-button"
            className="h-10 w-10 flex items-center justify-center rounded-md text-zinc-400 hover:text-white hover:bg-zinc-800 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
            title="Deshacer"
          >
            <Undo2 size={20} />
          </button>
          
          <button
            onClick={redo}
            disabled={historyStep >= history.length - 1}
            data-testid="redo-button"
            className="h-10 w-10 flex items-center justify-center rounded-md text-zinc-400 hover:text-white hover:bg-zinc-800 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
            title="Rehacer"
          >
            <Redo2 size={20} />
          </button>
          
          <div className="w-10 h-px bg-zinc-800 my-2" />
          
          <button
            onClick={addTextBubble}
            data-testid="add-text-bubble"
            className="h-10 w-10 flex items-center justify-center rounded-md text-zinc-400 hover:text-white hover:bg-zinc-800 transition-all"
            title="Agregar texto"
          >
            <Type size={20} />
          </button>
        </div>

        {/* Canvas Area */}
        <div className="flex-1 bg-zinc-900 overflow-auto relative flex items-center justify-center p-8 bg-[radial-gradient(#27272a_1px,transparent_1px)] [background-size:20px_20px]" data-testid="canvas-area">
          <div className="canvas-container" ref={canvasContainerRef}>
            <div className="canvas-wrapper">
              <canvas
                ref={canvasRef}
                width={CANVAS_WIDTH}
                height={CANVAS_HEIGHT}
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                data-testid="drawing-canvas"
                className="cursor-crosshair"
              />
            </div>
            {textBubbles.map(bubble => (
              <div
                key={bubble.id}
                className="text-bubble"
                style={{
                  left: bubble.x,
                  top: bubble.y,
                  width: bubble.width,
                  height: bubble.height
                }}
                onMouseDown={(e) => startDragging(e, bubble)}
                data-testid={`text-bubble-${bubble.id}`}
              >
                <textarea
                  className="text-bubble-input"
                  value={bubble.text}
                  onChange={(e) => updateBubbleText(bubble.id, e.target.value)}
                  onMouseDown={(e) => e.stopPropagation()}
                  data-testid={`text-bubble-input-${bubble.id}`}
                />
                <button
                  onClick={() => deleteBubble(bubble.id)}
                  className="delete-bubble-btn"
                  data-testid={`delete-bubble-${bubble.id}`}
                >
                  <Trash2 size={14} />
                </button>
                <div 
                  className="resize-handle"
                  onMouseDown={(e) => startResizing(e, bubble)}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Right Sidebar */}
        <div className="w-80 border-l border-zinc-800 bg-zinc-950 flex flex-col overflow-y-auto z-10" data-testid="right-sidebar">
          <div className="p-4 border-b border-zinc-800">
            <h2 className="text-xl font-medium mb-2">Paneles</h2>
            <p className="text-xs text-zinc-400">{panels.length} / {MAX_PANELS}</p>
          </div>
          
          <div className="p-4 flex-1 overflow-y-auto">
            <div className="grid grid-cols-2 gap-3 mb-4">
              {panels.map((panel, index) => (
                <div
                  key={panel.id}
                  onClick={() => switchToPanel(index)}
                  className={activePanelIndex === index
                    ? 'border-2 border-yellow-400 bg-zinc-900 rounded p-2 cursor-pointer relative group'
                    : 'border border-zinc-800 bg-zinc-900 rounded p-2 cursor-pointer hover:border-zinc-700 transition-all relative group'
                  }
                  data-testid={`panel-${index}`}
                >
                  <div className="panel-thumbnail">
                    {panel.canvasData ? (
                      <img src={panel.canvasData} alt={`Panel ${index + 1}`} className="w-full h-full object-contain" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-zinc-600">
                        Panel {index + 1}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deletePanel(index);
                    }}
                    className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity bg-red-500 hover:bg-red-600 text-white rounded p-1"
                    data-testid={`delete-panel-${index}`}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
            
            {panels.length < MAX_PANELS && (
              <button
                onClick={addNewPanel}
                data-testid="add-panel-button"
                className="w-full border-2 border-dashed border-zinc-700 hover:border-yellow-400 rounded p-4 flex items-center justify-center gap-2 text-zinc-400 hover:text-yellow-400 transition-all"
              >
                <Plus size={20} />
                Nuevo Panel
              </button>
            )}
          </div>
          
          <div className="p-4 border-t border-zinc-800">
            <button
              onClick={improveDrawing}
              disabled={isImproving}
              data-testid="ai-enhance-button"
              className="w-full bg-yellow-400 text-black font-semibold rounded-none border border-yellow-400 hover:bg-yellow-500 transition-colors px-6 py-3 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isImproving ? (
                <>
                  <div className="loading-spinner" />
                  Mejorando...
                </>
              ) : (
                <>
                  <Sparkles size={20} />
                  MEJORAR CON IA
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ComicWorkspace;
