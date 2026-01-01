import { Timer, MapPin, TrendingUp } from 'lucide-react';

interface StatsPanelProps {
  distanceCompleted: number; // meters
  distanceRemaining: number; // meters
  elapsedTime: number; // seconds
  currentPace: number | null; // min/km
  unit: 'km' | 'miles';
}

export const StatsPanel = ({
  distanceCompleted,
  distanceRemaining,
  elapsedTime,
  currentPace,
  unit,
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

  const formatPace = (pace: number | null): string => {
    if (pace === null || !isFinite(pace) || pace <= 0 || pace > 60) return '--:--';
    const mins = Math.floor(pace);
    const secs = Math.round((pace - mins) * 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Estimate remaining time based on current pace
  const estimatedTimeRemaining = (): string => {
    if (!currentPace || !isFinite(currentPace) || currentPace <= 0) return '--:--';
    const remainingKm = distanceRemaining / 1000;
    const remainingMinutes = remainingKm * currentPace;
    const remainingSeconds = remainingMinutes * 60;
    return formatTime(remainingSeconds);
  };

  return (
    <div className="bg-card/95 backdrop-blur-md rounded-2xl shadow-medium border p-4">
      <div className="grid grid-cols-2 gap-4">
        {/* Distance */}
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-full bg-primary/10">
            <MapPin className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-2xl font-bold text-foreground">
              {formatDistance(distanceCompleted)}
            </p>
            <p className="text-xs text-muted-foreground">
              / {formatDistance(distanceCompleted + distanceRemaining)} {unit}
            </p>
          </div>
        </div>

        {/* Elapsed Time */}
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-full bg-accent/10">
            <Timer className="h-5 w-5 text-accent" />
          </div>
          <div>
            <p className="text-2xl font-bold text-foreground">
              {formatTime(elapsedTime)}
            </p>
            <p className="text-xs text-muted-foreground">elapsed</p>
          </div>
        </div>

        {/* Pace */}
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-full bg-success/10">
            <TrendingUp className="h-5 w-5 text-success" />
          </div>
          <div>
            <p className="text-2xl font-bold text-foreground">
              {formatPace(currentPace)}
            </p>
            <p className="text-xs text-muted-foreground">min/{unit === 'km' ? 'km' : 'mi'}</p>
          </div>
        </div>

        {/* ETA */}
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-full bg-info/10">
            <Timer className="h-5 w-5 text-info" />
          </div>
          <div>
            <p className="text-2xl font-bold text-foreground">
              {estimatedTimeRemaining()}
            </p>
            <p className="text-xs text-muted-foreground">remaining</p>
          </div>
        </div>
      </div>
    </div>
  );
};
