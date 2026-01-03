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
      <div className="inline-flex items-center gap-2 bg-destructive/90 backdrop-blur-sm rounded-full px-4 py-2 shadow-sm animate-pulse">
        <RotateCcw className="h-4 w-4 text-destructive-foreground" />
        <span className="text-sm font-medium text-destructive-foreground">Off route</span>
      </div>
    );
  }

  return (
    <div className="inline-flex items-center gap-3 bg-background/80 backdrop-blur-sm rounded-full px-4 py-2 shadow-sm border border-border/50">
      <TurnIcon className={`h-5 w-5 ${turnType === 'finish' ? 'text-primary' : 'text-foreground'}`} />
      <span className="font-semibold text-foreground">{formatDistance(distanceToTurn)}</span>
      <span className="text-sm text-muted-foreground">
        {turnType === 'finish' ? 'to finish' : description.split(' in ')[0].toLowerCase()}
      </span>
    </div>
  );
};
