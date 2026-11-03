import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <h1 className="mb-2 text-4xl font-bold">404</h1>
        <p className="mb-4 dv-muted">This page doesn't exist.</p>
        <Link to="/" className="text-primary font-semibold">
          Back to home
        </Link>
      </div>
    </div>
  );
}
