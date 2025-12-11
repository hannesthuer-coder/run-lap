import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { Copy, Check, Loader2, Share2 } from 'lucide-react';

interface RouteData {
  id?: string;
  route_name?: string;
  distance: number;
  unit: string;
  start_location: string;
  route_geometry: any;
}

interface ShareRouteDialogProps {
  open: boolean;
  onClose: () => void;
  route: RouteData | null;
}

export const ShareRouteDialog = ({ open, onClose, route }: ShareRouteDialogProps) => {
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const generateShareCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let code = '';
    for (let i = 0; i < 8; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  };

  const handleCreateShareLink = async () => {
    if (!route) return;

    setLoading(true);
    try {
      const shareCode = generateShareCode();
      
      const { error } = await supabase
        .from('shared_routes')
        .insert({
          share_code: shareCode,
          route_geometry: route.route_geometry,
          distance: route.distance,
          unit: route.unit,
          start_location: route.start_location,
          route_name: route.route_name || `${route.distance} ${route.unit} lap`,
        } as any);

      if (error) throw error;

      const url = `${window.location.origin}/shared/${shareCode}`;
      setShareUrl(url);
      
      toast({
        title: "success",
        description: "share link created",
      });
    } catch (error) {
      console.error('Error creating share link:', error);
      toast({
        title: "error",
        description: "failed to create share link",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!shareUrl) return;
    
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({
        title: "copied",
        description: "link copied to clipboard",
      });
    } catch (error) {
      toast({
        title: "error",
        description: "failed to copy link",
        variant: "destructive",
      });
    }
  };

  const handleClose = () => {
    setShareUrl(null);
    setCopied(false);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="h-5 w-5" />
            share route
          </DialogTitle>
          <DialogDescription>
            {route?.route_name || `${route?.distance} ${route?.unit} lap`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {!shareUrl ? (
            <div className="text-center space-y-4">
              <p className="text-sm text-muted-foreground">
                create a shareable link for this route. the link will expire in 30 days.
              </p>
              <Button
                onClick={handleCreateShareLink}
                disabled={loading}
                className="w-full bg-beige hover:bg-beige-hover text-beige-foreground"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    creating link...
                  </>
                ) : (
                  'create share link'
                )}
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                your share link is ready:
              </p>
              <div className="flex gap-2">
                <Input
                  readOnly
                  value={shareUrl}
                  className="flex-1 text-sm"
                />
                <Button
                  size="icon"
                  variant="outline"
                  onClick={handleCopy}
                >
                  {copied ? (
                    <Check className="h-4 w-4 text-success" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                this link will expire in 30 days
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
