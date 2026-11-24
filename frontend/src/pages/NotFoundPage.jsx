import { Link } from "react-router-dom";
import "../styles/Dashboard.css";

function NotFoundPage() {
  return (
    <main className="dashboard-not-found">
      <span>404</span>
      <h1>Page not found</h1>
      <p>The requested Schevo page does not exist.</p>
      <Link className="primary-button" to="/">Return home</Link>
    </main>
  );
}

export default NotFoundPage;
