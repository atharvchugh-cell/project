import { Link } from 'react-router-dom';
import { BarChart3, Users, UserRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

export function SocialAccountMenu() {
  return <DropdownMenu><DropdownMenuTrigger asChild><Button variant="outline" size="sm" className="shrink-0 gap-2"><UserRound className="h-4 w-4 text-primary" />Account</Button></DropdownMenuTrigger>
    <DropdownMenuContent align="end"><DropdownMenuItem asChild><Link to="/account"><BarChart3 className="mr-2 h-4 w-4" />My stats</Link></DropdownMenuItem><DropdownMenuItem asChild><Link to="/friends"><Users className="mr-2 h-4 w-4" />Friends</Link></DropdownMenuItem></DropdownMenuContent>
  </DropdownMenu>;
}