import { useAuth } from "@/hooks/use-auth";
import { Loader2 } from "lucide-react";
import { Redirect, Route } from "wouter";

interface ProtectedRouteProps {
  path: string;
  component: React.ComponentType;
  roles?: string[];
}

export function ProtectedRoute({
  path,
  component: Component,
  roles
}: ProtectedRouteProps) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <Route path={path}>
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </Route>
    );
  }

  if (!user) {
    return (
      <Route path={path}>
        <Redirect to="/auth" />
      </Route>
    );
  }
  
  // Check roles if specified
  if (roles && !roles.includes(user.role)) {
    return (
      <Route path={path}>
        <Redirect to={user.role === "admin" ? "/admin" : "/technician"} />
      </Route>
    );
  }

  return <Route path={path} component={Component} />;
}
