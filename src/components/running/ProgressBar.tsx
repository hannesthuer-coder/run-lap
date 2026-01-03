interface ProgressBarProps {
  progress: number; // 0-100
}

export const ProgressBar = ({ progress }: ProgressBarProps) => {
  return (
    <div className="w-full h-1 bg-muted/50 rounded-full overflow-hidden">
      <div
        className="h-full bg-primary/70 transition-all duration-300 ease-out"
        style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
      />
    </div>
  );
};
