interface StatsPanelProps {
  distanceCompleted: number; // meters
  distanceRemaining: number; // meters
  elapsedTime: number; // seconds
  unit: 'km' | 'miles';
  currentPace?: number | null; // minutes per km
}

export const StatsPanel = ({
  distanceCompleted,
  distanceRemaining,
  elapsedTime,
  unit,
  currentPace,
}: StatsPanelProps) => {
  const formatDistance = (meters: number): string => {
    if (unit === 'km') {
      return (meters / 1000).toFixed(2);
    }
    return (meters / 1609.34).toFixed(2);
  };

  const formatTime = (seconds: number): string => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatPace = (paceMinPerKm: number): string => {
    // Convert to the user's unit if needed
    const pace = unit === 'miles' ? paceMinPerKm * 1.60934 : paceMinPerKm;
    
    // Cap pace at reasonable values (2-20 min/km range)
    if (pace < 2 || pace > 20 || !isFinite(pace)) {
      return '--:--';
    }
    
    const mins = Math.floor(pace);
    const secs = Math.round((pace % 1) * 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="bg-background/80 backdrop-blur-sm rounded-full px-6 py-3 shadow-sm border border-border/50">
      <div className="flex items-center justify-center gap-4 text-sm">
        {/* Distance */}
        <div className="text-center">
          <span className="font-semibold text-foreground">{formatDistance(distanceCompleted)}</span>
          <span className="text-muted-foreground ml-1">/ {formatDistance(distanceCompleted + distanceRemaining)} {unit}</span>
        </div>
        
        <span className="text-muted-foreground/50">•</span>
        
        {/* Time */}
        <div className="text-center">
          <span className="font-semibold text-foreground">{formatTime(elapsedTime)}</span>
        </div>

        {/* Current Pace (if available) */}
        {currentPace && currentPace > 0 && (
          <>
            <span className="text-muted-foreground/50">•</span>
            <div className="text-center">
              <span className="font-semibold text-foreground">{formatPace(currentPace)}</span>
              <span className="text-muted-foreground ml-1">/{unit === 'km' ? 'km' : 'mi'}</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
