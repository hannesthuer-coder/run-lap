import { Button } from "@/components/ui/button";

const NotFound = () => {
  return (
    <div className="min-h-screen flex flex-col justify-center items-center bg-background">
      <div className="text-center space-y-6">
        <h1 className="text-6xl font-bold text-primary">404</h1>
        <h2 className="text-2xl font-semibold text-foreground">Page Not Found</h2>
        <p className="text-muted-foreground max-w-md">
          The page you're looking for doesn't exist or has been moved.
        </p>
        
        <div className="flex gap-4 justify-center">
          <Button
            onClick={() => window.history.back()}
            variant="outline"
            className="px-6"
          >
            Go Back
          </Button>
          
          <Button
            onClick={() => window.location.href = '/'}
            className="px-6"
          >
            Go Home
          </Button>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
