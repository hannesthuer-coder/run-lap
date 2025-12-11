import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { User, Crown, BookmarkCheck, LogOut } from 'lucide-react';

import { useTheme } from 'next-themes';
import logoBlack from '@/assets/logo-black.png';
import logoWhite from '@/assets/logo-white.png';

export const Header = () => {
  const navigate = useNavigate();
  const { theme, resolvedTheme } = useTheme();
  const {
    user,
    isPremium,
    signOut
  } = useAuth();
  
  const currentTheme = resolvedTheme || theme;
  const logo = currentTheme === 'dark' ? logoWhite : logoBlack;
  
  const getInitials = (email: string) => {
    return email.substring(0, 2).toUpperCase();
  };
  
  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };
  
  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-card border-b border-border">
      <div className="container mx-auto px-4 h-20 sm:h-24 flex items-center justify-between my-0 py-0 pb-0 mb-0">
        <button onClick={() => navigate('/')} className="hover:opacity-80 transition-opacity">
          <img src={logo} alt="run-lap" className="h-12 sm:h-16 w-auto" />
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
                {isPremium && <Crown className="h-4 w-4 text-primary" />}
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
          <button onClick={() => navigate('/auth')} className="hover:opacity-80 transition-opacity" aria-label="Sign in">
            <Avatar className="h-9 w-9 border-2 border-border">
              <AvatarFallback className="bg-muted">
                <User className="h-5 w-5 text-muted-foreground" />
              </AvatarFallback>
            </Avatar>
          </button>
        )}
      </div>
    </header>
  );
};
