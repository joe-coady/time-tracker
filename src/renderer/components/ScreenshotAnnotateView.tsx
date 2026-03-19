import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Stage, Layer, Image as KonvaImage, Arrow, Text, Transformer, Rect } from 'react-konva';
import Konva from 'konva';
import '../styles/screenshot.css';

type Tool = 'select' | 'arrow' | 'text';

interface ArrowAnnotation {
  id: string;
  points: number[];
  stroke: string;
  strokeWidth: number;
}

interface TextAnnotation {
  id: string;
  x: number;
  y: number;
  text: string;
  fontSize: number;
  fill: string;
}

const COLORS = ['#e74c3c', '#2ecc71', '#3498db', '#f39c12', '#9b59b6', '#1abc9c', '#000000', '#ffffff'];
const STROKE_WIDTHS = [2, 4, 6];

export default function ScreenshotAnnotateView() {
  const [tool, setTool] = useState<Tool>('select');
  const [color, setColor] = useState('#e74c3c');
  const [strokeWidth, setStrokeWidth] = useState(4);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [imagePos, setImagePos] = useState({ x: 0, y: 0 });
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const [arrows, setArrows] = useState<ArrowAnnotation[]>([]);
  const [texts, setTexts] = useState<TextAnnotation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawingArrow, setDrawingArrow] = useState<number[] | null>(null);
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const [editingTextValue, setEditingTextValue] = useState('');
  const [editingTextPos, setEditingTextPos] = useState({ x: 0, y: 0 });
  const [stageSize, setStageSize] = useState({ width: 800, height: 600 });
  const [statusMessage, setStatusMessage] = useState('Click "Capture" to take a screenshot');
  const [capturing, setCapturing] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const transformerRef = useRef<Konva.Transformer>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Resize stage to fill container
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        setStageSize({
          width: containerRef.current.offsetWidth,
          height: containerRef.current.offsetHeight,
        });
      }
    };
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  // Update transformer when selection changes
  useEffect(() => {
    const tr = transformerRef.current;
    if (!tr) return;
    const stage = stageRef.current;
    if (!stage) return;

    if (selectedId) {
      const node = stage.findOne('#' + selectedId);
      if (node) {
        tr.nodes([node]);
        tr.getLayer()?.batchDraw();
        return;
      }
    }
    tr.nodes([]);
    tr.getLayer()?.batchDraw();
  }, [selectedId]);

  // Focus textarea when editing text
  useEffect(() => {
    if (editingTextId && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [editingTextId]);

  const handleCapture = useCallback(async () => {
    setCapturing(true);
    setStatusMessage('Select a region on screen...');
    try {
      const dataUrl = await window.electronAPI.captureScreenshot();
      console.log('captureScreenshot returned:', dataUrl ? `data URL length: ${dataUrl.length}` : 'null');
      if (dataUrl) {
        const img = new window.Image();
        img.onload = () => {
          console.log('Image loaded:', img.width, 'x', img.height, 'stageSize:', stageSize);
          // Use container dimensions directly since stage may not have rendered yet
          const containerWidth = containerRef.current?.offsetWidth || stageSize.width;
          const containerHeight = containerRef.current?.offsetHeight || stageSize.height;
          const scale = Math.min(
            (containerWidth - 40) / img.width,
            (containerHeight - 40) / img.height,
            1
          );
          const w = img.width * scale;
          const h = img.height * scale;
          setImageSize({ width: w, height: h });
          setImagePos({
            x: (containerWidth - w) / 2,
            y: (containerHeight - h) / 2,
          });
          setStageSize({ width: containerWidth, height: containerHeight });
          setImage(img);
          setStatusMessage('Screenshot loaded. Use tools to annotate.');
        };
        img.onerror = (err) => {
          console.error('Image failed to load:', err);
          setStatusMessage('Failed to load screenshot image.');
        };
        img.src = dataUrl;
      } else {
        setStatusMessage('Capture cancelled. Click "Capture" to try again.');
      }
    } catch (err) {
      setStatusMessage('Screen Recording permission may be required. Check System Preferences > Privacy > Screen Recording.');
    }
    setCapturing(false);
  }, [stageSize]);

  const handleSave = useCallback(async () => {
    const stage = stageRef.current;
    if (!stage) return;

    // Deselect before export
    setSelectedId(null);
    setEditingTextId(null);

    // Small delay for transformer to clear
    await new Promise(r => setTimeout(r, 50));

    const dataUrl = stage.toDataURL({ pixelRatio: 2 });
    try {
      const filePath = await window.electronAPI.saveScreenshot(dataUrl);
      setStatusMessage(`Saved to ${filePath}`);
    } catch {
      setStatusMessage('Failed to save screenshot.');
    }
  }, []);

  const handleStageMouseDown = (e: Konva.KonvaEventObject<MouseEvent>) => {
    const stage = e.target.getStage();
    if (!stage) return;
    const pos = stage.getPointerPosition();
    if (!pos) return;

    // Click on empty area deselects
    if (e.target === stage || e.target.getClassName() === 'Rect') {
      if (tool === 'select') {
        setSelectedId(null);
      }
    }

    if (tool === 'arrow') {
      setIsDrawing(true);
      setDrawingArrow([pos.x, pos.y, pos.x, pos.y]);
    }

    if (tool === 'text') {
      const id = `text-${Date.now()}`;
      setTexts(prev => [...prev, { id, x: pos.x, y: pos.y, text: 'Text', fontSize: 20, fill: color }]);
      setSelectedId(id);
      // Start editing immediately
      setEditingTextId(id);
      setEditingTextValue('Text');
      setEditingTextPos({ x: pos.x, y: pos.y });
      setTool('select');
    }
  };

  const handleStageMouseMove = (e: Konva.KonvaEventObject<MouseEvent>) => {
    if (!isDrawing || tool !== 'arrow' || !drawingArrow) return;
    const stage = e.target.getStage();
    const pos = stage?.getPointerPosition();
    if (!pos) return;
    setDrawingArrow([drawingArrow[0], drawingArrow[1], pos.x, pos.y]);
  };

  const handleStageMouseUp = () => {
    if (!isDrawing || tool !== 'arrow' || !drawingArrow) return;
    setIsDrawing(false);

    // Only add arrow if it has meaningful length
    const dx = drawingArrow[2] - drawingArrow[0];
    const dy = drawingArrow[3] - drawingArrow[1];
    if (Math.sqrt(dx * dx + dy * dy) > 10) {
      const id = `arrow-${Date.now()}`;
      setArrows(prev => [...prev, { id, points: drawingArrow, stroke: color, strokeWidth }]);
      setSelectedId(id);
    }
    setDrawingArrow(null);
  };

  const handleTextDblClick = (id: string, text: string, x: number, y: number) => {
    setEditingTextId(id);
    setEditingTextValue(text);

    // Get stage position to calculate absolute position
    const stage = stageRef.current;
    if (stage) {
      const container = stage.container().getBoundingClientRect();
      setEditingTextPos({ x: container.left + x, y: container.top + y });
    }
  };

  const finishTextEdit = () => {
    if (!editingTextId) return;
    if (editingTextValue.trim()) {
      setTexts(prev => prev.map(t =>
        t.id === editingTextId ? { ...t, text: editingTextValue } : t
      ));
    } else {
      // Remove empty text
      setTexts(prev => prev.filter(t => t.id !== editingTextId));
      setSelectedId(null);
    }
    setEditingTextId(null);
  };

  const handleDelete = useCallback(() => {
    if (!selectedId) return;
    setArrows(prev => prev.filter(a => a.id !== selectedId));
    setTexts(prev => prev.filter(t => t.id !== selectedId));
    setSelectedId(null);
  }, [selectedId]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (editingTextId) return; // Don't intercept while editing text
      if (e.key === 'Delete' || e.key === 'Backspace') {
        handleDelete();
      }
      if (e.key === 'Escape') {
        setSelectedId(null);
        setTool('select');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleDelete, editingTextId]);

  return (
    <div className="screenshot-container">
      <div className="screenshot-toolbar">
        <button onClick={handleCapture} disabled={capturing} className="primary">
          Capture
        </button>
        <div className="separator" />
        <button
          className={tool === 'select' ? 'active' : ''}
          onClick={() => setTool('select')}
        >
          Select
        </button>
        <button
          className={tool === 'arrow' ? 'active' : ''}
          onClick={() => setTool('arrow')}
        >
          Arrow
        </button>
        <button
          className={tool === 'text' ? 'active' : ''}
          onClick={() => setTool('text')}
        >
          Text
        </button>
        <div className="separator" />
        <div className="screenshot-color-swatches">
          {COLORS.map(c => (
            <div
              key={c}
              className={`screenshot-color-swatch ${color === c ? 'selected' : ''}`}
              style={{ backgroundColor: c }}
              onClick={() => setColor(c)}
            />
          ))}
        </div>
        <div className="separator" />
        <div className="screenshot-stroke-options">
          {STROKE_WIDTHS.map(w => (
            <button
              key={w}
              className={`screenshot-stroke-btn ${strokeWidth === w ? 'active' : ''}`}
              onClick={() => setStrokeWidth(w)}
            >
              {w}
            </button>
          ))}
        </div>
        <div className="separator" />
        <button onClick={handleDelete} disabled={!selectedId}>
          Delete
        </button>
        <div style={{ flex: 1 }} />
        <button onClick={handleSave} className="primary" disabled={!image}>
          Save
        </button>
      </div>

      <div className="screenshot-canvas-container" ref={containerRef}>
        {!image ? (
          <div className="screenshot-empty">
            <p>No screenshot captured yet</p>
            <button onClick={handleCapture} disabled={capturing}>
              Click to Capture Screenshot
            </button>
          </div>
        ) : (
          <>
            <Stage
              ref={stageRef}
              width={stageSize.width}
              height={stageSize.height}
              onMouseDown={handleStageMouseDown}
              onMouseMove={handleStageMouseMove}
              onMouseUp={handleStageMouseUp}
              style={{ cursor: tool === 'arrow' ? 'crosshair' : tool === 'text' ? 'text' : 'default' }}
            >
              <Layer>
                {/* Background */}
                <Rect width={stageSize.width} height={stageSize.height} fill="#f5f5f5" />

                {/* Screenshot image */}
                <KonvaImage
                  id="screenshot-image"
                  image={image}
                  x={imagePos.x}
                  y={imagePos.y}
                  width={imageSize.width}
                  height={imageSize.height}
                  draggable={tool === 'select'}
                  onDragEnd={(e) => {
                    setImagePos({ x: e.target.x(), y: e.target.y() });
                  }}
                  onClick={() => {
                    if (tool === 'select') setSelectedId('screenshot-image');
                  }}
                  onTap={() => {
                    if (tool === 'select') setSelectedId('screenshot-image');
                  }}
                />

                {/* Arrows */}
                {arrows.map(a => (
                  <Arrow
                    key={a.id}
                    id={a.id}
                    points={a.points}
                    stroke={a.stroke}
                    strokeWidth={a.strokeWidth}
                    fill={a.stroke}
                    pointerLength={10}
                    pointerWidth={10}
                    draggable={tool === 'select'}
                    onClick={() => {
                      if (tool === 'select') setSelectedId(a.id);
                    }}
                    onDragEnd={(e) => {
                      const dx = e.target.x();
                      const dy = e.target.y();
                      setArrows(prev => prev.map(arr =>
                        arr.id === a.id
                          ? { ...arr, points: [arr.points[0] + dx, arr.points[1] + dy, arr.points[2] + dx, arr.points[3] + dy] }
                          : arr
                      ));
                      e.target.position({ x: 0, y: 0 });
                    }}
                  />
                ))}

                {/* Drawing arrow preview */}
                {drawingArrow && (
                  <Arrow
                    points={drawingArrow}
                    stroke={color}
                    strokeWidth={strokeWidth}
                    fill={color}
                    pointerLength={10}
                    pointerWidth={10}
                  />
                )}

                {/* Texts */}
                {texts.map(t => (
                  <Text
                    key={t.id}
                    id={t.id}
                    x={t.x}
                    y={t.y}
                    text={editingTextId === t.id ? '' : t.text}
                    fontSize={t.fontSize}
                    fill={t.fill}
                    draggable={tool === 'select'}
                    onClick={() => {
                      if (tool === 'select') setSelectedId(t.id);
                    }}
                    onDblClick={() => handleTextDblClick(t.id, t.text, t.x, t.y)}
                    onDblTap={() => handleTextDblClick(t.id, t.text, t.x, t.y)}
                    onDragEnd={(e) => {
                      setTexts(prev => prev.map(txt =>
                        txt.id === t.id ? { ...txt, x: e.target.x(), y: e.target.y() } : txt
                      ));
                    }}
                  />
                ))}

                {/* Transformer */}
                <Transformer
                  ref={transformerRef}
                  boundBoxFunc={(oldBox, newBox) => {
                    if (newBox.width < 20 || newBox.height < 20) return oldBox;
                    return newBox;
                  }}
                />
              </Layer>
            </Stage>

            {/* Text editing overlay */}
            {editingTextId && (
              <div
                className="screenshot-text-overlay"
                style={{
                  left: editingTextPos.x,
                  top: editingTextPos.y,
                }}
              >
                <textarea
                  ref={textareaRef}
                  value={editingTextValue}
                  onChange={(e) => setEditingTextValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      finishTextEdit();
                    }
                    if (e.key === 'Escape') {
                      finishTextEdit();
                    }
                  }}
                  onBlur={finishTextEdit}
                />
              </div>
            )}
          </>
        )}
      </div>

      <div className="screenshot-status">{statusMessage}</div>
    </div>
  );
}
