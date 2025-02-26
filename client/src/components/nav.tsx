import { Link, useLocation } from "wouter";
import { Mail, Settings } from "lucide-react";

export default function Nav() {
  const [location] = useLocation();

  return (
    <nav className="border-b">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center gap-8">
            <Link href="/" className="flex items-center gap-2 text-xl font-semibold">
              <Mail className="h-6 w-6" />
              <span>Email Aggregator</span>
            </Link>
          </div>

          <div className="flex items-center gap-4">
            <Link 
              href="/settings"
              className={`flex items-center gap-2 ${location === "/settings" ? "text-primary" : ""}`}
            >
              <Settings className="h-5 w-5" />
              <span>Settings</span>
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
}