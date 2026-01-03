interface RunnerMarkerProps {
  accuracy: 'high' | 'medium' | 'low' | 'unknown';
  heading: number | null;
}

export const RunnerMarker = ({ accuracy, heading }: RunnerMarkerProps) => {
  const getAccuracyRingColor = () => {
    switch (accuracy) {
      case 'high':
        return 'rgba(59, 130, 246, 0.3)';
      case 'medium':
        return 'rgba(234, 179, 8, 0.3)';
      case 'low':
        return 'rgba(239, 68, 68, 0.3)';
      default:
        return 'rgba(156, 163, 175, 0.3)';
    }
  };

  const getAccuracyRingSize = () => {
    switch (accuracy) {
      case 'high':
        return 30;
      case 'medium':
        return 45;
      case 'low':
        return 60;
      default:
        return 40;
    }
  };

  return (
    <div className="relative" style={{ width: 60, height: 60 }}>
      {/* Accuracy ring */}
      <div
        className="absolute rounded-full animate-pulse"
        style={{
          width: getAccuracyRingSize(),
          height: getAccuracyRingSize(),
          backgroundColor: getAccuracyRingColor(),
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
        }}
      />
      
      {/* Outer ring with pulse animation */}
      <div
        className="absolute rounded-full border-4 border-primary/50 animate-ping"
        style={{
          width: 28,
          height: 28,
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          animationDuration: '2s',
        }}
      />
      
      {/* Inner dot */}
      <div
        className="absolute rounded-full bg-primary border-4 border-white shadow-lg"
        style={{
          width: 20,
          height: 20,
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
        }}
      />
      
      {/* Direction arrow (if heading available) */}
      {heading !== null && (
        <div
          className="absolute"
          style={{
            width: 0,
            height: 0,
            borderLeft: '6px solid transparent',
            borderRight: '6px solid transparent',
            borderBottom: '12px solid hsl(var(--primary))',
            top: '50%',
            left: '50%',
            transform: `translate(-50%, -150%) rotate(${heading}deg)`,
            transformOrigin: 'center bottom',
          }}
        />
      )}
    </div>
  );
};

// Create marker element for Mapbox
export const createRunnerMarkerElement = (
  accuracy: 'high' | 'medium' | 'low' | 'unknown',
  heading: number | null = null
): HTMLDivElement => {
  const el = document.createElement('div');
  el.className = 'runner-marker';
  
  const size = accuracy === 'high' ? 30 : accuracy === 'medium' ? 40 : 50;
  const showArrow = heading !== null;
  const rotation = heading ?? 0;
  
  el.innerHTML = `
    <div style="position: relative; width: ${size + 20}px; height: ${size + 20}px;">
      <div style="
        position: absolute;
        width: ${size}px;
        height: ${size}px;
        border-radius: 50%;
        background: rgba(59, 130, 246, 0.2);
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        animation: pulse 2s infinite;
      "></div>
      <div style="
        position: absolute;
        width: 24px;
        height: 24px;
        border-radius: 50%;
        background: #3B82F6;
        border: 4px solid white;
        box-shadow: 0 2px 10px rgba(0,0,0,0.3);
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
      "></div>
      <div class="runner-heading-arrow" style="
        position: absolute;
        width: 0;
        height: 0;
        border-left: 8px solid transparent;
        border-right: 8px solid transparent;
        border-bottom: 16px solid #3B82F6;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -150%) rotate(${rotation}deg);
        transform-origin: center bottom;
        filter: drop-shadow(0 1px 2px rgba(0,0,0,0.3));
        display: ${showArrow ? 'block' : 'none'};
      "></div>
    </div>
  `;
  
  // Add pulse animation style if not already present
  if (!document.getElementById('runner-marker-styles')) {
    const style = document.createElement('style');
    style.id = 'runner-marker-styles';
    style.textContent = `
      @keyframes pulse {
        0% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
        50% { transform: translate(-50%, -50%) scale(1.2); opacity: 0.7; }
        100% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
      }
    `;
    document.head.appendChild(style);
  }
  
  return el;
};
