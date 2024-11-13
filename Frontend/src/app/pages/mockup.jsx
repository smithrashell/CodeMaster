import React from "react";
import { Outlet, Link } from "react-router-dom";

export function DashboardPage() {
  return (
    <div>
      <h1>Dashboard Page</h1>
      <nav>
        <Link to="stats">Analytics</Link> | <Link to="reports">Reports</Link> |{" "}
        <Link to="goals">Goals</Link>
      </nav>
      <Outlet /> {/* Corrected to use Outlet as a component */}
    </div>
  );
}

export function AnalyticsPage() {
  return (
    <div>
      <h1>Analytics Page</h1>
      <nav>
        <Link to="progress">Progress</Link> |{" "}
        <Link to="conversions">Conversions</Link> |{" "}
        <Link to="sources">Sources</Link>
      </nav>
      <Outlet />
    </div>
  );
}

export function AccountPage() {
  return (
    <div>
      <h1>Account Page</h1>
      <nav>
        <Link to="profile">Profile</Link> | <Link to="settings">Settings</Link>{" "}
        | <Link to="notifications">Notifications</Link>
      </nav>
      <Outlet />
    </div>
  );
}

export function SettingsPage() {
  return (
    <div>
      <h1>Settings Page</h1>
      <nav>
        <Link to="general">General</Link> |{" "}
        <Link to="appearance">Appearance</Link> |{" "}
        <Link to="accessibility">Accessibility</Link>
      </nav>
      <Outlet />
    </div>
  );
}

export function FlashcardPage() {
  return (
    <div>
      <h1>Flashcard Page</h1>
      <nav>
        <Link to="flashcards">Flashcards</Link> |{" "}
        <Link to="practice">Practice</Link> | <Link to="review">Review</Link>
      </nav>
      <Outlet />
    </div>
  );
}

// Child components for subroutes
export function Stats() {
  return <h1>Stats</h1>;
}

export function Reports() {
  return <h1>Reports</h1>;
}

export function Goals() {
  return <h1>Goals</h1>;
}

export function Progress() {
  return <h1>Progress</h1>;
}

export function Conversions() {
  return <h1>Conversions</h1>;
}

export function Sources() {
  return <h1>Sources</h1>;
}

export function General() {
  return <h1>General</h1>;
}

export function Appearance() {
  return <h1>Appearance</h1>;
}

export function Accessibility() {
  return <h1>Accessibility</h1>;
}

export function Profile() {
  return <h1>Profile</h1>;
}

export function Settings() {
  return <h1>Settings</h1>;
}

export function Notifications() {
  return <h1>Notifications</h1>;
}

export function Flashcards() {
  return <h1>Flashcards</h1>;
}

export function Practice() {
  return <h1>Practice</h1>;
}

export function Review() {
  return <h1>Review</h1>;
}
