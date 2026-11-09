import { Link, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { HomeIcon, CompassIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.warn("404: no route for", location.pathname);
  }, [location.pathname]);

  return (
    <div className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-background px-6">
      <Empty>
        <EmptyHeader>
          <EmptyTitle
            className="bg-gradient-to-b from-foreground to-foreground/0 bg-clip-text text-9xl font-extrabold text-transparent"
          >
            404
          </EmptyTitle>
          <EmptyDescription className="-mt-6 text-foreground/80">
            The page you're looking for might have been moved or doesn't exist.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <div className="flex flex-wrap justify-center gap-2">
            <Button asChild>
              <Link to="/">
                <HomeIcon className="mr-2 size-4" aria-hidden="true" />
                Go Home
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/learn">
                <CompassIcon className="mr-2 size-4" aria-hidden="true" />
                Explore
              </Link>
            </Button>
          </div>
        </EmptyContent>
      </Empty>
    </div>
  );
};

export default NotFound;
