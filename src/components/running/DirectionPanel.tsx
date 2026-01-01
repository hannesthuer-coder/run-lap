import { 
  ArrowUp, 
  ArrowUpLeft, 
  ArrowLeft, 
  ArrowUpRight, 
  ArrowRight,
  CornerUpLeft,
  CornerUpRight,
  RotateCcw,
  Flag
} from 'lucide-react';
import { TurnType } from '@/services/routeNavigation.service';

interface DirectionPanelProps {
  turnType: TurnType;
  distanceToTurn: number; // meters
  description: string;
  isOffRoute: boolean;
}

const getTurnIcon = (turnType: TurnType) => {
  switch (turnType) {
    case 'straight':
      return ArrowUp;
    case 'slight-left':
      return ArrowUpLeft;
    case 'left':
      return ArrowLeft;
    case 'sharp-left':
      return CornerUpLeft;
    case 'slight-right':
      return ArrowUpRight;
    case 'right':
      return ArrowRight;
    case 'sharp-right':
      return CornerUpRight;
    case 'u-turn':
      return RotateCcw;
    case 'finish':
      return Flag;
    default:
      return ArrowUp;
  }
};

const getDistanceColor = (distance: number): string => {
  if (distance <= 20) return 'text-destructive';
  if (distance <= 50) return 'text-warning';
  return 'text-foreground';
};

const formatDistance = (meters: number): string => {
  if (meters < 100) {
    return `${Math.round(meters)}m`;
  }
  return `${Math.round(meters / 100) * 100}m`;
};

export const DirectionPanel = ({
  turnType,
  distanceToTurn,
  description,
  isOffRoute,
}: DirectionPanelProps) => {
  const TurnIcon = getTurnIcon(turnType);

  if (isOffRoute) {
    return (
      <div className="bg-destructive/95 backdrop-blur-md rounded-2xl shadow-medium p-4 animate-pulse">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-full bg-destructive-foreground/20">
            <RotateCcw className="h-10 w-10 text-destructive-foreground" />
          </div>
          <div className="flex-1">
            <p className="text-xl font-bold text-destructive-foreground">
              Off Route
            </p>
            <p className="text-sm text-destructive-foreground/80">
              Return to the blue route line
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card/95 backdrop-blur-md rounded-2xl shadow-medium border p-4">
      <div className="flex items-center gap-4">
        <div className={`p-3 rounded-full ${turnType === 'finish' ? 'bg-success/20' : 'bg-primary/10'}`}>
          <TurnIcon className={`h-10 w-10 ${turnType === 'finish' ? 'text-success' : 'text-primary'}`} />
        </div>
        <div className="flex-1">
          <p className={`text-3xl font-bold ${getDistanceColor(distanceToTurn)}`}>
            {formatDistance(distanceToTurn)}
          </p>
          <p className="text-sm text-muted-foreground">
            {turnType === 'finish' ? 'to finish' : description.split(' in ')[0].toLowerCase()}
          </p>
        </div>
      </div>
    </div>
  );
};
