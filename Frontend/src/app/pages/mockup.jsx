import React from "react";
import { Outlet, Link } from "react-router-dom";

export function DashboardPage() {
  

  return (
    <div>
      <Outlet />
    </div>
  );
}

export function AnalyticsPage() {
  return (
    <div>
      <Outlet />
    </div>
  );
}

export function AccountPage() {
  return (
    <div>
      <Outlet />
    </div>
  );
}

export function SettingsPage() {
  return (
    <div>
      <Outlet />
    </div>
  );
}

export function FlashcardPage() {
  return (
    <div>
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

export function Practice() {
  return <h1>Practice</h1>;
}

export function Review() {
  return <h1>Review</h1>;
}
