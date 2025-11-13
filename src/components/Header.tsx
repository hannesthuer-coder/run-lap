import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { User, Crown, BookmarkCheck, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import runlapLogo from '@/assets/runlap-logo.png';

export const Header = () => {
  const navigate = useNavigate();
  const { user, isPremium, signOut } = useAuth();

  const getInitials = (email: string) => {
    return email.substring(0, 2).toUpperCase();
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-card border-b border-border">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <button
          onClick={() => navigate('/')}
          className="hover:opacity-80 transition-opacity"
        >
          <img src={runlapLogo} alt="run-lap" className="h-16 w-16 sm:h-20 sm:w-20" />
        </button>

        {user ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2 hover:opacity-80 transition-opacity">
                <Avatar className="h-9 w-9 border-2 border-beige">
                  <AvatarFallback className="bg-beige text-beige-foreground text-sm font-semibold">
                    {getInitials(user.email || 'U')}
                  </AvatarFallback>
                </Avatar>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="flex items-center gap-2">
                <span className="truncate">{user.email}</span>
                {isPremium && <Crown className="h-4 w-4 text-beige" />}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate('/profile')}>
                <User className="mr-2 h-4 w-4" />
                <span>My Profile</span>
              </DropdownMenuItem>
              {isPremium && (
                <DropdownMenuItem onClick={() => navigate('/saved-routes')}>
                  <BookmarkCheck className="mr-2 h-4 w-4" />
                  <span>Saved Routes</span>
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleSignOut}>
                <LogOut className="mr-2 h-4 w-4" />
                <span>Log Out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <Button
            onClick={() => navigate('/auth')}
            className="bg-beige hover:bg-beige-hover text-beige-foreground rounded-full px-6"
          >
            SIGN IN
          </Button>
        )}
      </div>
    </header>
  );
};