import LandingPage from "./pages/LandingPage.jsx";
import PrivacyPolicy from "./pages/PrivacyPolicy.jsx";

function normalizePathname(pathname) {
  const trimmed = pathname.replace(/\/+$/, "");
  return trimmed || "/";
}

export default function App() {
  const pathname = normalizePathname(window.location.pathname);

  if (pathname === "/privacy-policy") {
    return <PrivacyPolicy />;
  }

  return <LandingPage />;
}
