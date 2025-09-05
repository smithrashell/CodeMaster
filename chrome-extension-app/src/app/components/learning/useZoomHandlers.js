import { useCallback } from 'react';

/**
 * Custom hook for handling zoom-related interactions
 */
export function useZoomHandlers({ zoom, setZoom, setViewBox }) {
  const handleWheel = useCallback((e) => {
    e.preventDefault();
    const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
    const newZoom = Math.min(Math.max(zoom * zoomFactor, 0.1), 3);
    
    // Note: Future enhancement could center zoom on mouse position
    
    setZoom(newZoom);
    setViewBox(prev => ({
      ...prev,
      width: 800 / newZoom,
      height: 480 / newZoom
    }));
  }, [zoom, setZoom, setViewBox]);

  // Zoom Controls
  const handleZoomIn = useCallback(() => {
    const newZoom = Math.min(zoom * 1.2, 3);
    setZoom(newZoom);
    setViewBox(prev => ({
      ...prev,
      width: 800 / newZoom,
      height: 480 / newZoom
    }));
  }, [zoom, setZoom, setViewBox]);

  const handleZoomOut = useCallback(() => {
    const newZoom = Math.max(zoom * 0.8, 0.1);
    setZoom(newZoom);
    setViewBox(prev => ({
      ...prev,
      width: 800 / newZoom,
      height: 480 / newZoom
    }));
  }, [zoom, setZoom, setViewBox]);

  const handleZoomReset = useCallback(() => {
    setZoom(1);
    setViewBox(prev => ({
      ...prev,
      width: 800,
      height: 480
    }));
  }, [setZoom, setViewBox]);

  return {
    handleWheel,
    handleZoomIn,
    handleZoomOut,
    handleZoomReset
  };
}